import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { loadSeedIntoDb } from "./seed-loader";
import type { PortalContent } from "./entities";

// Integration tests for the seed-loader (Phase 2 task 2.11).
// Real Postgres, real Prisma client. Each test starts with an
// empty entity tree and asserts shape after the load.
//
// The append-only Submission and AiParseMetric tables are NOT
// touched by this loader, and the truncate below leaves them
// alone — Submission's BEFORE DELETE trigger would reject anyway.

async function truncateEntities() {
  // Order matters: child rows must go before parents because of FKs.
  // Theme / Initiative / OutboundLink are owned by Domain / Product.
  // The Jurisdiction ↔ Product consumedBy join table is purged by
  // wiping Product (the consumedBy relation rows go with it).
  await db.$executeRawUnsafe('TRUNCATE TABLE "Theme" CASCADE');
  await db.$executeRawUnsafe('TRUNCATE TABLE "Initiative" CASCADE');
  await db.$executeRawUnsafe('TRUNCATE TABLE "OutboundLink" CASCADE');
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "Product" CASCADE',
  );
  await db.$executeRawUnsafe('TRUNCATE TABLE "Team" CASCADE');
  await db.$executeRawUnsafe('TRUNCATE TABLE "ProductDomain" CASCADE');
  await db.$executeRawUnsafe('TRUNCATE TABLE "Jurisdiction" CASCADE');
}

beforeEach(truncateEntities);

afterAll(async () => {
  await truncateEntities();
  await db.$disconnect();
});

// Tiny PortalContent — enough to exercise every relation type
// without being noisy. Shaped exactly like the production seed.
const SMALL_SEED: PortalContent = {
  jurisdictions: [
    { slug: "crime", name: "Crime", description: "Crown courts." },
    { slug: "civil", name: "Civil" },
  ],
  domains: [
    {
      id: "seed-d-cp",
      slug: "common-platform",
      name: "Common Platform Domain",
      description: "Spine of crime case management.",
      jurisdictionSlug: "crime",
      strategicThemes: [
        { title: "Theme A", description: "Reduce identity friction." },
        { title: "Theme B" },
      ],
    },
  ],
  teams: [
    {
      id: "seed-t-hearings",
      slug: "hearings",
      name: "Hearings Team",
      description: "Runs Common Platform day-to-day.",
      contact: "#team-hearings",
      domainSlug: "common-platform",
    },
  ],
  products: [
    {
      id: "seed-p-cp",
      slug: "common-platform",
      name: "Common Platform",
      description: "Unified case-management platform.",
      stage: "live",
      domainSlug: "common-platform",
      operatingTeamSlug: "hearings",
      consumedBy: ["civil"],
      outboundLinks: [
        { label: "Ardoq entry", url: "https://example.test/ardoq/cp" },
      ],
    },
  ],
  initiatives: [
    {
      id: "seed-i-now-1",
      productId: "seed-p-cp",
      bucket: "NOW",
      title: "Auth flow migration",
      description: "Roll passkeys to all users.",
    },
    {
      id: "seed-i-next-1",
      productId: "seed-p-cp",
      bucket: "NEXT",
      title: "Tenant self-service",
    },
  ],
  activity: [],
};

describe("loadSeedIntoDb", () => {
  it("inserts every entity tier and returns the expected counts", async () => {
    const result = await loadSeedIntoDb(SMALL_SEED);
    expect(result).toEqual({
      jurisdictions: 2,
      domains: 1,
      themes: 2,
      teams: 1,
      products: 1,
      initiatives: 2,
      outboundLinks: 1,
    });

    expect(await db.jurisdiction.count()).toBe(2);
    expect(await db.productDomain.count()).toBe(1);
    expect(await db.theme.count()).toBe(2);
    expect(await db.team.count()).toBe(1);
    expect(await db.product.count()).toBe(1);
    expect(await db.initiative.count()).toBe(2);
    expect(await db.outboundLink.count()).toBe(1);
  });

  it("resolves slug-based references to FK ids", async () => {
    await loadSeedIntoDb(SMALL_SEED);

    const domain = await db.productDomain.findUniqueOrThrow({
      where: { slug: "common-platform" },
      include: { jurisdiction: true, teams: true, products: true },
    });
    expect(domain.jurisdiction.slug).toBe("crime");
    expect(domain.teams.map((t) => t.slug)).toEqual(["hearings"]);
    expect(domain.products.map((p) => p.slug)).toEqual(["common-platform"]);

    const product = await db.product.findUniqueOrThrow({
      where: { slug: "common-platform" },
      include: { operatingTeam: true, consumedBy: true, initiatives: true },
    });
    expect(product.operatingTeam.slug).toBe("hearings");
    expect(product.consumedBy.map((j) => j.slug)).toEqual(["civil"]);
    expect(product.initiatives).toHaveLength(2);
  });

  it("is idempotent — running twice yields the same counts", async () => {
    await loadSeedIntoDb(SMALL_SEED);
    await loadSeedIntoDb(SMALL_SEED);
    expect(await db.jurisdiction.count()).toBe(2);
    expect(await db.productDomain.count()).toBe(1);
    expect(await db.theme.count()).toBe(2);
    expect(await db.team.count()).toBe(1);
    expect(await db.product.count()).toBe(1);
    expect(await db.initiative.count()).toBe(2);
    expect(await db.outboundLink.count()).toBe(1);
  });

  it("REPLACES child collections on re-seed (Themes, Initiatives, OutboundLinks)", async () => {
    await loadSeedIntoDb(SMALL_SEED);

    const modified: PortalContent = {
      ...SMALL_SEED,
      domains: [
        {
          ...SMALL_SEED.domains[0]!,
          // Themes shrink from 2 → 1
          strategicThemes: [{ title: "Theme A (revised)" }],
        },
      ],
      products: [
        {
          ...SMALL_SEED.products[0]!,
          // OutboundLinks shrink from 1 → 0
          outboundLinks: [],
        },
      ],
      // Initiatives shrink from 2 → 1
      initiatives: [
        {
          id: "seed-i-now-1",
          productId: "seed-p-cp",
          bucket: "NOW",
          title: "Auth flow migration (revised)",
        },
      ],
    };
    await loadSeedIntoDb(modified);

    expect(await db.theme.count()).toBe(1);
    expect(await db.initiative.count()).toBe(1);
    expect(await db.outboundLink.count()).toBe(0);
    const t = await db.theme.findFirstOrThrow();
    expect(t.title).toBe("Theme A (revised)");
  });

  it("updates Product stage / consumedBy on re-seed", async () => {
    await loadSeedIntoDb(SMALL_SEED);
    const modified: PortalContent = {
      ...SMALL_SEED,
      products: [
        {
          ...SMALL_SEED.products[0]!,
          stage: "retiring",
          consumedBy: [],
        },
      ],
    };
    await loadSeedIntoDb(modified);

    const product = await db.product.findUniqueOrThrow({
      where: { slug: "common-platform" },
      include: { consumedBy: true },
    });
    expect(product.stage).toBe("retiring");
    expect(product.consumedBy).toHaveLength(0);
  });

  it("throws on a Domain referencing an unknown jurisdiction (bad seed data)", async () => {
    const bad: PortalContent = {
      ...SMALL_SEED,
      domains: [
        {
          ...SMALL_SEED.domains[0]!,
          jurisdictionSlug: "no-such" as never,
        },
      ],
    };
    await expect(loadSeedIntoDb(bad)).rejects.toThrow(/unknown jurisdiction/);
  });

  it("throws on a Product referencing an unknown team (bad seed data)", async () => {
    const bad: PortalContent = {
      ...SMALL_SEED,
      products: [
        {
          ...SMALL_SEED.products[0]!,
          operatingTeamSlug: "no-such",
        },
      ],
    };
    await expect(loadSeedIntoDb(bad)).rejects.toThrow(/unknown team/);
  });
});
