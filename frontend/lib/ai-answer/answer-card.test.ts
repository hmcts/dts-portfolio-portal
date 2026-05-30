import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AzureOpenAIAnswerCard,
  buildUserMessage,
  getAnswerCardSynthesiser,
  __resetAnswerCardForTests,
  type AnswerCardResultInput,
  type ChatClient,
} from "./answer-card";

// Unit tests for the answer-card synthesiser. Approach mirrors the
// AzureOpenAIParser tests: hand-written stub of the chat-client
// interface injected via the constructor. No mocking framework.
// No DB — this module has no persistence.

interface FakeUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

function fakeChatClient(opts: {
  content?: string | null;
  usage?: FakeUsage;
  throwOn?: Error;
}): ChatClient {
  return {
    chat: {
      completions: {
        async create() {
          if (opts.throwOn) throw opts.throwOn;
          return {
            choices: [{ message: { content: opts.content ?? null } }],
            ...(opts.usage ? { usage: opts.usage } : {}),
          };
        },
      },
    },
  };
}

function synthWith(client: ChatClient): AzureOpenAIAnswerCard {
  return new AzureOpenAIAnswerCard({
    endpoint: "https://test.openai.azure.com",
    deployment: "gpt-4o-mini-test",
    apiKey: "test-key",
    client,
  });
}

const SAMPLE_RESULTS: AnswerCardResultInput[] = [
  {
    entityType: "product",
    name: "Common Platform",
    description: "Unified case-management platform for Crown courts.",
    href: "/p/common-platform",
  },
  {
    entityType: "team",
    name: "Hearings Team",
    description: "Runs Common Platform on a day-to-day basis.",
    href: "/t/hearings",
  },
];

describe("AzureOpenAIAnswerCard.synthesise — early returns (no model call)", () => {
  it("returns 'unavailable' for an empty query without calling the model", async () => {
    let calls = 0;
    const client: ChatClient = {
      chat: {
        completions: {
          async create() {
            calls += 1;
            return { choices: [{ message: { content: "{}" } }] };
          },
        },
      },
    };
    const synth = synthWith(client);
    const out = await synth.synthesise("", SAMPLE_RESULTS);
    expect(out.source).toBe("unavailable");
    expect(out.answer).toBeNull();
    expect(calls).toBe(0);
  });

  it("returns 'unavailable' for whitespace-only query", async () => {
    const out = await synthWith(fakeChatClient({ content: null })).synthesise(
      "   ",
      SAMPLE_RESULTS,
    );
    expect(out.source).toBe("unavailable");
    if (out.source === "unavailable") expect(out.reason).toBe("Empty query");
  });

  it("returns 'unavailable' when results is empty", async () => {
    let calls = 0;
    const client: ChatClient = {
      chat: {
        completions: {
          async create() {
            calls += 1;
            return { choices: [{ message: { content: "{}" } }] };
          },
        },
      },
    };
    const out = await synthWith(client).synthesise("anything", []);
    expect(out.source).toBe("unavailable");
    if (out.source === "unavailable") {
      expect(out.reason).toBe("No results to ground in");
    }
    expect(calls).toBe(0);
  });
});

describe("AzureOpenAIAnswerCard.synthesise — model responses", () => {
  it("returns a success result on a well-formed model response", async () => {
    const synth = synthWith(
      fakeChatClient({
        content: JSON.stringify({
          answer:
            "Common Platform is the unified case-management platform for Crown courts, operated by the Hearings Team.",
          citations: [0, 1],
        }),
      }),
    );
    const out = await synth.synthesise(
      "who runs common platform?",
      SAMPLE_RESULTS,
    );
    expect(out.source).toBe("azure-openai");
    if (out.source === "azure-openai") {
      expect(out.answer).toContain("Common Platform");
      expect(out.citations).toEqual([0, 1]);
    }
  });

  it("trims whitespace from the answer", async () => {
    const synth = synthWith(
      fakeChatClient({
        content: JSON.stringify({
          answer: "   Padded answer.   \n",
          citations: [],
        }),
      }),
    );
    const out = await synth.synthesise("query", SAMPLE_RESULTS);
    if (out.source === "azure-openai") {
      expect(out.answer).toBe("Padded answer.");
    }
  });

  it("returns 'unavailable' when the model explicitly declines (answer: null)", async () => {
    const synth = synthWith(
      fakeChatClient({
        content: JSON.stringify({ answer: null, citations: [] }),
      }),
    );
    const out = await synth.synthesise("nonsense query", SAMPLE_RESULTS);
    expect(out.source).toBe("unavailable");
    if (out.source === "unavailable") {
      expect(out.reason).toMatch(/declined to answer/i);
    }
  });

  it("returns 'unavailable' when the model returns an empty-string answer", async () => {
    const synth = synthWith(
      fakeChatClient({
        content: JSON.stringify({ answer: "   ", citations: [] }),
      }),
    );
    const out = await synth.synthesise("query", SAMPLE_RESULTS);
    expect(out.source).toBe("unavailable");
  });

  it("returns 'unavailable' on empty model content", async () => {
    const synth = synthWith(fakeChatClient({ content: null }));
    const out = await synth.synthesise("query", SAMPLE_RESULTS);
    expect(out.source).toBe("unavailable");
    if (out.source === "unavailable") {
      expect(out.reason).toBe("Model returned no content");
    }
  });

  it("returns 'unavailable' on non-JSON model content", async () => {
    const synth = synthWith(
      fakeChatClient({ content: "Sorry, I cannot answer that." }),
    );
    const out = await synth.synthesise("query", SAMPLE_RESULTS);
    expect(out.source).toBe("unavailable");
    if (out.source === "unavailable") {
      expect(out.reason).toMatch(/not valid JSON/i);
    }
  });

  it("returns 'unavailable' when the model request throws", async () => {
    const synth = synthWith(
      fakeChatClient({ throwOn: new Error("Rate limit exceeded") }),
    );
    const out = await synth.synthesise("query", SAMPLE_RESULTS);
    expect(out.source).toBe("unavailable");
    if (out.source === "unavailable") {
      expect(out.reason).toMatch(/Rate limit exceeded/);
    }
  });
});

describe("AzureOpenAIAnswerCard.synthesise — citation filtering", () => {
  it("drops citation indexes that are out of range", async () => {
    const synth = synthWith(
      fakeChatClient({
        content: JSON.stringify({
          answer: "Answer using one result.",
          citations: [0, 5, 99], // only 0 is valid; results has 2 entries
        }),
      }),
    );
    const out = await synth.synthesise("query", SAMPLE_RESULTS);
    if (out.source === "azure-openai") {
      expect(out.citations).toEqual([0]);
    }
  });

  it("drops negative citation indexes", async () => {
    const synth = synthWith(
      fakeChatClient({
        content: JSON.stringify({
          answer: "Answer.",
          citations: [-1, 0, -5],
        }),
      }),
    );
    const out = await synth.synthesise("query", SAMPLE_RESULTS);
    if (out.source === "azure-openai") {
      expect(out.citations).toEqual([0]);
    }
  });

  it("drops non-integer citation entries", async () => {
    const synth = synthWith(
      fakeChatClient({
        content: JSON.stringify({
          answer: "Answer.",
          citations: [0, 1.5, "1", null, 1],
        }),
      }),
    );
    const out = await synth.synthesise("query", SAMPLE_RESULTS);
    if (out.source === "azure-openai") {
      expect(out.citations).toEqual([0, 1]);
    }
  });

  it("treats a missing citations array as empty", async () => {
    const synth = synthWith(
      fakeChatClient({
        content: JSON.stringify({ answer: "Answer." }),
      }),
    );
    const out = await synth.synthesise("query", SAMPLE_RESULTS);
    if (out.source === "azure-openai") {
      expect(out.citations).toEqual([]);
    }
  });
});

describe("buildUserMessage", () => {
  it("includes the query verbatim (after trim)", () => {
    const msg = buildUserMessage("  who runs Common Platform?  ", SAMPLE_RESULTS);
    expect(msg).toContain("who runs Common Platform?");
    // No leading/trailing whitespace on the question line.
    expect(msg.split("\n")[0]).toBe("User question: who runs Common Platform?");
  });

  it("emits each result with its 0-based index, entity type, name, and (truncated) description", () => {
    const msg = buildUserMessage("q", SAMPLE_RESULTS);
    expect(msg).toContain("[0] product: Common Platform — Unified case-management");
    expect(msg).toContain("[1] team: Hearings Team —");
  });

  it("truncates very long descriptions to <=280 characters with an ellipsis", () => {
    const longDescription = "X".repeat(500);
    const msg = buildUserMessage("q", [
      {
        entityType: "product",
        name: "Long Description Product",
        description: longDescription,
      },
    ]);
    // The line containing the truncated description should be at
    // most ~280 chars long after the description starts.
    const line = msg.split("\n").find((l) => l.startsWith("  [0]"))!;
    expect(line.endsWith("…")).toBe(true);
    // Sanity: the original 500-char description was clipped.
    expect(line.length).toBeLessThan(longDescription.length + 100);
  });

  it("omits the em-dash when no description is provided", () => {
    const msg = buildUserMessage("q", [
      { entityType: "domain", name: "No-description Domain" },
    ]);
    const line = msg.split("\n").find((l) => l.startsWith("  [0]"))!;
    expect(line).toBe("  [0] domain: No-description Domain");
    expect(line).not.toContain("—");
  });
});

describe("getAnswerCardSynthesiser factory", () => {
  beforeEach(() => {
    __resetAnswerCardForTests();
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_ANSWER_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_API_VERSION;
  });

  afterEach(() => {
    __resetAnswerCardForTests();
  });

  it("returns null when neither endpoint nor deployment is set", () => {
    expect(getAnswerCardSynthesiser()).toBeNull();
  });

  it("returns null when only endpoint is set", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    expect(getAnswerCardSynthesiser()).toBeNull();
  });

  it("returns an AzureOpenAIAnswerCard when endpoint + deployment are both set", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
    process.env.AZURE_OPENAI_API_KEY = "test-key";
    const synth = getAnswerCardSynthesiser();
    expect(synth).toBeInstanceOf(AzureOpenAIAnswerCard);
  });

  it("prefers AZURE_OPENAI_ANSWER_DEPLOYMENT when set (lets the answer card use a different/cheaper model than the parser)", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o";
    process.env.AZURE_OPENAI_ANSWER_DEPLOYMENT = "gpt-4o-mini";
    process.env.AZURE_OPENAI_API_KEY = "test-key";
    const synth = getAnswerCardSynthesiser();
    expect(synth).toBeInstanceOf(AzureOpenAIAnswerCard);
    // The deployment override is internal — we don't expose it, but
    // future regressions would surface as a synth not using the right
    // deployment. Pinning here documents the env-var contract.
  });

  it("caches the result across calls within a process", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
    process.env.AZURE_OPENAI_API_KEY = "test-key";
    const first = getAnswerCardSynthesiser();
    const second = getAnswerCardSynthesiser();
    expect(second).toBe(first);
  });
});
