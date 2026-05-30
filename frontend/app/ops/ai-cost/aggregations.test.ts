import { describe, expect, it } from "vitest";
import type { DailyParseMetric } from "@/lib/ai-parser/metrics";
import { buildDayRows, summarise } from "./aggregations";

// Unit tests for the AI cost dashboard's pure aggregation helpers.
// These were inline in page.tsx originally; extracting them lets us
// pin the totals + sort contract without rendering the page.

function row(overrides: Partial<DailyParseMetric>): DailyParseMetric {
  return {
    day: "2026-05-20",
    source: "azure-openai",
    parseCount: 0,
    successCount: 0,
    failureCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    avgLatencyMs: 0,
    ...overrides,
  };
}

describe("summarise", () => {
  it("returns zeros for an empty input", () => {
    expect(summarise([])).toEqual({
      parses: 0,
      successes: 0,
      failures: 0,
      totalTokens: 0,
    });
  });

  it("sums each field across rows", () => {
    const result = summarise([
      row({ parseCount: 3, successCount: 2, failureCount: 1, totalTokens: 500 }),
      row({ parseCount: 4, successCount: 4, failureCount: 0, totalTokens: 800 }),
      row({ parseCount: 1, successCount: 0, failureCount: 1, totalTokens: 0 }),
    ]);
    expect(result).toEqual({
      parses: 8,
      successes: 6,
      failures: 2,
      totalTokens: 1300,
    });
  });

  it("treats successCount + failureCount as independent fields (does not assume they sum to parseCount)", () => {
    // The DB-side aggregation could in principle produce
    // parseCount != success+failure if an outcome value slipped in
    // that isn't 'success' or 'failure'. summarise should still
    // total each column independently rather than inferring.
    const result = summarise([
      row({ parseCount: 10, successCount: 8, failureCount: 1 }),
    ]);
    expect(result.parses).toBe(10);
    expect(result.successes).toBe(8);
    expect(result.failures).toBe(1);
  });
});

describe("buildDayRows", () => {
  it("returns an empty array unchanged", () => {
    expect(buildDayRows([])).toEqual([]);
  });

  it("sorts cross-day rows newest day first", () => {
    const rows = [
      row({ day: "2026-05-18", source: "azure-openai" }),
      row({ day: "2026-05-20", source: "azure-openai" }),
      row({ day: "2026-05-19", source: "azure-openai" }),
    ];
    const sorted = buildDayRows(rows);
    expect(sorted.map((r) => r.day)).toEqual([
      "2026-05-20",
      "2026-05-19",
      "2026-05-18",
    ]);
  });

  it("within a single day, sorts sources alphabetically (azure-openai before strict-template)", () => {
    const rows = [
      row({ day: "2026-05-20", source: "strict-template" }),
      row({ day: "2026-05-20", source: "azure-openai" }),
    ];
    const sorted = buildDayRows(rows);
    expect(sorted.map((r) => r.source)).toEqual([
      "azure-openai",
      "strict-template",
    ]);
  });

  it("combines both: day desc, then source asc within each day", () => {
    const rows = [
      row({ day: "2026-05-19", source: "strict-template", parseCount: 1 }),
      row({ day: "2026-05-20", source: "strict-template", parseCount: 2 }),
      row({ day: "2026-05-19", source: "azure-openai", parseCount: 3 }),
      row({ day: "2026-05-20", source: "azure-openai", parseCount: 4 }),
    ];
    const sorted = buildDayRows(rows);
    // Expected order: (20, azure), (20, strict), (19, azure), (19, strict)
    expect(sorted.map((r) => `${r.day}/${r.source}`)).toEqual([
      "2026-05-20/azure-openai",
      "2026-05-20/strict-template",
      "2026-05-19/azure-openai",
      "2026-05-19/strict-template",
    ]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      row({ day: "2026-05-18" }),
      row({ day: "2026-05-20" }),
    ];
    const snapshot = rows.map((r) => r.day);
    buildDayRows(rows);
    expect(rows.map((r) => r.day)).toEqual(snapshot);
  });
});
