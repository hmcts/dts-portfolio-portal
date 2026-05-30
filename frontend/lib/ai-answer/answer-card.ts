import { AzureOpenAI } from "openai";
import {
  DefaultAzureCredential,
  getBearerTokenProvider,
} from "@azure/identity";

// Phase 3 task 3.3: LLM answer-card synthesis. The overlay shows a
// one-paragraph synthesised answer above the ranked list, grounded
// only in the supplied search results.
//
// Grounding rules — also enforced via the prompt:
//   * Never invent entities, names or facts not present in `results`.
//   * If `results` can't support a useful answer, return null
//     (`source: "unavailable"`) — the overlay falls back to the
//     ranked list alone.
//   * Keep the answer to a single short paragraph (~60 words). The
//     overlay clamps the visual height regardless, but a short
//     answer keeps the perceived-latency budget under control.
//
// Auth follows the AzureOpenAIParser pattern — DefaultAzureCredential
// in production (managed identity), AZURE_OPENAI_API_KEY for local
// dev / CI smoke. Configured via the same env vars so production
// only has to set them once.

export interface AnswerCardResultInput {
  entityType: string;
  name: string;
  description?: string | null;
  href?: string | null;
}

export interface AnswerCardSuccess {
  source: "azure-openai";
  answer: string;
  // Indexes (into the input `results` array) of the entities the
  // model cited as supporting the answer. The overlay can highlight
  // those rows in the list below the card.
  citations: number[];
}

export interface AnswerCardUnavailable {
  source: "unavailable";
  answer: null;
  reason: string;
}

export type AnswerCardResult = AnswerCardSuccess | AnswerCardUnavailable;

// Narrow structural interface for the part of the Azure OpenAI SDK
// this module uses. Mirrors src/lib/ai-parser/azure-openai.ts —
// hand-written test stubs only need to implement one method, and
// the real AzureOpenAI class is structurally assignable.
export interface ChatClient {
  chat: {
    completions: {
      create(args: ChatCompletionsCreateArgs): Promise<ChatCompletionResponse>;
    };
  };
}

interface ChatCompletionsCreateArgs {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  response_format?: { type: "json_object" };
  max_tokens?: number;
  temperature?: number;
}

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

const SYSTEM_PROMPT = `You are the assistant for the DTS Portfolio Portal — a high-level front door over HMCTS Digital and Technology Services.

A user has asked a question about the portfolio. You will receive that question and the top search results from the portal index. Your job is to write a one-paragraph answer (target ~60 words) that:

  1. Uses ONLY information present in the supplied results. If the results don't support an answer, return the literal JSON value: {"answer": null, "citations": []}.
  2. Names entities exactly as they appear in the results.
  3. Cites the result indexes you used in a "citations" array (0-based).
  4. Does NOT invent jurisdictions, teams, products or initiatives that aren't in the input.
  5. Speaks in the present tense, plainly. No marketing voice. No bullet lists.

Output strict JSON matching this shape:
  {"answer": string | null, "citations": number[]}

Nothing else — no preamble, no markdown.`;

interface AnswerCardConfig {
  endpoint: string;
  deployment: string;
  apiVersion?: string;
  apiKey?: string;
  // Optional pre-built chat client. Production code never sets this
  // (the real AzureOpenAI client is built lazily below). Tests inject
  // a hand-written stub conforming to ChatClient so they exercise
  // every code path with deterministic responses.
  client?: ChatClient;
}

export class AzureOpenAIAnswerCard {
  private readonly config: AnswerCardConfig;
  private clientCache: ChatClient | undefined;

  constructor(config: AnswerCardConfig) {
    this.config = config;
    if (config.client) {
      this.clientCache = config.client;
    }
  }

  // Lazy client — same reasoning as AzureOpenAIParser. The SDK
  // constructor inspects globals and refuses in any "browser-like"
  // environment (including happy-dom test env), so we defer
  // construction until first synthesise() call.
  private get client(): ChatClient {
    if (this.clientCache) return this.clientCache;
    const apiVersion = this.config.apiVersion ?? "2024-10-21";
    if (this.config.apiKey) {
      this.clientCache = new AzureOpenAI({
        endpoint: this.config.endpoint,
        apiKey: this.config.apiKey,
        apiVersion,
        deployment: this.config.deployment,
      });
    } else {
      const credential = new DefaultAzureCredential();
      const azureADTokenProvider = getBearerTokenProvider(
        credential,
        "https://cognitiveservices.azure.com/.default",
      );
      this.clientCache = new AzureOpenAI({
        endpoint: this.config.endpoint,
        azureADTokenProvider,
        apiVersion,
        deployment: this.config.deployment,
      });
    }
    return this.clientCache;
  }

  async synthesise(
    query: string,
    results: AnswerCardResultInput[],
  ): Promise<AnswerCardResult> {
    if (query.trim() === "") {
      return {
        source: "unavailable",
        answer: null,
        reason: "Empty query",
      };
    }
    if (results.length === 0) {
      return {
        source: "unavailable",
        answer: null,
        reason: "No results to ground in",
      };
    }

    const userContent = buildUserMessage(query, results);

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.deployment,
        response_format: { type: "json_object" },
        // The card is shown above the ranked list — bounded latency
        // matters more than maximum quality. 220 tokens is enough
        // for the ~60-word answer plus the citations array.
        max_tokens: 220,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          source: "unavailable",
          answer: null,
          reason: "Model returned no content",
        };
      }

      let parsed: { answer?: string | null; citations?: number[] };
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        return {
          source: "unavailable",
          answer: null,
          reason: `Model response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      if (
        parsed.answer === null ||
        parsed.answer === undefined ||
        typeof parsed.answer !== "string" ||
        parsed.answer.trim() === ""
      ) {
        return {
          source: "unavailable",
          answer: null,
          reason: "Model declined to answer (insufficient grounding)",
        };
      }

      const citations = Array.isArray(parsed.citations)
        ? parsed.citations.filter(
            (i): i is number =>
              Number.isInteger(i) && i >= 0 && i < results.length,
          )
        : [];

      return {
        source: "azure-openai",
        answer: parsed.answer.trim(),
        citations,
      };
    } catch (err) {
      return {
        source: "unavailable",
        answer: null,
        reason: `Azure OpenAI request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

export function buildUserMessage(
  query: string,
  results: AnswerCardResultInput[],
): string {
  const lines = [
    `User question: ${query.trim()}`,
    "",
    "Results (0-indexed; cite the index numbers you use):",
  ];
  results.forEach((r, i) => {
    lines.push(
      `  [${i}] ${r.entityType}: ${r.name}` +
        (r.description ? ` — ${truncate(r.description, 280)}` : ""),
    );
  });
  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// Factory mirroring src/lib/ai-parser/index.ts. Returns null when
// Azure OpenAI isn't configured — the API route surfaces this as
// {source: "unavailable"} so the UI gracefully degrades to just
// the ranked list.
let cached: AzureOpenAIAnswerCard | null | undefined;

export function getAnswerCardSynthesiser(): AzureOpenAIAnswerCard | null {
  if (cached !== undefined) return cached;

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment =
    process.env.AZURE_OPENAI_ANSWER_DEPLOYMENT ??
    process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (!endpoint || !deployment) {
    cached = null;
    return cached;
  }

  cached = new AzureOpenAIAnswerCard({
    endpoint,
    deployment,
    ...(apiVersion ? { apiVersion } : {}),
    ...(apiKey ? { apiKey } : {}),
  });
  return cached;
}

export function __resetAnswerCardForTests(): void {
  cached = undefined;
}
