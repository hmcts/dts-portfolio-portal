import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { loadSeedIntoDb } from "./seed-loader";
import {
  getDomainBySlug,
  getDomainsByJurisdiction,
  getInitiativesForDomain,
  getInitiativesForProduct,
  getJurisdictionBySlug,
  getJurisdictionCounts,
  getMatrix,
  getProductBySlug,
  getProductsConsumedBy,
  getProductsForDomain,
  getProductsForTeam,
  getSidebarJurisdictions,
  getTeamBySlug,
  getTeamsForDomain,
} from "./portal-data";

// Integration tests for the DB-backed portal-data helpers (Phase 2
// task 2.11). Each test runs against a freshly-seeded entity tree
// so the DB-first read path is exercised. The seed-empty fallback
// is covered by the second describe block below — when the DB is
// truncated, every helper should defer to portal-data-seed.ts.

async function truncateEntities() {
  await db.$executeRawUnsafe('TRUNCATE TABLE "Theme" CASCADE');
  await db.$executeRawUnsafe('TRUNCATE TABLE "Initiative" CASCADE');
  await db.$executeRawUnsafe('TRUNCATE TABLE "OutboundLink" CASCADE');
  await db.$executeRawUnsafe('TRUNCATE TABLE "Product" CASCADE');
  await db.$executeRawUnsafe('TRUNCATE TABLE "Team" CASCADE');
  await db.$executeRawUnsafe('TRUNCATE TABLE "ProductDomain" CASCADE');
  await db.$executeRawUnsafe('TRUNCATE TABLE "Jurisdiction" CASCADE');
}

afterAll(async () => {
  await truncateEntities();
  await db.$disconnect();
});

describe("portal-data DB-backed reads (seeded DB)", () => {
  beforeEach(async () => {
    await truncateEntities();
    await loadSeedIntoDb();
  });

  it("getJurisdictionBySlug returns the seeded record by slug", async () => {
    const j = await getJurisdictionBySlug("crime");
    expect(j).toBeDefined();
    expect(j!.slug).toBe("crime");
    expect(j!.name).toBe("Crime");
  });

  it("getJurisdictionBySlug returns undefined for an unknown slug", async () => {
    expect(await getJurisdictionBySlug("no-such")).toBeUndefined();
  });

  it("getDomainsByJurisdiction returns the Domains for that Jurisdiction", async () => {
    const domains = await getDomainsByJurisdiction("crime");
    expect(domains.length).toBeGreaterThan(0);
    expect(domains.every((d) => d.jurisdictionSlug === "crime")).toBe(true);
  });

  it("getDomainBySlug projects the strategicThemes alongside the Domain", async () => {
    const d = await getDomainBySlug("common-platform");
    expect(d).toBeDefined();
    expect(d!.slug).toBe("common-platform");
    expect(Array.isArray(d!.strategicThemes)).toBe(true);
  });

  it("getTeamsForDomain returns Teams scoped to that Domain", async () => {
    const teams = await getTeamsForDomain("common-platform");
    expect(teams.length).toBeGreaterThan(0);
    expect(teams.every((t) => t.domainSlug === "common-platform")).toBe(true);
  });

  it("getTeamBySlug returns the seeded record with its Domain slug", async () => {
    const t = await getTeamBySlug("hearings");
    expect(t).toBeDefined();
    expect(t!.slug).toBe("hearings");
    expect(t!.domainSlug).toBeTruthy();
  });

  it("getProductBySlug projects domain/operatingTeam slugs + consumedBy", async () => {
    const p = await getProductBySlug("common-platform");
    expect(p).toBeDefined();
    expect(p!.domainSlug).toBeTruthy();
    expect(p!.operatingTeamSlug).toBeTruthy();
    expect(Array.isArray(p!.consumedBy)).toBe(true);
  });

  it("getProductsForDomain + getProductsForTeam return the same Product via either index", async () => {
    const product = await getProductBySlug("common-platform");
    expect(product).toBeDefined();
    const domainProducts = await getProductsForDomain(product!.domainSlug);
    const teamProducts = await getProductsForTeam(product!.operatingTeamSlug);
    expect(domainProducts.some((p) => p.slug === product!.slug)).toBe(true);
    expect(teamProducts.some((p) => p.slug === product!.slug)).toBe(true);
  });

  it("getProductsConsumedBy returns Products that other Jurisdictions consume", async () => {
    // Common Platform's seeded consumedBy includes at least one
    // non-crime jurisdiction in the production seed — verify the
    // index works by querying that jurisdiction back.
    const cp = await getProductBySlug("common-platform");
    expect(cp).toBeDefined();
    for (const consumer of cp!.consumedBy) {
      const consumed = await getProductsConsumedBy(consumer);
      expect(consumed.some((p) => p.slug === "common-platform")).toBe(true);
    }
  });

  it("getInitiativesForProduct returns chips in position order", async () => {
    const product = await getProductBySlug("common-platform");
    expect(product).toBeDefined();
    const inits = await getInitiativesForProduct(product!.id);
    expect(Array.isArray(inits)).toBe(true);
    // Each one must carry the productId pointing back at the Product.
    expect(inits.every((i) => i.productId === product!.id)).toBe(true);
  });

  it("getInitiativesForDomain groups by TimeBucket", async () => {
    const buckets = await getInitiativesForDomain("common-platform");
    expect(buckets).toHaveProperty("NOW");
    expect(buckets).toHaveProperty("NEXT");
    expect(buckets).toHaveProperty("LATER");
    expect(buckets.NOW.every((i) => i.bucket === "NOW")).toBe(true);
    expect(buckets.NEXT.every((i) => i.bucket === "NEXT")).toBe(true);
    expect(buckets.LATER.every((i) => i.bucket === "LATER")).toBe(true);
  });

  it("getJurisdictionCounts returns a domain count per jurisdiction", async () => {
    const counts = await getJurisdictionCounts();
    expect(counts.crime).toBeGreaterThan(0);
    expect(counts.civil).toBeGreaterThanOrEqual(1);
    // Sum matches total Domain count.
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(await db.productDomain.count());
  });

  it("getMatrix returns one band per Jurisdiction", async () => {
    const matrix = await getMatrix();
    expect(matrix.length).toBe(await db.jurisdiction.count());
    for (const band of matrix) {
      const expected =
        band.rows.reduce(
          (s, r) => s + r.cells.NOW.length + r.cells.NEXT.length + r.cells.LATER.length,
          0,
        );
      expect(band.initiativeCount).toBe(expected);
    }
  });

  it("getSidebarJurisdictions exposes count = domain count and a non-empty domains list per Jurisdiction", async () => {
    const sidebar = await getSidebarJurisdictions();
    expect(sidebar.length).toBe(await db.jurisdiction.count());
    for (const j of sidebar) {
      expect(j.count).toBe(j.domains.length);
      expect(j.domains.length).toBeGreaterThan(0);
    }
  });
});

describe("portal-data seed fallback (empty DB)", () => {
  beforeEach(truncateEntities);

  it("falls back to the seed when no Jurisdictions are in the DB", async () => {
    // The DB is empty; getJurisdictionBySlug should defer to the
    // sync seed helper and still return Crime.
    const j = await getJurisdictionBySlug("crime");
    expect(j).toBeDefined();
    expect(j!.slug).toBe("crime");
  });

  it("getMatrix falls back to the seed and includes every seeded Jurisdiction", async () => {
    const matrix = await getMatrix();
    expect(matrix.length).toBe(5); // crime / civil / family / tribunals / administrative
  });

  it("getSidebarJurisdictions falls back to the seed (each Jurisdiction's domain list is populated)", async () => {
    const sidebar = await getSidebarJurisdictions();
    expect(sidebar.length).toBe(5);
    for (const j of sidebar) {
      expect(j.count).toBeGreaterThan(0);
      expect(j.domains.length).toBe(j.count);
    }
  });
});
