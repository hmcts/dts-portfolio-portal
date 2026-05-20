import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  getDailySearchVolume,
  getUnclickedQueries,
  getZeroResultQueries,
  recordSearchClick,
  recordSearchQuery,
} from "./analytics";

// Integration tests for the search analytics writer + readers per
// Phase 3 task 3.7. Needs a real Postgres with the
// `search_event` migration applied.

async function truncate() {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "SearchEvent" RESTART IDENTITY',
  );
}

beforeEach(truncate);

afterAll(async () => {
  await truncate();
  await db.$disconnect();
});

describe("recordSearchQuery", () => {
  it("inserts a row with normalised query text", async () => {
    await recordSearchQuery({
      query: "  Common  Platform  ",
      resultCount: 3,
    });
    const row = (await db.searchEvent.findMany())[0]!;
    expect(row.kind).toBe("query");
    expect(row.query).toBe("common platform"); // lowercased + collapsed whitespace
    expect(row.resultCount).toBe(3);
    expect(row.subjectHash).toBeNull();
  });

  it("hashes the subject and never stores the raw value", async () => {
    await recordSearchQuery({
      query: "common platform",
      resultCount: 3,
      subject: "alice@justice.gov.uk",
    });
    const row = (await db.searchEvent.findMany())[0]!;
    expect(row.subjectHash).not.toBe("alice@justice.gov.uk");
    expect(row.subjectHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("recordSearchClick", () => {
  it("inserts a click row alongside the original query", async () => {
    await recordSearchQuery({ query: "crime", resultCount: 5 });
    await recordSearchClick({
      query: "crime",
      clickedEntityType: "product",
      clickedEntityId: "abc123",
      clickedPosition: 1,
    });

    const rows = await db.searchEvent.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.kind).toBe("query");
    expect(rows[1]!.kind).toBe("click");
    expect(rows[1]!.clickedEntityType).toBe("product");
    expect(rows[1]!.clickedEntityId).toBe("abc123");
    expect(rows[1]!.clickedPosition).toBe(1);
  });

  it("hashes the subject for clicks and never stores the raw value", async () => {
    // Mirrors the equivalent recordSearchQuery test — same data-
    // minimisation contract applies to clicks (spec §8.4).
    await recordSearchClick({
      query: "crime",
      clickedEntityType: "product",
      clickedEntityId: "abc123",
      clickedPosition: 0,
      subject: "bob@justice.gov.uk",
    });
    const row = (await db.searchEvent.findMany())[0]!;
    expect(row.subjectHash).not.toBe("bob@justice.gov.uk");
    expect(row.subjectHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalises the click's query string the same way as recordSearchQuery", async () => {
    // The unclicked-query join uses LOWERCASED query text. If click
    // normalisation diverges from query normalisation, the join
    // breaks silently. Pin them to the same shape here.
    await recordSearchQuery({ query: "Common  Platform", resultCount: 3 });
    await recordSearchClick({
      query: "Common  Platform",
      clickedEntityType: "product",
      clickedEntityId: "x",
      clickedPosition: 0,
    });
    const rows = await db.searchEvent.findMany();
    expect(rows[0]!.query).toBe("common platform");
    expect(rows[1]!.query).toBe("common platform");
  });
});

describe("append-only invariant", () => {
  it("rejects UPDATE on a search event", async () => {
    await recordSearchQuery({ query: "crime", resultCount: 1 });
    const r = (await db.searchEvent.findMany())[0]!;

    await expect(
      db.searchEvent.update({
        where: { id: r.id },
        data: { resultCount: 999 },
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it("rejects DELETE on a search event", async () => {
    await recordSearchQuery({ query: "crime", resultCount: 1 });
    const r = (await db.searchEvent.findMany())[0]!;

    await expect(
      db.searchEvent.delete({ where: { id: r.id } }),
    ).rejects.toThrow(/append-only/i);
  });
});

describe("getZeroResultQueries", () => {
  it("returns an empty array when no zero-result queries have been recorded", async () => {
    await recordSearchQuery({ query: "all good", resultCount: 5 });
    const rows = await getZeroResultQueries(7);
    expect(rows).toEqual([]);
  });

  it("returns only queries with resultCount = 0, by occurrence", async () => {
    await recordSearchQuery({ query: "no matches yet", resultCount: 0 });
    await recordSearchQuery({ query: "no matches yet", resultCount: 0 });
    await recordSearchQuery({ query: "still nothing", resultCount: 0 });
    await recordSearchQuery({ query: "common platform", resultCount: 5 });

    const rows = await getZeroResultQueries(7);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.query).toBe("no matches yet");
    expect(rows[0]!.occurrences).toBe(2);
    expect(rows[1]!.query).toBe("still nothing");
    expect(rows[1]!.occurrences).toBe(1);
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      await recordSearchQuery({ query: `gap-${i}`, resultCount: 0 });
    }
    const rows = await getZeroResultQueries(7, 2);
    expect(rows).toHaveLength(2);
  });

  it("preserves punctuation distinctions in the normalised query", async () => {
    // The comment in analytics.ts explicitly says "Common Platform?"
    // and "Common Platform" should be distinct intent signals — pin
    // that contract.
    await recordSearchQuery({ query: "Common Platform?", resultCount: 0 });
    await recordSearchQuery({ query: "Common Platform", resultCount: 0 });
    const rows = await getZeroResultQueries(7);
    const queries = rows.map((r) => r.query).sort();
    expect(queries).toEqual(["common platform", "common platform?"]);
  });
});

describe("getUnclickedQueries", () => {
  it("returns queries with results but no follow-up click", async () => {
    // Query with click — should NOT appear
    await recordSearchQuery({ query: "common platform", resultCount: 5 });
    await new Promise((r) => setTimeout(r, 5));
    await recordSearchClick({
      query: "common platform",
      clickedEntityType: "product",
      clickedEntityId: "id-a",
      clickedPosition: 0,
    });

    // Query without click — should appear
    await recordSearchQuery({ query: "tribunals", resultCount: 3 });

    // Zero-result query — should NOT appear (it's in the other list)
    await recordSearchQuery({ query: "nothing useful", resultCount: 0 });

    const rows = await getUnclickedQueries(7);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.query).toBe("tribunals");
    expect(rows[0]!.topResultCount).toBe(3);
  });

  it("returns an empty array when no queries have results without clicks", async () => {
    const rows = await getUnclickedQueries(7);
    expect(rows).toEqual([]);
  });

  it("EXCLUDES a zero-result query even when there is no matching click (it belongs in getZeroResultQueries instead)", async () => {
    await recordSearchQuery({ query: "zero-only", resultCount: 0 });
    const unclicked = await getUnclickedQueries(7);
    const zero = await getZeroResultQueries(7);
    expect(unclicked).toEqual([]);
    expect(zero).toHaveLength(1);
    expect(zero[0]!.query).toBe("zero-only");
  });

  it("counts a click made within the 5-minute window as 'clicked' (excluded from unclicked)", async () => {
    await recordSearchQuery({ query: "in window", resultCount: 4 });
    // Click immediately afterwards — well inside the 5-minute window.
    await recordSearchClick({
      query: "in window",
      clickedEntityType: "team",
      clickedEntityId: "t1",
      clickedPosition: 0,
    });
    const rows = await getUnclickedQueries(7);
    expect(rows).toEqual([]);
  });

  it("EXCLUDES the query when a SECOND identical query had a click within its own 5-minute window", async () => {
    // Two queries of the same text. The FIRST has no follow-up click;
    // the SECOND has a click inside its 5-min window. The aggregator
    // groups by query text, so this entire query string is considered
    // 'clicked' — the user has been able to find something for that
    // intent, so it's not a relevance-triage candidate.
    await recordSearchQuery({ query: "double", resultCount: 2 });
    // (Time would normally pass here; in the test we just rely on
    // both being within the 5-min window of each other.)
    await recordSearchQuery({ query: "double", resultCount: 2 });
    await recordSearchClick({
      query: "double",
      clickedEntityType: "domain",
      clickedEntityId: "d1",
      clickedPosition: 0,
    });
    const rows = await getUnclickedQueries(7);
    expect(rows).toEqual([]);
  });
});

describe("getDailySearchVolume", () => {
  it("returns an empty array when no events have been recorded", async () => {
    const rows = await getDailySearchVolume(7);
    expect(rows).toEqual([]);
  });

  it("aggregates queries + clicks per UTC day", async () => {
    await recordSearchQuery({ query: "a", resultCount: 1 });
    await recordSearchQuery({ query: "b", resultCount: 0 });
    await recordSearchClick({
      query: "a",
      clickedEntityType: "product",
      clickedEntityId: "x",
      clickedPosition: 0,
    });

    const rows = await getDailySearchVolume(7);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.queries).toBe(2);
    expect(rows[0]!.clicks).toBe(1);
  });
});
