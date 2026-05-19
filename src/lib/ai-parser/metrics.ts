import { db } from "@/lib/db";

// AI parse metrics writer + reader per Phase 2 task 2.13.
//
// Every parse() call inside an AiParser implementation records one
// row via recordParseMetric. The ops dashboard at /ops/ai-cost reads
// the aggregates via getDailyParseMetrics + getBudgetStatus.
//
// Recording is fire-and-forget at the call site: the parser doesn't
// await the insert (we don't want a DB hiccup to stall a parse),
// but the insert IS awaitable for tests that assert on persistence.

export type ParseOutcome = "success" | "failure";

export interface ParseMetricInput {
  source: string;
  outcome: ParseOutcome;
  latencyMs: number;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  failureReason?: string | null;
  submissionId?: string | null;
}

export interface DailyParseMetric {
  // ISO yyyy-mm-dd in UTC.
  day: string;
  source: string;
  parseCount: number;
  successCount: number;
  failureCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
}

export interface BudgetStatus {
  budgetTokensPerDay: number | null;
  todayTokens: number;
  // True when today's totalTokens has crossed the budget.
  // Always false when no budget is configured.
  exceeded: boolean;
}

// Inserts a metric row. Awaitable for tests, but call sites should
// generally fire-and-forget so a slow insert never blocks a parse.
export async function recordParseMetric(
  input: ParseMetricInput,
): Promise<void> {
  await db.aiParseMetric.create({
    data: {
      source: input.source,
      outcome: input.outcome,
      latencyMs: input.latencyMs,
      model: input.model ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      failureReason: input.failureReason ?? null,
      submissionId: input.submissionId ?? null,
    },
  });
}

// Aggregates per (day, source) for the trailing `days` UTC days,
// inclusive of today. Days with no parses are omitted from the
// result — the UI fills the gaps.
export async function getDailyParseMetrics(
  days: number,
): Promise<DailyParseMetric[]> {
  const rows = await db.$queryRawUnsafe<
    Array<{
      day: Date;
      source: string;
      parse_count: bigint;
      success_count: bigint;
      failure_count: bigint;
      prompt_tokens: bigint | null;
      completion_tokens: bigint | null;
      total_tokens: bigint | null;
      avg_latency_ms: number | null;
    }>
  >(
    `
    SELECT
      date_trunc('day', "createdAt")::date         AS day,
      "source"                                      AS source,
      COUNT(*)                                      AS parse_count,
      COUNT(*) FILTER (WHERE "outcome" = 'success') AS success_count,
      COUNT(*) FILTER (WHERE "outcome" = 'failure') AS failure_count,
      COALESCE(SUM("promptTokens"), 0)              AS prompt_tokens,
      COALESCE(SUM("completionTokens"), 0)          AS completion_tokens,
      COALESCE(SUM("totalTokens"), 0)               AS total_tokens,
      AVG("latencyMs")::float                       AS avg_latency_ms
    FROM "AiParseMetric"
    WHERE "createdAt" >= date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day'
    GROUP BY day, "source"
    ORDER BY day DESC, source ASC
  `,
    days,
  );
  return rows.map((r) => ({
    day: toIsoDate(r.day),
    source: r.source,
    parseCount: Number(r.parse_count),
    successCount: Number(r.success_count),
    failureCount: Number(r.failure_count),
    promptTokens: Number(r.prompt_tokens ?? 0),
    completionTokens: Number(r.completion_tokens ?? 0),
    totalTokens: Number(r.total_tokens ?? 0),
    avgLatencyMs: r.avg_latency_ms ?? 0,
  }));
}

// Returns whether today's token total has crossed the budget set in
// AI_PARSE_BUDGET_TOKENS_PER_DAY. When the env var isn't set or isn't
// a positive integer, budget tracking is disabled.
export async function getBudgetStatus(): Promise<BudgetStatus> {
  const raw = process.env.AI_PARSE_BUDGET_TOKENS_PER_DAY;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const budget = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  const rows = await db.$queryRawUnsafe<
    Array<{ total_tokens: bigint | null }>
  >(`
    SELECT COALESCE(SUM("totalTokens"), 0)::bigint AS total_tokens
    FROM "AiParseMetric"
    WHERE "createdAt" >= date_trunc('day', NOW())
  `);
  const todayTokens = Number(rows[0]?.total_tokens ?? 0);
  return {
    budgetTokensPerDay: budget,
    todayTokens,
    exceeded: budget !== null && todayTokens > budget,
  };
}

function toIsoDate(d: Date): string {
  // YYYY-MM-DD slice of the UTC ISO string keeps the dashboard
  // aligned with the date_trunc('day', ...) bucketing above. Using
  // toLocaleDateString here would surface server-timezone surprises.
  return d.toISOString().slice(0, 10);
}
