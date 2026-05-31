// Write-path AI parse metrics module — unavailable during the write-path
// re-platform. The Prisma client has been removed in the Group K cutover.
//
// The ops/ai-cost dashboard now reads aggregates from the Python backend.

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

// DailyParseMetric is now also exported from @/lib/types.
// Re-exported here for any remaining local consumers.
export type { DailyParseMetric } from "@/lib/types";

export interface BudgetStatus {
  budgetTokensPerDay: number | null;
  todayTokens: number;
  exceeded: boolean;
}

export async function recordParseMetric(
  _input: ParseMetricInput,
): Promise<void> {
  throw new Error(
    "AI parse metrics write path unavailable: Prisma client removed in Group K cutover.",
  );
}

export async function getDailyParseMetrics(
  _days: number,
): Promise<import("@/lib/types").DailyParseMetric[]> {
  throw new Error(
    "AI parse metrics read path unavailable: Prisma client removed in Group K cutover.",
  );
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
  throw new Error(
    "AI parse budget status unavailable: Prisma client removed in Group K cutover.",
  );
}
