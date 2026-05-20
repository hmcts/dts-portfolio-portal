import { describe, expect, it } from "vitest";
import { portalContent } from "./seed";
import { getSidebarJurisdictions } from "./portal-data-seed";

// Direct tests for the SYNC seed-backed sidebar helper. PR #41
// fixed a bug where the sidebar's expand chevron rendered an empty
// section for Civil / Family / Tribunals / Administrative because
// the hardcoded JURISDICTIONS array only populated `domains` for
// Crime.
//
// PR #42's read-path swap made the public portal-data.ts wrapper
// async (DB-first, seed-fallback). The async wrapper is covered by
// portal-data.int.test.ts. This file covers the SYNC seed helper
// directly — it's the source of truth for the fallback path, so
// pinning it here means a regression in either the wrapper OR the
// seed reaches both test suites.

describe("getSidebarJurisdictions", () => {
  const result = getSidebarJurisdictions();

  it("returns one entry per Jurisdiction in the spec taxonomy", () => {
    expect(result.length).toBe(portalContent.jurisdictions.length);
    expect(result.length).toBe(5);
    expect(result.map((r) => r.slug).sort()).toEqual([
      "administrative",
      "civil",
      "crime",
      "family",
      "tribunals",
    ]);
  });

  it("every Jurisdiction's count matches its domains.length (the bug PR #41 fixed)", () => {
    // The pre-PR-41 sidebar had hardcoded counts that drifted out of
    // sync with the actual domain lists — that's exactly what this
    // assertion guards.
    for (const j of result) {
      expect(j.count, `jurisdiction '${j.slug}' count mismatch`).toBe(
        j.domains.length,
      );
    }
  });

  it("every Jurisdiction has a non-empty domains list", () => {
    // The previous hardcoded version had only Crime populated; the
    // others had no domains at all. The seed has at least one Domain
    // per Jurisdiction. This assertion catches a regression to that
    // empty-list state.
    for (const j of result) {
      expect(j.domains.length, `jurisdiction '${j.slug}' has no domains`).toBeGreaterThan(0);
    }
  });

  it("each domain entry has exactly `slug` and `name`", () => {
    for (const j of result) {
      for (const d of j.domains) {
        expect(typeof d.slug).toBe("string");
        expect(typeof d.name).toBe("string");
        expect(d.slug.length).toBeGreaterThan(0);
        expect(d.name.length).toBeGreaterThan(0);
      }
    }
  });

  it("matches what's actually in the seed (no drift between hardcoded list and seed)", () => {
    // Cross-check: for each Jurisdiction, the helper's domain
    // list should match the seed's filter directly. Same data,
    // same answer.
    for (const j of result) {
      const expected = portalContent.domains
        .filter((d) => d.jurisdictionSlug === j.slug)
        .map((d) => ({ slug: d.slug, name: d.name }));
      expect(j.domains).toEqual(expected);
    }
  });

  it("Crime has multiple domains (the only one that had any in the pre-fix hardcoded version)", () => {
    const crime = result.find((j) => j.slug === "crime")!;
    expect(crime.domains.length).toBeGreaterThanOrEqual(2);
  });
});
