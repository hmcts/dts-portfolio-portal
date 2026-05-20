import { AzureOpenAI } from "openai";
import {
  DefaultAzureCredential,
  getBearerTokenProvider,
} from "@azure/identity";
import { parseIdentity, IdentityParseError } from "@/lib/markdown/identity-parser";
import { recordParseMetric } from "./metrics";
import type {
  AiParser,
  AiParseResult,
  ConfidenceFlags,
  UnrecognisedSection,
} from "./types";

// Azure OpenAI parser per ADR-003. Talks to Azure OpenAI via:
//   - DefaultAzureCredential (managed identity in production —
//     App Service user-assigned MI grants Cognitive-Services-User
//     on the AOAI resource per ADR-008), OR
//   - AZURE_OPENAI_API_KEY env var (local dev / CI smoke).
//
// Idempotency: callers MUST cache parses by source-markdown SHA-256
// (see src/lib/audit-log/submission.ts). This parser does not cache
// internally — that's the audit log's responsibility, where the cache
// row also doubles as the legal record of the parse.

const SYSTEM_PROMPT = `You are a strict markdown parser for the DTS Portfolio Portal.
The portal documents Jurisdictions, Product Domains, Teams, and Products in HMCTS.

Your job is to extract structured content from the user's markdown into the JSON schema you've been given.

Rules:
1. Do NOT invent fields. If the source doesn't mention something, omit it (do not fill in a guess).
2. Section headers may use loose synonyms ("Contact us" / "How to reach us" / "Reach us" all map to the contact block). Be tolerant of variants.
3. For every field you produce, decide a confidence level: high if the source was unambiguous, medium if you had to interpret, low if you guessed.
4. If you see content under a heading you cannot map to any known section, add it to the \`unrecognised\` array verbatim — do NOT silently drop it.
5. The front-matter at the top of the document (between \`---\` markers) is parsed separately; ignore it for the body output.

Output JSON matching the supplied schema. Nothing else.`;

interface AzureOpenAIParserOptions {
  endpoint: string;
  deployment: string;
  apiVersion?: string;
  apiKey?: string;
  // Optional pre-built chat client. Production code never sets this
  // (the real AzureOpenAI client is built lazily below). Tests can
  // inject a hand-written stub conforming to ChatClient so they
  // exercise every code path with deterministic responses.
  client?: ChatClient;
}

// Structural interface for the part of the Azure OpenAI SDK this
// parser actually uses. Keeping the surface narrow means a hand-
// written test stub only has to implement one method. The real
// `AzureOpenAI` class is assignable to this interface.
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

export class AzureOpenAIParser implements AiParser {
  private readonly options: AzureOpenAIParserOptions;
  private clientCache: ChatClient | undefined;
  // Tail of the in-flight metric-write chain. Production code
  // fire-and-forgets metric inserts; tests await this to assert
  // the recording happened.
  private metricChain: Promise<unknown> = Promise.resolve();

  constructor(options: AzureOpenAIParserOptions) {
    // Store options only — the actual AzureOpenAI client is built
    // lazily on first parse() call. The SDK constructor refuses to
    // run in any "browser-like" environment (it inspects globals at
    // construction time), so deferring the build keeps the test
    // suite from tripping that check just by importing the factory.
    this.options = options;
    if (options.client) {
      this.clientCache = options.client;
    }
  }

  // Test helper. Returns a promise that resolves once every metric
  // write fired off so far has settled. Not used in production.
  async flushMetricsForTests(): Promise<void> {
    await this.metricChain;
  }

  // Fire-and-forget metric write, tracked so tests can flush.
  // A metric-insert failure must never reject parse() — the DB blip
  // is logged for the platform's observability and otherwise swallowed.
  private recordMetric(
    ...args: Parameters<typeof recordParseMetric>
  ): void {
    const next = recordParseMetric(...args).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(
        "[ai-parser] recordParseMetric failed:",
        err instanceof Error ? err.message : String(err),
      );
    });
    // Track the tail so flushMetricsForTests() can await it.
    this.metricChain = this.metricChain.then(() => next);
  }

  private get client(): ChatClient {
    if (this.clientCache) return this.clientCache;
    const { endpoint, deployment, apiKey } = this.options;
    const apiVersion = this.options.apiVersion ?? "2024-10-21";
    if (apiKey) {
      this.clientCache = new AzureOpenAI({
        endpoint,
        apiKey,
        apiVersion,
        deployment,
      });
    } else {
      const credential = new DefaultAzureCredential();
      const azureADTokenProvider = getBearerTokenProvider(
        credential,
        "https://cognitiveservices.azure.com/.default",
      );
      this.clientCache = new AzureOpenAI({
        endpoint,
        azureADTokenProvider,
        apiVersion,
        deployment,
      });
    }
    return this.clientCache;
  }

  private get deployment(): string {
    return this.options.deployment;
  }

  async parse(rawMarkdown: string): Promise<AiParseResult> {
    const startedAt = Date.now();
    // Run identity parse first — if the front-matter is malformed,
    // there's no point asking the model to guess what kind of entity
    // this is. Same failure shape as TemplateFallbackParser.
    let frontMatter;
    let body: string;
    try {
      const parsed = parseIdentity(rawMarkdown);
      frontMatter = parsed.frontMatter;
      body = parsed.body;
    } catch (err) {
      const reason =
        err instanceof IdentityParseError
          ? `Front-matter invalid: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      this.recordMetric({
        source: "azure-openai",
        outcome: "failure",
        latencyMs: Date.now() - startedAt,
        model: this.deployment,
        failureReason: reason,
      });
      return { ok: false, source: "azure-openai", reason };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.deployment,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `Entity type: ${frontMatter.type}`,
              `Entity name: ${frontMatter.name}`,
              "",
              "Body markdown follows. Return JSON with keys:",
              `  output: an object matching the ${frontMatter.type} entity schema`,
              `  confidence: per-field confidence map (paths like "about", "roadmap.NOW[0].title")`,
              `  unrecognised: array of { heading, content } for headings you couldn't map`,
              "",
              "---",
              body,
            ].join("\n"),
          },
        ],
        temperature: 0,
      });

      const usage = response.usage;
      const content = response.choices[0]?.message?.content;
      if (!content) {
        this.recordMetric({
          source: "azure-openai",
          outcome: "failure",
          latencyMs: Date.now() - startedAt,
          model: this.deployment,
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens,
          failureReason: "Model returned no content",
        });
        return {
          ok: false,
          source: "azure-openai",
          reason: "Model returned no content",
        };
      }

      let parsed: {
        output?: unknown;
        confidence?: ConfidenceFlags;
        unrecognised?: UnrecognisedSection[];
      };
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        const reason = `Model response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`;
        this.recordMetric({
          source: "azure-openai",
          outcome: "failure",
          latencyMs: Date.now() - startedAt,
          model: this.deployment,
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens,
          failureReason: reason,
        });
        return {
          ok: false,
          source: "azure-openai",
          reason,
        };
      }

      if (!parsed.output || typeof parsed.output !== "object") {
        const reason = "Model response missing 'output' field";
        this.recordMetric({
          source: "azure-openai",
          outcome: "failure",
          latencyMs: Date.now() - startedAt,
          model: this.deployment,
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens,
          failureReason: reason,
        });
        return {
          ok: false,
          source: "azure-openai",
          reason,
        };
      }

      const kind = frontMatter.type;
      // Tag the parsed body with the right discriminator. The model
      // returns the body shape; we wrap it in the same union the
      // template parser uses (`{ kind, body }` for domain/team/product,
      // `{ kind, about }` for jurisdiction).
      const output =
        kind === "jurisdiction"
          ? { kind, about: (parsed.output as { about?: string }).about }
          : { kind, body: parsed.output as never };

      this.recordMetric({
        source: "azure-openai",
        outcome: "success",
        latencyMs: Date.now() - startedAt,
        model: this.deployment,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
      });

      return {
        ok: true,
        source: "azure-openai",
        frontMatter,
        output,
        confidence: parsed.confidence ?? {},
        unrecognised: parsed.unrecognised ?? [],
      };
    } catch (err) {
      const reason = `Azure OpenAI request failed: ${err instanceof Error ? err.message : String(err)}`;
      this.recordMetric({
        source: "azure-openai",
        outcome: "failure",
        latencyMs: Date.now() - startedAt,
        model: this.deployment,
        failureReason: reason,
      });
      return {
        ok: false,
        source: "azure-openai",
        reason,
      };
    }
  }
}

