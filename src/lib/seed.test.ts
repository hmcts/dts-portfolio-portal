import { describe, expect, it } from "vitest";
import { portalContent } from "./seed";
import { PortalContent } from "./entities";
import { getMatrix, getJurisdictionCounts } from "./portal-data";

describe("portalContent seed", () => {
  it("parses cleanly against the PortalContent schema", () => {
    expect(() => PortalContent.parse(portalContent)).not.toThrow();
  });

  it("covers all five Jurisdictions in the spec fixed taxonomy", () => {
    const slugs = portalContent.jurisdictions.map((j) => j.slug).sort();
    expect(slugs).toEqual([
      "administrative",
      "civil",
      "crime",
      "family",
      "tribunals",
    ]);
  });

  it("meets the spec's minimum seed counts for the demo (§Task 1.6)", () => {
    expect(portalContent.jurisdictions.length).toBeGreaterThanOrEqual(2);
    expect(portalContent.domains.length).toBeGreaterThanOrEqual(4);
    expect(portalContent.teams.length).toBeGreaterThanOrEqual(6);
    expect(portalContent.products.length).toBeGreaterThanOrEqual(12);
    expect(portalContent.initiatives.length).toBeGreaterThanOrEqual(30);
  });

  it("has at least one cross-Jurisdiction consumed-by relationship", () => {
    const hasCross = portalContent.products.some(
      (p) => p.consumedBy && p.consumedBy.length > 0,
    );
    expect(hasCross).toBe(true);
  });

  it("every Product references an existing Domain", () => {
    const domainSlugs = new Set(portalContent.domains.map((d) => d.slug));
    for (const p of portalContent.products) {
      expect(domainSlugs.has(p.domainSlug)).toBe(true);
    }
  });

  it("every Product references an existing operating Team", () => {
    const teamSlugs = new Set(portalContent.teams.map((t) => t.slug));
    for (const p of portalContent.products) {
      expect(teamSlugs.has(p.operatingTeamSlug)).toBe(true);
    }
  });

  it("every Initiative references an existing Product", () => {
    const productIds = new Set(portalContent.products.map((p) => p.id));
    for (const i of portalContent.initiatives) {
      expect(productIds.has(i.productId)).toBe(true);
    }
  });

  it("every Domain belongs to a known Jurisdiction", () => {
    const jurisdictionSlugs = new Set(
      portalContent.jurisdictions.map((j) => j.slug),
    );
    for (const d of portalContent.domains) {
      expect(jurisdictionSlugs.has(d.jurisdictionSlug)).toBe(true);
    }
  });
});

describe("getMatrix", () => {
  it("returns a band per Jurisdiction", () => {
    const matrix = getMatrix();
    expect(matrix.length).toBe(portalContent.jurisdictions.length);
  });

  it("groups Initiative chips by Domain × TimeBucket", () => {
    const matrix = getMatrix();
    const crime = matrix.find((b) => b.jurisdiction.slug === "crime");
    expect(crime).toBeDefined();
    expect(crime!.rows.length).toBeGreaterThan(0);
    const totalInitiatives = crime!.rows.reduce(
      (sum, r) =>
        sum + r.cells.NOW.length + r.cells.NEXT.length + r.cells.LATER.length,
      0,
    );
    expect(totalInitiatives).toBe(crime!.initiativeCount);
  });
});

describe("getJurisdictionCounts", () => {
  it("returns one entry per Jurisdiction", () => {
    const counts = getJurisdictionCounts();
    expect(Object.keys(counts).sort()).toEqual([
      "administrative",
      "civil",
      "crime",
      "family",
      "tribunals",
    ]);
  });
});
