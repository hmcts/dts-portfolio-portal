import { describe, expect, it } from "vitest";
import type { DailySearchVolume } from "@/lib/search/analytics";
import { computeCtr, formatCtr, summariseVolume } from "./aggregations";

// Unit tests for the /ops/search dashboard's pure aggregation
// helpers. Extracted from page.tsx so we can pin contracts that
// would otherwise be exercised only via e2e — most importantly the
// divide-by-zero guard on the click-through-rate calculation.

function day(overrides: Partial<DailySearchVolume>): DailySearchVolume {
  return {
    day: "2026-05-20",
    queries: 0,
    clicks: 0,
    ...overrides,
  };
}

describe("summariseVolume", () => {
  it("returns zeros for an empty input", () => {
    expect(summariseVolume([])).toEqual({ queries: 0, clicks: 0 });
  });

  it("sums queries and clicks across days", () => {
    const result = summariseVolume([
      day({ day: "2026-05-20", queries: 10, clicks: 4 }),
      day({ day: "2026-05-19", queries: 6, clicks: 1 }),
      day({ day: "2026-05-18", queries: 0, clicks: 0 }),
    ]);
    expect(result).toEqual({ queries: 16, clicks: 5 });
  });

  it("treats queries and clicks independently (does not assume any relationship)", () => {
    // It's legitimate for clicks > queries within a day if a user
    // clicked multiple results from the same query, or for clicks
    // = 0 with many queries (zero-result heavy). The reducer must
    // not coerce or cap either field.
    const result = summariseVolume([
      day({ queries: 1, clicks: 5 }),
      day({ queries: 100, clicks: 0 }),
    ]);
    expect(result.queries).toBe(101);
    expect(result.clicks).toBe(5);
  });
});

describe("computeCtr", () => {
  it("returns 0 when queries is 0 (divide-by-zero guard)", () => {
    // Without the guard, the dashboard would render "NaN%". This is
    // the load-bearing behaviour the e2e suite can't easily reach
    // (the seeded-data e2e always has queries > 0 by construction).
    expect(computeCtr({ queries: 0, clicks: 0 })).toBe(0);
    // Defensive: even if clicks > 0 with queries = 0 (a corrupt
    // state), the guard still kicks in.
    expect(computeCtr({ queries: 0, clicks: 5 })).toBe(0);
  });

  it("returns clicks / queries when queries > 0", () => {
    expect(computeCtr({ queries: 10, clicks: 4 })).toBe(0.4);
    expect(computeCtr({ queries: 100, clicks: 25 })).toBe(0.25);
  });

  it("allows CTR > 1 (multiple clicks per query is legitimate)", () => {
    // Not a bug — a user can click several results from the same
    // search. The dashboard's tile would render >100% but that's
    // an honest signal worth surfacing.
    expect(computeCtr({ queries: 10, clicks: 25 })).toBe(2.5);
  });
});

describe("formatCtr", () => {
  it("renders the fraction as a percentage with one decimal", () => {
    expect(formatCtr(0)).toBe("0.0%");
    expect(formatCtr(0.5)).toBe("50.0%");
    expect(formatCtr(0.123)).toBe("12.3%");
    expect(formatCtr(1)).toBe("100.0%");
  });

  it("rounds to one decimal place", () => {
    expect(formatCtr(0.12345)).toBe("12.3%");
    expect(formatCtr(0.12678)).toBe("12.7%");
  });
});
