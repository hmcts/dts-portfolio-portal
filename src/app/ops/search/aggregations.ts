import type { DailySearchVolume } from "@/lib/search/analytics";

// Pure aggregation helpers for the /ops/search dashboard. Extracted
// from page.tsx so they can be unit-tested in isolation.

export interface VolumeTotals {
  queries: number;
  clicks: number;
}

// Sums queries and clicks across every day. Used for the activity
// tile strip.
export function summariseVolume(rows: DailySearchVolume[]): VolumeTotals {
  return rows.reduce<VolumeTotals>(
    (acc, d) => ({
      queries: acc.queries + d.queries,
      clicks: acc.clicks + d.clicks,
    }),
    { queries: 0, clicks: 0 },
  );
}

// Click-through rate as a fraction (0..1). Guards against divide-by-
// zero when there have been no queries yet — without the guard the
// dashboard would render "NaN%" rather than "0.0%".
export function computeCtr(totals: VolumeTotals): number {
  if (totals.queries === 0) return 0;
  return totals.clicks / totals.queries;
}

// Display helper: turns the fraction into the "12.3%" string used on
// the tile. One decimal place is the level of precision that's
// useful on a 14-day window — more is noise.
export function formatCtr(ctr: number): string {
  return `${(ctr * 100).toFixed(1)}%`;
}
