import { portalContent } from "./seed";
import type {
  Initiative,
  Jurisdiction,
  Product,
  ProductDomain,
  Team,
  TimeBucket,
} from "./entities";

// Pure synchronous query helpers over `portalContent` (the seed
// module). Now the FALLBACK path under src/lib/portal-data.ts —
// when Postgres has been seeded (the standard demo flow) the
// DB-backed helpers in portal-data.ts win; when the DB is empty
// (fresh clone, no `pnpm db:seed` yet) the helpers below kick in
// so pages still render.
//
// Same shapes / same signatures as the original portal-data.ts so
// the DB-backed wrappers can fall through to these by name.

// Matrix-shaped Initiative carries the parent Product's display name
// and slug alongside the raw Initiative fields. Used by the detail
// drawer opened from the roadmap matrix — the eyebrow reads
// "NOW · in flight · on <Product>" so the user knows which Product
// owns the chip without leaving the matrix view, and the "Parent
// product" card-link routes through to /p/<slug>.
export type MatrixInitiative = Initiative & {
  productName: string;
  productHref: string;
};

export interface MatrixCell {
  bucket: TimeBucket;
  initiatives: MatrixInitiative[];
}

export interface MatrixDomainRow {
  domain: ProductDomain;
  productCount: number;
  cells: Record<TimeBucket, MatrixInitiative[]>;
}

export interface MatrixJurisdictionBand {
  jurisdiction: Jurisdiction;
  domainCount: number;
  initiativeCount: number;
  rows: MatrixDomainRow[];
}

export function getMatrix(): MatrixJurisdictionBand[] {
  return portalContent.jurisdictions.map((jurisdiction) => {
    const domainsForJ = portalContent.domains.filter(
      (d) => d.jurisdictionSlug === jurisdiction.slug,
    );
    const rows: MatrixDomainRow[] = domainsForJ.map((domain) => {
      const productsForD = portalContent.products.filter(
        (p) => p.domainSlug === domain.slug,
      );
      const productById = new Map(productsForD.map((p) => [p.id, p]));
      const initiativesForD: MatrixInitiative[] = portalContent.initiatives
        .filter((i) => productById.has(i.productId))
        .map((i) => {
          const p = productById.get(i.productId)!;
          return { ...i, productName: p.name, productHref: `/p/${p.slug}` };
        });
      return {
        domain,
        productCount: productsForD.length,
        cells: {
          NOW: initiativesForD.filter((i) => i.bucket === "NOW"),
          NEXT: initiativesForD.filter((i) => i.bucket === "NEXT"),
          LATER: initiativesForD.filter((i) => i.bucket === "LATER"),
        },
      };
    });
    const initiativeCount = rows.reduce(
      (sum, r) =>
        sum + r.cells.NOW.length + r.cells.NEXT.length + r.cells.LATER.length,
      0,
    );
    return {
      jurisdiction,
      domainCount: rows.length,
      initiativeCount,
      rows,
    };
  });
}

export function getActivity() {
  return portalContent.activity;
}

export function getJurisdictionCounts() {
  return Object.fromEntries(
    portalContent.jurisdictions.map((j) => [
      j.slug,
      portalContent.domains.filter((d) => d.jurisdictionSlug === j.slug).length,
    ]),
  );
}

export function getDomainsByJurisdiction(slug: string) {
  return portalContent.domains.filter((d) => d.jurisdictionSlug === slug);
}

export function getProductsForDomain(domainSlug: string): Product[] {
  return portalContent.products.filter((p) => p.domainSlug === domainSlug);
}

export function getTeamsForDomain(domainSlug: string): Team[] {
  return portalContent.teams.filter((t) => t.domainSlug === domainSlug);
}

export function getJurisdictionBySlug(slug: string): Jurisdiction | undefined {
  return portalContent.jurisdictions.find((j) => j.slug === slug);
}

export function getDomainBySlug(slug: string): ProductDomain | undefined {
  return portalContent.domains.find((d) => d.slug === slug);
}

export function getTeamBySlug(slug: string): Team | undefined {
  return portalContent.teams.find((t) => t.slug === slug);
}

export function getProductBySlug(slug: string): Product | undefined {
  return portalContent.products.find((p) => p.slug === slug);
}

export function getProductsForTeam(teamSlug: string): Product[] {
  return portalContent.products.filter((p) => p.operatingTeamSlug === teamSlug);
}

export function getProductsConsumedBy(jurisdictionSlug: string): Product[] {
  return portalContent.products.filter((p) =>
    p.consumedBy.includes(jurisdictionSlug as Jurisdiction["slug"]),
  );
}

export function getInitiativesForProduct(productId: string): Initiative[] {
  return portalContent.initiatives.filter((i) => i.productId === productId);
}

export function getInitiativesForDomain(
  domainSlug: string,
): Record<"NOW" | "NEXT" | "LATER", Initiative[]> {
  const productIds = new Set(
    getProductsForDomain(domainSlug).map((p) => p.id),
  );
  const matching = portalContent.initiatives.filter((i) =>
    productIds.has(i.productId),
  );
  return {
    NOW: matching.filter((i) => i.bucket === "NOW"),
    NEXT: matching.filter((i) => i.bucket === "NEXT"),
    LATER: matching.filter((i) => i.bucket === "LATER"),
  };
}

export interface SidebarJurisdiction {
  slug: string;
  name: string;
  count: number;
  domains: Array<{ slug: string; name: string }>;
}

// Sidebar data: every Jurisdiction with the Domains underneath it.
// The previous hardcoded sidebar showed wrong counts and a missing
// domain list for every Jurisdiction except Crime — this is the
// source of truth.
export function getSidebarJurisdictions(): SidebarJurisdiction[] {
  return portalContent.jurisdictions.map((j) => {
    const domains = portalContent.domains
      .filter((d) => d.jurisdictionSlug === j.slug)
      .map((d) => ({ slug: d.slug, name: d.name }));
    return {
      slug: j.slug,
      name: j.name,
      count: domains.length,
      domains,
    };
  });
}
