import { portalContent } from "./seed";
import type {
  Initiative,
  Jurisdiction,
  Product,
  ProductDomain,
  Team,
  TimeBucket,
} from "./entities";

// Pure query helpers over the seed. Phase 2 will switch the body of
// each function to hit Prisma instead of the seed module; signatures
// stay the same so pages don't change.

export interface MatrixCell {
  bucket: TimeBucket;
  initiatives: Initiative[];
}

export interface MatrixDomainRow {
  domain: ProductDomain;
  productCount: number;
  cells: Record<TimeBucket, Initiative[]>;
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
      const initiativesForD = portalContent.initiatives.filter((i) =>
        productsForD.some((p) => p.id === i.productId),
      );
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
