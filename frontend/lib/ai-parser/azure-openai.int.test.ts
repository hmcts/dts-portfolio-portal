import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AzureOpenAIParser, type ChatClient } from "./azure-openai";

// Integration tests for AzureOpenAIParser's metric-recording branches
// (Phase 2 task 2.13). Each parse() exit point must write exactly
// one AiParseMetric row with the right outcome + reason + token
// counts. The metrics.int.test.ts file already covers the writer
// itself; this file covers whether the parser CALLS it on every
// path.
//
// Approach (per the project's testing preference): a hand-written
// FakeChatClient implementing the ChatClient interface, injected via
// the constructor. No mocking framework, no module-level monkey-
// patching — just an alternative implementation. The DB write side
// is fully real (the same docker-compose Postgres the rest of the
// integration suite hits).

async function truncate() {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "AiParseMetric" RESTART IDENTITY',
  );
}

beforeEach(truncate);
afterAll(async () => {
  await truncate();
  await db.$disconnect();
});

const GOOD_MARKDOWN = `---
type: team
name: Metrics Test Team
domain: common-platform
---

# About

A team document used only by the azure-openai recording tests.
`;

interface FakeUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

// Hand-written stub conforming to ChatClient. One canned response
// per test, plus an optional thrown error path. No vi.mock, no
// proxies — a real object whose methods do exactly what we tell
// them to.
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

function parserWith(client: ChatClient): AzureOpenAIParser {
  return new AzureOpenAIParser({
    endpoint: "https://test.openai.azure.com",
    deployment: "gpt-4o-mini-test",
    apiKey: "test-key",
    client,
  });
}

describe("AzureOpenAIParser metric recording", () => {
  it("records a success row with token counts on a happy parse", async () => {
    const parser = parserWith(
      fakeChatClient({
        content: JSON.stringify({
          output: {
            about: "We run hearings.",
            whatWeOperate: "Crown Court matters.",
            howToReachUs: "Slack #team",
            links: [],
          },
          confidence: { about: "high" },
          unrecognised: [],
        }),
        usage: {
          prompt_tokens: 1234,
          completion_tokens: 56,
          total_tokens: 1290,
        },
      }),
    );

    const result = await parser.parse(GOOD_MARKDOWN);
    await parser.flushMetricsForTests();

    expect(result.ok).toBe(true);

    const rows = await db.aiParseMetric.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "azure-openai",
      outcome: "success",
      model: "gpt-4o-mini-test",
      promptTokens: 1234,
      completionTokens: 56,
      totalTokens: 1290,
      failureReason: null,
    });
    expect(rows[0]!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("records failure with token counts when model returns empty content", async () => {
    const parser = parserWith(
      fakeChatClient({
        content: null,
        usage: { prompt_tokens: 800, completion_tokens: 0, total_tokens: 800 },
      }),
    );

    const result = await parser.parse(GOOD_MARKDOWN);
    await parser.flushMetricsForTests();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("Model returned no content");

    const rows = await db.aiParseMetric.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "azure-openai",
      outcome: "failure",
      promptTokens: 800,
      completionTokens: 0,
      totalTokens: 800,
      failureReason: "Model returned no content",
    });
  });

  it("records failure when model returns non-JSON content", async () => {
    const parser = parserWith(
      fakeChatClient({
        content: "I cannot output JSON, only prose.",
        usage: { prompt_tokens: 200, completion_tokens: 7, total_tokens: 207 },
      }),
    );

    const result = await parser.parse(GOOD_MARKDOWN);
    await parser.flushMetricsForTests();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Model response was not valid JSON/);
    }

    const row = (await db.aiParseMetric.findMany())[0]!;
    expect(row.outcome).toBe("failure");
    // Token counts must survive even when the parse fails — we get
    // charged for the tokens regardless of usefulness.
    expect(row.promptTokens).toBe(200);
    expect(row.completionTokens).toBe(7);
    expect(row.failureReason).toMatch(/not valid JSON/);
  });

  it("records failure when model JSON is missing the `output` field", async () => {
    const parser = parserWith(
      fakeChatClient({
        content: JSON.stringify({ confidence: {}, unrecognised: [] }),
        usage: { prompt_tokens: 300, completion_tokens: 20, total_tokens: 320 },
      }),
    );

    const result = await parser.parse(GOOD_MARKDOWN);
    await parser.flushMetricsForTests();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("Model response missing 'output' field");
    }

    const row = (await db.aiParseMetric.findMany())[0]!;
    expect(row.outcome).toBe("failure");
    expect(row.totalTokens).toBe(320);
    expect(row.failureReason).toBe("Model response missing 'output' field");
  });

  it("records failure on identity-parse failure WITHOUT calling the model", async () => {
    let creates = 0;
    const client: ChatClient = {
      chat: {
        completions: {
          async create() {
            creates += 1;
            return { choices: [{ message: { content: "{}" } }] };
          },
        },
      },
    };
    const parser = parserWith(client);

    // Front-matter is missing — identity parse rejects before any
    // model call.
    const result = await parser.parse("no front-matter, just body");
    await parser.flushMetricsForTests();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Front-matter invalid/);
    }
    expect(creates).toBe(0); // model was never called

    const row = (await db.aiParseMetric.findMany())[0]!;
    expect(row.outcome).toBe("failure");
    expect(row.promptTokens).toBeNull();
    expect(row.completionTokens).toBeNull();
    expect(row.totalTokens).toBeNull();
    expect(row.failureReason).toMatch(/Front-matter invalid/);
  });

  it("records failure when the model request itself throws", async () => {
    const parser = parserWith(
      fakeChatClient({
        throwOn: new Error("ECONNRESET"),
      }),
    );

    const result = await parser.parse(GOOD_MARKDOWN);
    await parser.flushMetricsForTests();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Azure OpenAI request failed/);
      expect(result.reason).toMatch(/ECONNRESET/);
    }

    const row = (await db.aiParseMetric.findMany())[0]!;
    expect(row.outcome).toBe("failure");
    expect(row.failureReason).toMatch(/ECONNRESET/);
    // No usage info available when the request itself bombs.
    expect(row.promptTokens).toBeNull();
  });

  it("never writes more than one metric row per parse() call", async () => {
    // Spot-check the success path doesn't accidentally double-record.
    const parser = parserWith(
      fakeChatClient({
        content: JSON.stringify({
          output: { about: "ok", links: [] },
          confidence: {},
          unrecognised: [],
        }),
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );

    await parser.parse(GOOD_MARKDOWN);
    await parser.parse(GOOD_MARKDOWN);
    await parser.flushMetricsForTests();

    expect(await db.aiParseMetric.count()).toBe(2);
  });
});
