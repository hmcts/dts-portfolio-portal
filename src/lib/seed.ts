import { z } from "zod";
import {
  ActivityEntry,
  Initiative,
  Jurisdiction,
  PortalContent,
  Product,
  ProductDomain,
  Team,
} from "./entities";

// Zod's .default() splits the input and output types: a field with
// `.default([])` is optional on the way in, present on the way out.
// The seed describes the *input* shape so optional defaults can be
// omitted — PortalContent.parse() below fills them in.
type Seed = {
  jurisdictions: Array<z.input<typeof Jurisdiction>>;
  domains: Array<z.input<typeof ProductDomain>>;
  teams: Array<z.input<typeof Team>>;
  products: Array<z.input<typeof Product>>;
  initiatives: Array<z.input<typeof Initiative>>;
  activity: Array<z.input<typeof ActivityEntry>>;
};

// Phase 1 seed content. Plausible HMCTS-flavoured naming, all
// fictional. Mirrors the prototype's example shape: Crime is the most
// detailed (3 domains, ~30 chips); other jurisdictions are lighter so
// the home matrix has plenty to render at every band.
//
// Replaced by live data via the markdown upload lifecycle in Phase 2
// (Task 2.11). This file is deleted at that point.

const jurisdictions: Seed["jurisdictions"] = [
  {
    slug: "crime",
    name: "Crime",
    description:
      "Magistrates, Crown and Youth court services — case management, hearings, and supporting tools.",
  },
  {
    slug: "civil",
    name: "Civil",
    description:
      "Money claims, possessions, and small-claim services across civil jurisdictions.",
  },
  {
    slug: "family",
    name: "Family",
    description:
      "Public-law and private-law children, divorce, and adoption services.",
  },
  {
    slug: "tribunals",
    name: "Tribunals",
    description:
      "Employment, immigration, social entitlement and other tribunal services.",
  },
  {
    slug: "administrative",
    name: "Administrative",
    description: "Shared services supporting HMCTS-wide operations.",
  },
];

const domains: Seed["domains"] = [
  {
    id: "d-common-platform",
    slug: "common-platform",
    name: "Common Platform Domain",
    jurisdictionSlug: "crime",
    description:
      "The unified case-management spine that Crown, Magistrates and Youth use end-to-end.",
    strategicThemes: [
      { title: "Reduce platform sprawl" },
      { title: "Quieter incidents through observability" },
      { title: "Faster sign-in for users" },
    ],
  },
  {
    id: "d-courtroom-hearings",
    slug: "courtroom-hearings",
    name: "Courtroom & Hearings Domain",
    jurisdictionSlug: "crime",
    description:
      "The platforms that schedule, list, run and record hearings — courtroom hardware, audio, and remote attendance.",
    strategicThemes: [
      { title: "Make remote hearings boring (reliable)" },
      { title: "Speaker-attribution on transcripts" },
    ],
  },
  {
    id: "d-case-preparation",
    slug: "case-preparation",
    name: "Case Preparation Domain",
    jurisdictionSlug: "crime",
    description:
      "Tools that help court staff prepare cases — sentencing assistance, results capture, lifecycle.",
    strategicThemes: [{ title: "Cut clerk keystrokes per outcome" }],
  },
  {
    id: "d-civil-money",
    slug: "civil-money",
    name: "Civil Money Domain",
    jurisdictionSlug: "civil",
    description: "Money claims and judgment processing.",
    strategicThemes: [{ title: "First-time digital filing" }],
  },
  {
    id: "d-family-public-law",
    slug: "family-public-law",
    name: "Family Public Law Domain",
    jurisdictionSlug: "family",
    description: "Care, supervision and placement proceedings.",
    strategicThemes: [{ title: "Reduce the time from issue to first hearing" }],
  },
  {
    id: "d-tribunals-employment",
    slug: "tribunals-employment",
    name: "Employment Tribunals Domain",
    jurisdictionSlug: "tribunals",
    description: "Single and multiple-claimant employment claims.",
    strategicThemes: [{ title: "Self-service for unrepresented claimants" }],
  },
  {
    id: "d-administrative-shared",
    slug: "administrative-shared",
    name: "Shared Services Domain",
    jurisdictionSlug: "administrative",
    description: "Cross-cutting services consumed by other jurisdictions.",
    strategicThemes: [{ title: "Treat shared services as products, not glue" }],
  },
];

const teams: Seed["teams"] = [
  {
    id: "t-cp-core",
    slug: "common-platform-core",
    name: "Common Platform Core",
    domainSlug: "common-platform",
    description: "Owns the spine of the Common Platform case-management system.",
    contact: "common-platform-core@justice.gov.uk",
  },
  {
    id: "t-identity",
    slug: "identity",
    name: "Identity Team",
    domainSlug: "common-platform",
    description: "Sign-in, account management and federation for Crime services.",
    contact: "#crime-identity",
  },
  {
    id: "t-hearings",
    slug: "hearings",
    name: "Hearings Service Team",
    domainSlug: "courtroom-hearings",
    description: "Scheduling, listing, and reminders for Crown Court hearings.",
    contact: "hearings-service@justice.gov.uk",
  },
  {
    id: "t-courtroom-tech",
    slug: "courtroom-tech",
    name: "Courtroom Technology",
    domainSlug: "courtroom-hearings",
    description: "Audio, video, evidence presentation and in-courtroom hardware.",
    contact: "courtroom-tech@justice.gov.uk",
  },
  {
    id: "t-resulting",
    slug: "resulting",
    name: "Resulting Team",
    domainSlug: "case-preparation",
    description: "Tools for capturing court outcomes at the point of decision.",
    contact: "resulting@justice.gov.uk",
  },
  {
    id: "t-civil-money",
    slug: "civil-money",
    name: "Civil Money Claims Team",
    domainSlug: "civil-money",
    contact: "civil-money@justice.gov.uk",
  },
  {
    id: "t-family-public",
    slug: "family-public",
    name: "Family Public Law Team",
    domainSlug: "family-public-law",
    contact: "family-public@justice.gov.uk",
  },
  {
    id: "t-employment-tribunals",
    slug: "employment-tribunals",
    name: "Employment Tribunals Team",
    domainSlug: "tribunals-employment",
    contact: "employment-tribunals@justice.gov.uk",
  },
  {
    id: "t-shared-services",
    slug: "shared-services",
    name: "Shared Services Team",
    domainSlug: "administrative-shared",
    contact: "shared-services@justice.gov.uk",
  },
];

const products: Seed["products"] = [
  {
    id: "p-common-platform",
    slug: "common-platform",
    name: "Common Platform",
    domainSlug: "common-platform",
    operatingTeamSlug: "common-platform-core",
    stage: "live",
    description:
      "The unified case-management platform used across Crown, Magistrates and Youth courts.",
    outboundLinks: [
      { label: "Open in Confluence", url: "https://confluence.example/common-platform" },
      { label: "Open in Ardoq", url: "https://ardoq.example/common-platform" },
    ],
    consumedBy: ["civil", "family"],
  },
  {
    id: "p-sign-in",
    slug: "crime-sign-in",
    name: "Crime Sign In",
    domainSlug: "common-platform",
    operatingTeamSlug: "identity",
    stage: "live",
    description:
      "Single sign-on for staff using Crime services. Integrates with the cross-jurisdiction identity provider.",
    outboundLinks: [
      { label: "Open in Confluence", url: "https://confluence.example/crime-sign-in" },
    ],
  },
  {
    id: "p-document-store",
    slug: "document-store",
    name: "Document Store",
    domainSlug: "common-platform",
    operatingTeamSlug: "common-platform-core",
    stage: "live",
    description: "Append-only document repository for case bundles.",
    outboundLinks: [],
  },
  {
    id: "p-pay",
    slug: "court-pay",
    name: "Court Pay",
    domainSlug: "common-platform",
    operatingTeamSlug: "common-platform-core",
    stage: "beta",
    description: "Payment capture for fines, fees and refunds across Crime services.",
    outboundLinks: [],
  },
  {
    id: "p-listings",
    slug: "listings",
    name: "Listings Engine",
    domainSlug: "common-platform",
    operatingTeamSlug: "common-platform-core",
    stage: "live",
    description:
      "Multi-tenant listings engine used by all Crime venues for daily scheduling.",
    outboundLinks: [],
  },
  {
    id: "p-hmc",
    slug: "hearings-management",
    name: "Hearings Management",
    domainSlug: "courtroom-hearings",
    operatingTeamSlug: "hearings",
    stage: "beta",
    description:
      "Booking, listing and remote-attendance workflows for Crown Court hearings.",
    outboundLinks: [
      { label: "Open in Confluence", url: "https://confluence.example/hmc" },
    ],
  },
  {
    id: "p-transcription",
    slug: "transcription",
    name: "Transcription",
    domainSlug: "courtroom-hearings",
    operatingTeamSlug: "courtroom-tech",
    stage: "live",
    description:
      "End-to-end transcription of recorded hearings with supplier integration.",
    outboundLinks: [],
  },
  {
    id: "p-courtroom-display",
    slug: "courtroom-display",
    name: "Courtroom Display",
    domainSlug: "courtroom-hearings",
    operatingTeamSlug: "courtroom-tech",
    stage: "live",
    description:
      "Evidence presentation, document picker, and screen-sharing in the courtroom.",
    outboundLinks: [],
  },
  {
    id: "p-resulting-assistant",
    slug: "resulting-assistant",
    name: "Resulting Assistant",
    domainSlug: "case-preparation",
    operatingTeamSlug: "resulting",
    stage: "alpha",
    description:
      "Captures court outcomes; AI assists with sentence-type templating.",
    outboundLinks: [],
  },
  {
    id: "p-civil-money-claims",
    slug: "civil-money-claims",
    name: "Money Claims",
    domainSlug: "civil-money",
    operatingTeamSlug: "civil-money",
    stage: "live",
    description: "Digital filing for civil money claims under £100k.",
    outboundLinks: [],
  },
  {
    id: "p-civil-judgments",
    slug: "civil-judgments",
    name: "Judgments & Orders",
    domainSlug: "civil-money",
    operatingTeamSlug: "civil-money",
    stage: "beta",
    description: "Generation, signing and serving of civil judgments.",
    outboundLinks: [],
  },
  {
    id: "p-family-care",
    slug: "family-care",
    name: "Care Proceedings",
    domainSlug: "family-public-law",
    operatingTeamSlug: "family-public",
    stage: "beta",
    description: "Care, supervision and placement applications for local authorities.",
    outboundLinks: [],
  },
  {
    id: "p-employment-claims",
    slug: "employment-claims",
    name: "Employment Claims",
    domainSlug: "tribunals-employment",
    operatingTeamSlug: "employment-tribunals",
    stage: "live",
    description: "Single and multiple-claimant employment-tribunal claims.",
    outboundLinks: [],
  },
  {
    id: "p-correspondence",
    slug: "correspondence",
    name: "Correspondence Service",
    domainSlug: "administrative-shared",
    operatingTeamSlug: "shared-services",
    stage: "live",
    description:
      "Generates and serves citizen-facing letters across all jurisdictions.",
    consumedBy: ["crime", "civil", "family", "tribunals"],
    outboundLinks: [],
  },
];

const initiatives: Seed["initiatives"] = [
  // Common Platform — NOW
  { id: "i-cp-now-1", productId: "p-common-platform", bucket: "NOW", title: "Sample workstream — auth flow migration", description: "Move remaining tenants off the legacy flow." },
  { id: "i-cp-now-2", productId: "p-sign-in", bucket: "NOW", title: "Sign-in latency reduction", description: "Sub-700ms p95 across Crime services." },
  { id: "i-cp-now-3", productId: "p-document-store", bucket: "NOW", title: "Schema v2 rollout", description: "Backwards-compatible migration to v2 envelope." },
  { id: "i-cp-now-4", productId: "p-document-store", bucket: "NOW", title: "Database upgrade", description: "Three remaining clusters." },
  { id: "i-cp-now-5", productId: "p-pay", bucket: "NOW", title: "Template content review", description: "Audit across existing payment templates." },
  { id: "i-cp-now-6", productId: "p-pay", bucket: "NOW", title: "Refunds queue redesign", description: "Cut median refund time." },
  { id: "i-cp-now-7", productId: "p-listings", bucket: "NOW", title: "Tenant A listings migration", description: "Move remaining listings off legacy by Q3." },
  { id: "i-cp-now-8", productId: "p-listings", bucket: "NOW", title: "Listing-conflict warning UI" },

  // Common Platform — NEXT
  { id: "i-cp-next-1", productId: "p-sign-in", bucket: "NEXT", title: "Passkeys pilot — internal users", description: "Small internal pilot group." },
  { id: "i-cp-next-2", productId: "p-common-platform", bucket: "NEXT", title: "Tenant self-service", description: "Let partner orgs manage their own users." },
  { id: "i-cp-next-3", productId: "p-document-store", bucket: "NEXT", title: "Bulk-record API", description: "Move records between tenants without downtime." },
  { id: "i-cp-next-4", productId: "p-sign-in", bucket: "NEXT", title: "Per-user mute and digest controls" },
  { id: "i-cp-next-5", productId: "p-pay", bucket: "NEXT", title: "Pay-by-bank pilot" },
  { id: "i-cp-next-6", productId: "p-listings", bucket: "NEXT", title: "Public hearing-lookup page" },
  { id: "i-cp-next-7", productId: "p-hmc", bucket: "NEXT", title: "Interpreter routing fix", description: "Mixed-language hearing routing." },

  // Common Platform — LATER
  { id: "i-cp-later-1", productId: "p-sign-in", bucket: "LATER", title: "Retire legacy identity brokers", description: "Decommission remaining brokers." },
  { id: "i-cp-later-2", productId: "p-document-store", bucket: "LATER", title: "Event-sourcing re-platform", description: "Long-term direction; sample spike only." },
  { id: "i-cp-later-3", productId: "p-pay", bucket: "LATER", title: "Bring letter print in-house" },
  { id: "i-cp-later-4", productId: "p-pay", bucket: "LATER", title: "Card-on-file for repeat users" },
  { id: "i-cp-later-5", productId: "p-common-platform", bucket: "LATER", title: "New tenant onboarding" },

  // Courtroom & Hearings — NOW
  { id: "i-ch-now-1", productId: "p-transcription", bucket: "NOW", title: "Legacy audio-store migration" },
  { id: "i-ch-now-2", productId: "p-transcription", bucket: "NOW", title: "Transcription supplier re-procurement" },
  { id: "i-ch-now-3", productId: "p-courtroom-display", bucket: "NOW", title: "Picker component rewrite" },
  { id: "i-ch-now-4", productId: "p-courtroom-display", bucket: "NOW", title: "Offline fallback for flaky Wi-Fi" },
  { id: "i-ch-now-5", productId: "p-hmc", bucket: "NOW", title: "Browser-based fallback for participants" },

  // Courtroom & Hearings — NEXT
  { id: "i-ch-next-1", productId: "p-transcription", bucket: "NEXT", title: "Speaker-attribution beta" },
  { id: "i-ch-next-2", productId: "p-hmc", bucket: "NEXT", title: "Phase 2 site rollout" },
  { id: "i-ch-next-3", productId: "p-hmc", bucket: "NEXT", title: "Interpreter routing" },

  // Courtroom & Hearings — LATER
  { id: "i-ch-later-1", productId: "p-hmc", bucket: "LATER", title: "Phase 2 site pilot" },
  { id: "i-ch-later-2", productId: "p-transcription", bucket: "LATER", title: "Voice-assisted capture spike" },
  { id: "i-ch-later-3", productId: "p-transcription", bucket: "LATER", title: "Recording retention review" },

  // Case Preparation — NOW
  { id: "i-cprep-now-1", productId: "p-resulting-assistant", bucket: "NOW", title: "Runtime upgrade across services" },
  { id: "i-cprep-now-2", productId: "p-resulting-assistant", bucket: "NOW", title: "Performance hotfix — sample workstream" },
  { id: "i-cprep-now-3", productId: "p-resulting-assistant", bucket: "NOW", title: "Lifecycle UI rebuild" },

  // Case Preparation — NEXT
  { id: "i-cprep-next-1", productId: "p-resulting-assistant", bucket: "NEXT", title: "Procedure consolidation" },
  { id: "i-cprep-next-2", productId: "p-resulting-assistant", bucket: "NEXT", title: "Partner-firm self-service onboarding" },

  // Case Preparation — LATER
  { id: "i-cprep-later-1", productId: "p-resulting-assistant", bucket: "LATER", title: "Open API for external consumers" },

  // Civil
  { id: "i-civ-now-1", productId: "p-civil-money-claims", bucket: "NOW", title: "Welsh-language form parity" },
  { id: "i-civ-now-2", productId: "p-civil-judgments", bucket: "NOW", title: "Bulk signing for high-volume firms" },
  { id: "i-civ-next-1", productId: "p-civil-money-claims", bucket: "NEXT", title: "Letter content review" },
  { id: "i-civ-later-1", productId: "p-civil-judgments", bucket: "LATER", title: "Open data feed" },

  // Family
  { id: "i-fam-now-1", productId: "p-family-care", bucket: "NOW", title: "Local-authority bulk import" },
  { id: "i-fam-now-2", productId: "p-family-care", bucket: "NOW", title: "Hearing-bundle generator" },
  { id: "i-fam-next-1", productId: "p-family-care", bucket: "NEXT", title: "Court-bundle PDF assembly" },

  // Tribunals
  { id: "i-trib-now-1", productId: "p-employment-claims", bucket: "NOW", title: "Multiple-claimant submission API" },
  { id: "i-trib-next-1", productId: "p-employment-claims", bucket: "NEXT", title: "Online help signposting" },
  { id: "i-trib-later-1", productId: "p-employment-claims", bucket: "LATER", title: "Outcome publication" },

  // Administrative
  { id: "i-adm-now-1", productId: "p-correspondence", bucket: "NOW", title: "Template review across products" },
  { id: "i-adm-next-1", productId: "p-correspondence", bucket: "NEXT", title: "Welsh-language audit" },
  { id: "i-adm-later-1", productId: "p-correspondence", bucket: "LATER", title: "Letter-quality survey" },
];

const activity: Seed["activity"] = [
  {
    id: "a-1",
    subject: "Common Platform",
    subjectHref: "/p/common-platform",
    description: "Added Java 21 upgrade chip to NOW.",
    kind: "roadmap-update",
    approver: "Priya Shah",
    approvedAt: "2026-05-17T09:14:00.000Z",
  },
  {
    id: "a-2",
    subject: "Hearings Management",
    subjectHref: "/p/hearings-management",
    description: "Welsh-interpreter logic fix added to NEXT.",
    kind: "new-chip",
    approver: "Sam Wright",
    approvedAt: "2026-05-16T15:20:00.000Z",
  },
  {
    id: "a-3",
    subject: "Resulting Assistant",
    subjectHref: "/p/resulting-assistant",
    description: "Sentence-type picker rewrite moved into NOW.",
    kind: "stage-change",
    approver: "Tom Frye",
    approvedAt: "2026-05-14T11:02:00.000Z",
  },
  {
    id: "a-4",
    subject: "Money Claims",
    subjectHref: "/p/civil-money-claims",
    description: "Postgres 17 upgrade added to NOW.",
    kind: "roadmap-update",
    approver: "Mo Khan",
    approvedAt: "2026-05-13T08:00:00.000Z",
  },
  {
    id: "a-5",
    subject: "Common Platform Domain",
    subjectHref: "/d/common-platform",
    description: "Edited 'Reduce platform sprawl'.",
    kind: "theme-update",
    approver: "Priya Shah",
    approvedAt: "2026-05-12T13:30:00.000Z",
  },
];

// Validate at module-load time so tests and the dev server both catch
// any drift between the schema and the seed.
export const portalContent = PortalContent.parse({
  jurisdictions,
  domains,
  teams,
  products,
  initiatives,
  activity,
});
