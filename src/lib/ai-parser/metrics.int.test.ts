import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  getBudgetStatus,
  getDailyParseMetrics,
  recordParseMetric,
} from "./metrics";

// Integration tests for the AI cost monitoring writer + readers per
// Phase 2 task 2.13. Needs a real Postgres with the
// `ai_parse_metric` migration applied — see vitest.int.config.ts.

async function truncate() {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "AiParseMetric" RESTART IDENTITY',
  );
}

beforeEach(async () => {
  await truncate();
  delete process.env.AI_PARSE_BUDGET_TOKENS_PER_DAY;
});

afterAll(async () => {
  await truncate();
  delete process.env.AI_PARSE_BUDGET_TOKENS_PER_DAY;
  await db.$disconnect();
});

describe("recordParseMetric", () => {
  it("inserts a row with the fields populated", async () => {
    await recordParseMetric({
      source: "azure-openai",
      outcome: "success",
      latencyMs: 234,
      model: "gpt-4o-mini",
      promptTokens: 1200,
      completionTokens: 340,
      totalTokens: 1540,
      submissionId: null,
    });

    const rows = await db.aiParseMetric.findMany();
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.source).toBe("azure-openai");
    expect(r.outcome).toBe("success");
    expect(r.latencyMs).toBe(234);
    expect(r.model).toBe("gpt-4o-mini");
    expect(r.promptTokens).toBe(1200);
    expect(r.completionTokens).toBe(340);
    expect(r.totalTokens).toBe(1540);
    expect(r.failureReason).toBeNull();
    expect(r.submissionId).toBeNull();
    expect(r.createdAt).toBeInstanceOf(Date);
  });

  it("records the failure path with no token counts", async () => {
    await recordParseMetric({
      source: "strict-template",
      outcome: "failure",
      latencyMs: 5,
      failureReason: "Front-matter invalid: missing `type`",
    });

    const r = (await db.aiParseMetric.findMany())[0]!;
    expect(r.outcome).toBe("failure");
    expect(r.promptTokens).toBeNull();
    expect(r.completionTokens).toBeNull();
    expect(r.totalTokens).toBeNull();
    expect(r.failureReason).toBe("Front-matter invalid: missing `type`");
  });
});

describe("append-only invariant", () => {
  it("rejects UPDATE on a metric row", async () => {
    await recordParseMetric({
      source: "strict-template",
      outcome: "success",
      latencyMs: 5,
    });
    const r = (await db.aiParseMetric.findMany())[0]!;

    await expect(
      db.aiParseMetric.update({
        where: { id: r.id },
        data: { outcome: "failure" },
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it("rejects DELETE on a metric row", async () => {
    await recordParseMetric({
      source: "strict-template",
      outcome: "success",
      latencyMs: 5,
    });
    const r = (await db.aiParseMetric.findMany())[0]!;

    await expect(
      db.aiParseMetric.delete({ where: { id: r.id } }),
    ).rejects.toThrow(/append-only/i);
  });
});

describe("getDailyParseMetrics", () => {
  it("aggregates by day and source", async () => {
    await recordParseMetric({
      source: "azure-openai",
      outcome: "success",
      latencyMs: 200,
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    await recordParseMetric({
      source: "azure-openai",
      outcome: "failure",
      latencyMs: 100,
      promptTokens: 80,
      completionTokens: 0,
      totalTokens: 80,
      failureReason: "Model returned no content",
    });
    await recordParseMetric({
      source: "strict-template",
      outcome: "success",
      latencyMs: 5,
    });

    const rows = await getDailyParseMetrics(7);
    expect(rows.length).toBe(2); // azure-openai + strict-template, same day

    const azure = rows.find((r) => r.source === "azure-openai")!;
    expect(azure.parseCount).toBe(2);
    expect(azure.successCount).toBe(1);
    expect(azure.failureCount).toBe(1);
    expect(azure.promptTokens).toBe(180);
    expect(azure.completionTokens).toBe(50);
    expect(azure.totalTokens).toBe(230);
    expect(azure.avgLatencyMs).toBeGreaterThan(0);

    const fallback = rows.find((r) => r.source === "strict-template")!;
    expect(fallback.parseCount).toBe(1);
    expect(fallback.promptTokens).toBe(0);
    expect(fallback.totalTokens).toBe(0);
  });

  it("returns an empty array when no parses recorded", async () => {
    const rows = await getDailyParseMetrics(14);
    expect(rows).toEqual([]);
  });
});

describe("getBudgetStatus", () => {
  it("returns budget=null when AI_PARSE_BUDGET_TOKENS_PER_DAY is unset", async () => {
    const status = await getBudgetStatus();
    expect(status.budgetTokensPerDay).toBeNull();
    expect(status.exceeded).toBe(false);
    expect(status.todayTokens).toBe(0);
  });

  it("returns exceeded=true when today's tokens cross the configured budget", async () => {
    process.env.AI_PARSE_BUDGET_TOKENS_PER_DAY = "200";
    await recordParseMetric({
      source: "azure-openai",
      outcome: "success",
      latencyMs: 100,
      totalTokens: 150,
    });
    await recordParseMetric({
      source: "azure-openai",
      outcome: "success",
      latencyMs: 100,
      totalTokens: 80,
    });

    const status = await getBudgetStatus();
    expect(status.budgetTokensPerDay).toBe(200);
    expect(status.todayTokens).toBe(230);
    expect(status.exceeded).toBe(true);
  });

  it("returns exceeded=false when today is under budget", async () => {
    process.env.AI_PARSE_BUDGET_TOKENS_PER_DAY = "1000";
    await recordParseMetric({
      source: "azure-openai",
      outcome: "success",
      latencyMs: 100,
      totalTokens: 250,
    });

    const status = await getBudgetStatus();
    expect(status.exceeded).toBe(false);
  });

  it("ignores non-integer or non-positive env values", async () => {
    process.env.AI_PARSE_BUDGET_TOKENS_PER_DAY = "not-a-number";
    let status = await getBudgetStatus();
    expect(status.budgetTokensPerDay).toBeNull();

    process.env.AI_PARSE_BUDGET_TOKENS_PER_DAY = "0";
    status = await getBudgetStatus();
    expect(status.budgetTokensPerDay).toBeNull();

    process.env.AI_PARSE_BUDGET_TOKENS_PER_DAY = "-50";
    status = await getBudgetStatus();
    expect(status.budgetTokensPerDay).toBeNull();
  });
});
