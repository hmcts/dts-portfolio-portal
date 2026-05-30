import { z } from "zod";

// Consolidated type definitions for the DTS Portfolio Portal frontend.
//
// These were previously split across entities.ts (Zod schemas + inferred
// types) and portal-data-seed.ts (matrix/sidebar interfaces). Both source
// files are deleted in the Group K cutover; all consumers have been updated
// to import from here instead.
//
// Zod schemas remain so that identity-parser.ts can do runtime validation
// (JurisdictionSlug.safeParse / .parse). All other consumers use the
// TypeScript types only.

// ---------------------------------------------------------------------------
// Primitives from requirements spec §4
// ---------------------------------------------------------------------------

export const TimeBucket = z.enum(["NOW", "NEXT", "LATER"]);
export type TimeBucket = z.infer<typeof TimeBucket>;

export const ProductStage = z.enum([
  "discovery",
  "alpha",
  "beta",
  "live",
  "retiring",
  "retired",
]);
export type ProductStage = z.infer<typeof ProductStage>;

export const JurisdictionSlug = z.enum([
  "crime",
  "civil",
  "family",
  "tribunals",
  "administrative",
]);
export type JurisdictionSlug = z.infer<typeof JurisdictionSlug>;

// ---------------------------------------------------------------------------
// Entity types
// ---------------------------------------------------------------------------

export const Initiative = z.object({
  id: z.string(),
  productId: z.string(),
  bucket: TimeBucket,
  title: z.string().min(1),
  description: z.string().optional(),
  outboundUrl: z.url().optional(),
});
export type Initiative = z.infer<typeof Initiative>;

export const OutboundLink = z.object({
  label: z.string().min(1),
  url: z.url(),
});
export type OutboundLink = z.infer<typeof OutboundLink>;

export const Product = z.object({
  id: z.string(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  stage: ProductStage,
  domainSlug: z.string(),
  operatingTeamSlug: z.string(),
  consumedBy: z.array(JurisdictionSlug).default([]),
  outboundLinks: z.array(OutboundLink).default([]),
  lastApprovedAt: z.iso.datetime().optional(),
  lastApprovedBy: z.string().optional(),
});
export type Product = z.infer<typeof Product>;

export const Theme = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});
export type Theme = z.infer<typeof Theme>;

export const Team = z.object({
  id: z.string(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  contact: z.string().optional(),
  domainSlug: z.string(),
});
export type Team = z.infer<typeof Team>;

export const ProductDomain = z.object({
  id: z.string(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  jurisdictionSlug: JurisdictionSlug,
  strategicThemes: z.array(Theme).default([]),
});
export type ProductDomain = z.infer<typeof ProductDomain>;

export const Jurisdiction = z.object({
  slug: JurisdictionSlug,
  name: z.string().min(1),
  description: z.string().optional(),
});
export type Jurisdiction = z.infer<typeof Jurisdiction>;

export const ActivityEntry = z.object({
  id: z.string(),
  subject: z.string().min(1),
  subjectHref: z.string(),
  description: z.string().min(1),
  kind: z.enum([
    "roadmap-update",
    "new-chip",
    "stage-change",
    "theme-update",
  ]),
  approver: z.string().min(1),
  approvedAt: z.iso.datetime(),
});
export type ActivityEntry = z.infer<typeof ActivityEntry>;

export const PortalContent = z.object({
  jurisdictions: z.array(Jurisdiction),
  domains: z.array(ProductDomain),
  teams: z.array(Team),
  products: z.array(Product),
  initiatives: z.array(Initiative),
  activity: z.array(ActivityEntry),
});
export type PortalContent = z.infer<typeof PortalContent>;

// ---------------------------------------------------------------------------
// Matrix / roadmap display types (previously in portal-data-seed.ts)
// ---------------------------------------------------------------------------

// Matrix-shaped Initiative carries the parent Product's display name
// and slug alongside the raw Initiative fields. Used by the detail
// drawer opened from the roadmap matrix.
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

// Sidebar data shape per Jurisdiction — every Jurisdiction with the
// Domains underneath it.
export interface SidebarJurisdiction {
  slug: string;
  name: string;
  count: number;
  domains: Array<{ slug: string; name: string }>;
}

// ---------------------------------------------------------------------------
// Ops dashboard types (previously in write-path modules)
// ---------------------------------------------------------------------------

// DailySearchVolume was previously exported from lib/search/analytics.ts.
// The ops/search dashboard imports only this type; the actual DB write-path
// is unavailable during the write-path re-platform.
export interface DailySearchVolume {
  day: string;
  queries: number;
  clicks: number;
}

// DailyParseMetric was previously exported from lib/ai-parser/metrics.ts.
// The ops/ai-cost dashboard imports only this type.
export interface DailyParseMetric {
  // ISO yyyy-mm-dd in UTC.
  day: string;
  source: string;
  parseCount: number;
  successCount: number;
  failureCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
}
