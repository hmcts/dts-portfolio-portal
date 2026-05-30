import type { DailyParseMetric } from "@/lib/types";

// Pure aggregation helpers for the AI cost dashboard. Extracted from
// `page.tsx` so they can be unit-tested in isolation — the page
// itself is a Next.js server component, which is harder to assert
// against than a plain function.
//
// Both helpers are idempotent and free of side effects.

export interface ParseTotals {
  parses: number;
  successes: number;
  failures: number;
  totalTokens: number;
}

// Sums the counts and tokens across every row. Used for the
// trailing-N-days tile strip.
export function summarise(rows: DailyParseMetric[]): ParseTotals {
  return rows.reduce<ParseTotals>(
    (acc, r) => ({
      parses: acc.parses + r.parseCount,
      successes: acc.successes + r.successCount,
      failures: acc.failures + r.failureCount,
      totalTokens: acc.totalTokens + r.totalTokens,
    }),
    { parses: 0, successes: 0, failures: 0, totalTokens: 0 },
  );
}

// Sort by day desc, source asc — matches the SQL ORDER BY in the
// metrics module. Doing it here too means a test that exercises the
// page directly (without hitting the SQL ORDER BY) still sees a
// stable, predictable row order.
export function buildDayRows(rows: DailyParseMetric[]): DailyParseMetric[] {
  return [...rows].sort((a, b) => {
    if (a.day !== b.day) return b.day.localeCompare(a.day);
    return a.source.localeCompare(b.source);
  });
}
