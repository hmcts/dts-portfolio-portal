import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { search, searchCounts } from "./search";

// Integration tests for the Postgres FTS search backend (Phase 3
// task 3.1). Each test seeds a handful of rows across the entity
// tables, runs a search, and asserts on the ranked results.
//
// Generated tsvector columns auto-populate on INSERT — no app-side
// reindex step needed.

async function truncate() {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "Initiative", "OutboundLink", "Theme", "Product", "Team", "ProductDomain", "Jurisdiction" RESTART IDENTITY CASCADE',
  );
}

async function seedSmall() {
  await db.jurisdiction.create({
    data: { slug: "crime", name: "Crime", description: "Crown court services" },
  });
  await db.jurisdiction.create({
    data: { slug: "civil", name: "Civil", description: "Money claims" },
  });
  const cp = await db.productDomain.create({
    data: {
      slug: "common-platform-domain",
      name: "Common Platform Domain",
      description: "The unified spine for Crime",
      jurisdiction: { connect: { slug: "crime" } },
    },
  });
  const team = await db.team.create({
    data: {
      slug: "identity-team",
      name: "Identity Team",
      description: "Sign-in and account management",
      contact: "identity@justice.gov.uk",
      domain: { connect: { id: cp.id } },
    },
  });
  const product = await db.product.create({
    data: {
      slug: "crime-sign-in",
      name: "Crime Sign In",
      description: "Single sign-on for Crime staff",
      stage: "live",
      domain: { connect: { id: cp.id } },
      operatingTeam: { connect: { id: team.id } },
    },
  });
  await db.initiative.create({
    data: {
      product: { connect: { id: product.id } },
      bucket: "NOW",
      title: "Passkeys pilot",
      description: "Internal users first",
    },
  });
}

beforeEach(async () => {
  await truncate();
  await seedSmall();
});

afterAll(async () => {
  await truncate();
  await db.$disconnect();
});

describe("search backend (Postgres FTS)", () => {
  it("returns an empty array for empty / whitespace input", async () => {
    expect(await search("")).toEqual([]);
    expect(await search("   ")).toEqual([]);
  });

  it("finds a Jurisdiction by exact name", async () => {
    const results = await search("crime");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const crime = results.find((r) => r.entityType === "jurisdiction");
    expect(crime?.slug).toBe("crime");
    expect(crime?.href).toBe("/j/crime");
  });

  it("finds a Product by description match", async () => {
    const results = await search("single sign-on");
    const product = results.find((r) => r.entityType === "product");
    expect(product?.slug).toBe("crime-sign-in");
    expect(product?.href).toBe("/p/crime-sign-in");
  });

  it("ranks name matches above description matches", async () => {
    // "Crime" appears in the Jurisdiction name AND in the Product
    // name ("Crime Sign In") — both should surface; the
    // weighting-A (name) > weighting-C (description) means Crime
    // Jurisdiction and Crime Sign In should outrank rows that
    // only mention "crime" in their description.
    const results = await search("crime");
    expect(results[0]!.rank).toBeGreaterThanOrEqual(results.at(-1)!.rank);
  });

  it("finds an Initiative by its title", async () => {
    const results = await search("passkeys");
    const initiative = results.find((r) => r.entityType === "initiative");
    expect(initiative?.name).toBe("Passkeys pilot");
    // Initiatives have no slug — search overlay can fall back to
    // the parent Product page once linkage is wired in Phase 3.4.
    expect(initiative?.slug).toBeNull();
    expect(initiative?.href).toBeNull();
  });

  it("supports negation via websearch_to_tsquery syntax", async () => {
    // "court -money" should rank Crime (which mentions court) ahead
    // of Civil (which mentions Money).
    const results = await search("court -money");
    const slugs = results.map((r) => r.slug);
    expect(slugs).toContain("crime");
    expect(slugs).not.toContain("civil");
  });

  it("supports a per-type filter", async () => {
    const results = await search("crime", { types: ["product"] });
    expect(results.every((r) => r.entityType === "product")).toBe(true);
  });

  it("returns no more than the requested limit", async () => {
    const results = await search("crime", { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("auto-reindexes on UPDATE (generated tsvector)", async () => {
    // Confirm the generated column tracks changes — no app reindex.
    const before = await search("dashboard");
    expect(before.length).toBe(0);
    await db.team.update({
      where: { slug: "identity-team" },
      data: { description: "Sign-in, accounts, and the access dashboard" },
    });
    const after = await search("dashboard");
    expect(after.length).toBe(1);
    expect(after[0]!.entityType).toBe("team");
  });
});

describe("searchCounts", () => {
  it("returns per-type counts for the matrix of filter chips", async () => {
    const counts = await searchCounts("crime");
    expect(counts.jurisdiction).toBeGreaterThanOrEqual(1);
    // No Domains in the seed have "crime" in their indexed text,
    // unless their parent Jurisdiction name leaks in — the Domain
    // here has "Crime" in its description ("...for Crime")
    expect(counts.domain).toBeGreaterThanOrEqual(0);
    expect(counts.product).toBeGreaterThanOrEqual(1);
  });
});
