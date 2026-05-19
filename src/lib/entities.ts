import { z } from "zod";

// Entity model from requirements spec §4. Zod schemas double as the
// runtime validation point and the source of truth for the inferred
// TypeScript types. Mirrors prisma/schema.prisma but lives in app
// code so the matching pages can consume seed JSON without a DB.

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
