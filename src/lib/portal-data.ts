import { cache } from "react";
import { db } from "./db";
import * as seedHelpers from "./portal-data-seed";
import type {
  Initiative,
  Jurisdiction,
  Product,
  ProductDomain,
  Team,
  TimeBucket,
} from "./entities";

// Canonical order for the five v1 Jurisdictions per requirements
// spec §3.2. Used wherever a list of Jurisdictions is presented:
// the matrix bands, the sidebar nav, the JumpTo strip. The DB has
// no natural ordering (the slugs sort alphabetically; that would
// put Administrative first instead of Crime), so we project this
// fixed order over the DB result. Mirrors src/lib/seed.ts.
const JURISDICTION_ORDER: readonly string[] = [
  "crime",
  "civil",
  "family",
  "tribunals",
  "administrative",
];

function jurisdictionRank(slug: string): number {
  const idx = JURISDICTION_ORDER.indexOf(slug);
  return idx === -1 ? JURISDICTION_ORDER.length : idx;
}

function bySpecOrder<T extends { slug: string }>(a: T, b: T): number {
  return jurisdictionRank(a.slug) - jurisdictionRank(b.slug);
}

// Phase 2 task 2.11 (PR-2): page-data helpers now read from Postgres
// via Prisma. Seed remains as a fallback for the fresh-clone-without-
// `pnpm db:seed` case — every helper checks whether the DB has any
// Jurisdictions and, if not, defers to the synchronous seed helpers
// in portal-data-seed.ts. Once `pnpm db:seed` (or an approve-flow
// upload) has populated the DB, the DB wins on every read.
//
// All helpers are async. Pages that consume them are async server
// components so awaiting them is free. The home page was previously
// sync; it's been made async alongside.

export type {
  MatrixCell,
  MatrixDomainRow,
  MatrixJurisdictionBand,
  SidebarJurisdiction,
} from "./portal-data-seed";

import type {
  MatrixDomainRow,
  MatrixJurisdictionBand,
  SidebarJurisdiction,
} from "./portal-data-seed";

// Request-scoped memoisation of the "is the DB seeded?" probe.
// React's `cache` keys per render pass, so a page touching many
// helpers only pays for one COUNT(*) query per request.
const isDbEmpty = cache(async (): Promise<boolean> => {
  const n = await db.jurisdiction.count();
  return n === 0;
});

// ----- Re-exports of types only (kept inline so consumers don't
//       have to change their imports).
export type { Initiative, Jurisdiction, Product, ProductDomain, Team };

// ----- The 16 helpers, in the same order as the seed module -----

export async function getMatrix(): Promise<MatrixJurisdictionBand[]> {
  if (await isDbEmpty()) return seedHelpers.getMatrix();

  const jurisdictions = await db.jurisdiction.findMany({
    // DB-side ordering is a tie-breaker only — we re-order by the
    // canonical spec sequence below so Crime always comes first.
    orderBy: { name: "asc" },
    include: {
      domains: {
        orderBy: { name: "asc" },
        include: {
          products: {
            include: {
              initiatives: { orderBy: { position: "asc" } },
            },
          },
        },
      },
    },
  });
  jurisdictions.sort(bySpecOrder);

  return jurisdictions.map((j) => {
    // Sort domains within a Jurisdiction by product count
    // (descending), tie-break alphabetically. Matches the
    // prototype's "busiest domain first" arrangement — without
    // this, an alphabetical sort puts Case Preparation Domain
    // (1 product) above Common Platform Domain (5 products).
    const orderedDomains = [...j.domains].sort((a, b) => {
      if (b.products.length !== a.products.length) {
        return b.products.length - a.products.length;
      }
      return a.name.localeCompare(b.name);
    });
    const rows: MatrixDomainRow[] = orderedDomains.map((d) => {
      const initiativesForD = d.products.flatMap((p) => p.initiatives);
      return {
        domain: domainToSeedShape(d, j.slug),
        productCount: d.products.length,
        cells: {
          NOW: initiativesForD
            .filter((i) => i.bucket === "NOW")
            .map(initiativeToSeedShape),
          NEXT: initiativesForD
            .filter((i) => i.bucket === "NEXT")
            .map(initiativeToSeedShape),
          LATER: initiativesForD
            .filter((i) => i.bucket === "LATER")
            .map(initiativeToSeedShape),
        },
      };
    });
    const initiativeCount = rows.reduce(
      (sum, r) =>
        sum + r.cells.NOW.length + r.cells.NEXT.length + r.cells.LATER.length,
      0,
    );
    return {
      jurisdiction: jurisdictionToSeedShape(j),
      domainCount: rows.length,
      initiativeCount,
      rows,
    };
  });
}

// The Phase 1 activity feed lived in the seed (hand-curated entries).
// The DB equivalent comes from the Submission audit log, but the
// link from Submission.entityId → entity isn't fully populated yet
// (depends on Phase 4 auth wiring approver + on every entity having
// been published through the lifecycle). Stay on the seed for now;
// activity becomes a DB query in a follow-up.
export async function getActivity() {
  return seedHelpers.getActivity();
}

export async function getJurisdictionCounts(): Promise<
  Record<string, number>
> {
  if (await isDbEmpty()) return seedHelpers.getJurisdictionCounts();

  const rows = await db.jurisdiction.findMany({
    include: { _count: { select: { domains: true } } },
  });
  return Object.fromEntries(rows.map((j) => [j.slug, j._count.domains]));
}

export async function getDomainsByJurisdiction(
  slug: string,
): Promise<ProductDomain[]> {
  if (await isDbEmpty()) return seedHelpers.getDomainsByJurisdiction(slug);

  const j = await db.jurisdiction.findUnique({ where: { slug } });
  if (!j) return [];
  const domains = await db.productDomain.findMany({
    where: { jurisdictionId: j.id },
    orderBy: { name: "asc" },
    include: { strategicThemes: { orderBy: { position: "asc" } } },
  });
  return domains.map((d) => domainToSeedShape(d, slug));
}

export async function getProductsForDomain(
  domainSlug: string,
): Promise<Product[]> {
  if (await isDbEmpty()) return seedHelpers.getProductsForDomain(domainSlug);

  const d = await db.productDomain.findUnique({ where: { slug: domainSlug } });
  if (!d) return [];
  return loadProducts({ domainId: d.id }, domainSlug);
}

export async function getTeamsForDomain(domainSlug: string): Promise<Team[]> {
  if (await isDbEmpty()) return seedHelpers.getTeamsForDomain(domainSlug);

  const d = await db.productDomain.findUnique({ where: { slug: domainSlug } });
  if (!d) return [];
  const teams = await db.team.findMany({
    where: { domainId: d.id },
    orderBy: { name: "asc" },
  });
  return teams.map((t) => teamToSeedShape(t, domainSlug));
}

export async function getJurisdictionBySlug(
  slug: string,
): Promise<Jurisdiction | undefined> {
  if (await isDbEmpty()) return seedHelpers.getJurisdictionBySlug(slug);

  const j = await db.jurisdiction.findUnique({ where: { slug } });
  if (!j) return undefined;
  return jurisdictionToSeedShape(j);
}

export async function getDomainBySlug(
  slug: string,
): Promise<ProductDomain | undefined> {
  if (await isDbEmpty()) return seedHelpers.getDomainBySlug(slug);

  const d = await db.productDomain.findUnique({
    where: { slug },
    include: {
      jurisdiction: true,
      strategicThemes: { orderBy: { position: "asc" } },
    },
  });
  if (!d) return undefined;
  return domainToSeedShape(d, d.jurisdiction.slug);
}

export async function getTeamBySlug(slug: string): Promise<Team | undefined> {
  if (await isDbEmpty()) return seedHelpers.getTeamBySlug(slug);

  const t = await db.team.findUnique({
    where: { slug },
    include: { domain: true },
  });
  if (!t) return undefined;
  return teamToSeedShape(t, t.domain.slug);
}

export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  if (await isDbEmpty()) return seedHelpers.getProductBySlug(slug);

  const [p] = await loadProductsByWhere({ slug });
  return p;
}

export async function getProductsForTeam(
  teamSlug: string,
): Promise<Product[]> {
  if (await isDbEmpty()) return seedHelpers.getProductsForTeam(teamSlug);

  const t = await db.team.findUnique({ where: { slug: teamSlug } });
  if (!t) return [];
  return loadProductsByWhere({ operatingTeamId: t.id });
}

export async function getProductsConsumedBy(
  jurisdictionSlug: string,
): Promise<Product[]> {
  if (await isDbEmpty())
    return seedHelpers.getProductsConsumedBy(jurisdictionSlug);

  const j = await db.jurisdiction.findUnique({
    where: { slug: jurisdictionSlug },
  });
  if (!j) return [];
  return loadProductsByWhere({ consumedBy: { some: { id: j.id } } });
}

export async function getInitiativesForProduct(
  productId: string,
): Promise<Initiative[]> {
  if (await isDbEmpty()) return seedHelpers.getInitiativesForProduct(productId);

  const initiatives = await db.initiative.findMany({
    where: { productId },
    orderBy: { position: "asc" },
  });
  return initiatives.map(initiativeToSeedShape);
}

export async function getInitiativesForDomain(
  domainSlug: string,
): Promise<Record<TimeBucket, Initiative[]>> {
  if (await isDbEmpty())
    return seedHelpers.getInitiativesForDomain(domainSlug);

  const d = await db.productDomain.findUnique({
    where: { slug: domainSlug },
    include: { products: { include: { initiatives: { orderBy: { position: "asc" } } } } },
  });
  if (!d) return { NOW: [], NEXT: [], LATER: [] };
  const all = d.products.flatMap((p) => p.initiatives);
  return {
    NOW: all.filter((i) => i.bucket === "NOW").map(initiativeToSeedShape),
    NEXT: all.filter((i) => i.bucket === "NEXT").map(initiativeToSeedShape),
    LATER: all.filter((i) => i.bucket === "LATER").map(initiativeToSeedShape),
  };
}

export async function getSidebarJurisdictions(): Promise<
  SidebarJurisdiction[]
> {
  if (await isDbEmpty()) return seedHelpers.getSidebarJurisdictions();

  const jurisdictions = await db.jurisdiction.findMany({
    orderBy: { name: "asc" },
    include: {
      domains: {
        orderBy: { name: "asc" },
        select: { slug: true, name: true },
      },
    },
  });
  jurisdictions.sort(bySpecOrder);
  return jurisdictions.map((j) => ({
    slug: j.slug,
    name: j.name,
    count: j.domains.length,
    domains: j.domains.map((d) => ({ slug: d.slug, name: d.name })),
  }));
}

// ----- DB → seed-shape projectors -----

// Each takes a Prisma row (sometimes with optional includes) and
// projects it into the shape pages consume via the seed type. We
// deliberately keep these tolerant — fields the seed has as
// optional get safe defaults from the DB's nullable columns.

type DbInitiative = {
  id: string;
  productId: string;
  bucket: "NOW" | "NEXT" | "LATER";
  title: string;
  description: string | null;
  outboundUrl: string | null;
};
function initiativeToSeedShape(i: DbInitiative): Initiative {
  const initiative: Initiative = {
    id: i.id,
    productId: i.productId,
    bucket: i.bucket,
    title: i.title,
  };
  if (i.description) initiative.description = i.description;
  if (i.outboundUrl) initiative.outboundUrl = i.outboundUrl;
  return initiative;
}

type DbDomain = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  strategicThemes?: Array<{ title: string; description: string | null }>;
};
function domainToSeedShape(
  d: DbDomain,
  jurisdictionSlug: string,
): ProductDomain {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    ...(d.description ? { description: d.description } : {}),
    jurisdictionSlug: jurisdictionSlug as ProductDomain["jurisdictionSlug"],
    strategicThemes: (d.strategicThemes ?? []).map((t) => ({
      title: t.title,
      ...(t.description ? { description: t.description } : {}),
    })),
  };
}

type DbTeam = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  contact: string | null;
};
function teamToSeedShape(t: DbTeam, domainSlug: string): Team {
  const team: Team = {
    id: t.id,
    slug: t.slug,
    name: t.name,
    domainSlug,
  };
  if (t.description) team.description = t.description;
  if (t.contact) team.contact = t.contact;
  return team;
}

type DbJurisdiction = { slug: string; name: string; description: string | null };
function jurisdictionToSeedShape(j: DbJurisdiction): Jurisdiction {
  return {
    slug: j.slug as Jurisdiction["slug"],
    name: j.name,
    ...(j.description ? { description: j.description } : {}),
  };
}

type DbProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  stage: Product["stage"];
  domain: { slug: string };
  operatingTeam: { slug: string };
  consumedBy: Array<{ slug: string }>;
  outboundLinks: Array<{ label: string; url: string }>;
  lastApprovedAt: Date | null;
  lastApprovedBy: string | null;
};
function productToSeedShape(p: DbProduct): Product {
  const out: Product = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    stage: p.stage,
    domainSlug: p.domain.slug,
    operatingTeamSlug: p.operatingTeam.slug,
    consumedBy: p.consumedBy.map(
      (j) => j.slug as Product["consumedBy"][number],
    ),
    outboundLinks: p.outboundLinks.map((l) => ({ label: l.label, url: l.url })),
  };
  if (p.description) out.description = p.description;
  if (p.lastApprovedAt) out.lastApprovedAt = p.lastApprovedAt.toISOString();
  if (p.lastApprovedBy) out.lastApprovedBy = p.lastApprovedBy;
  return out;
}

// Helpers for Product queries — common include shape.
async function loadProducts(
  where: object,
  _domainSlug: string,
): Promise<Product[]> {
  return loadProductsByWhere(where);
}

async function loadProductsByWhere(where: object): Promise<Product[]> {
  const products = await db.product.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      domain: { select: { slug: true } },
      operatingTeam: { select: { slug: true } },
      consumedBy: { select: { slug: true } },
      outboundLinks: { orderBy: { position: "asc" } },
    },
  });
  return products.map((p) => productToSeedShape(p));
}
