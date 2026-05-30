import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { RoadmapMatrix } from "@/components/roadmap-matrix";
import { ActivityFeed } from "@/components/activity-feed";
import { getServerApiClient } from "@/lib/api-client-server";
import type { ActivityEntry, MatrixJurisdictionBand } from "@/lib/types";

// Home page per requirements spec §5.2. Cross-DTS roadmap matrix
// grouped by Jurisdiction, with the first Jurisdiction's band
// expanded; followed by the "latest approved changes" activity feed
// pulled from the audit log.

// --- API response shapes (snake_case from the Python backend) ---

interface ApiMatrixInitiative {
  id: string;
  product_id: string;
  product_name: string;
  product_href: string;
  bucket: string;
  title: string;
  description?: string | null;
  outbound_url?: string | null;
}

interface ApiMatrixDomainRow {
  domain: { id: string; slug: string; name: string; description?: string | null };
  product_count: number;
  cells: Record<string, ApiMatrixInitiative[]>;
}

interface ApiMatrixBand {
  jurisdiction: { id: string; slug: string; name: string; description?: string | null };
  domain_count: number;
  initiative_count: number;
  rows: ApiMatrixDomainRow[];
}

interface ApiActivityEntry {
  id: string;
  subject: string;
  subject_href: string;
  description: string;
  kind: ActivityEntry["kind"];
  approver: string;
  approved_at: string;
}

// --- Mappers from API shapes to component-expected shapes ---

function mapMatrix(bands: ApiMatrixBand[]): MatrixJurisdictionBand[] {
  return bands.map((b) => ({
    jurisdiction: {
      slug: b.jurisdiction.slug as MatrixJurisdictionBand["jurisdiction"]["slug"],
      name: b.jurisdiction.name,
      ...(b.jurisdiction.description
        ? { description: b.jurisdiction.description }
        : {}),
    },
    domainCount: b.domain_count,
    initiativeCount: b.initiative_count,
    rows: b.rows.map((r) => ({
      domain: {
        id: r.domain.id,
        slug: r.domain.slug,
        name: r.domain.name,
        ...(r.domain.description ? { description: r.domain.description } : {}),
        jurisdictionSlug:
          b.jurisdiction.slug as MatrixJurisdictionBand["jurisdiction"]["slug"],
        strategicThemes: [],
      },
      productCount: r.product_count,
      cells: {
        NOW: (r.cells["NOW"] ?? []).map(mapMatrixInitiative),
        NEXT: (r.cells["NEXT"] ?? []).map(mapMatrixInitiative),
        LATER: (r.cells["LATER"] ?? []).map(mapMatrixInitiative),
      },
    })),
  }));
}

function mapMatrixInitiative(i: ApiMatrixInitiative) {
  return {
    id: i.id,
    productId: i.product_id,
    productName: i.product_name,
    productHref: i.product_href,
    bucket: i.bucket as "NOW" | "NEXT" | "LATER",
    title: i.title,
    ...(i.description ? { description: i.description } : {}),
    ...(i.outbound_url ? { outboundUrl: i.outbound_url } : {}),
  };
}

function mapActivity(entries: ApiActivityEntry[]): ActivityEntry[] {
  return entries.map((e) => ({
    id: e.id,
    subject: e.subject,
    subjectHref: e.subject_href,
    description: e.description,
    kind: e.kind,
    approver: e.approver,
    approvedAt: e.approved_at,
  }));
}

export default async function HomePage() {
  const api = await getServerApiClient();
  const [rawMatrix, rawActivity] = await Promise.all([
    api.get<ApiMatrixBand[]>("/api/matrix"),
    api.get<ApiActivityEntry[]>("/api/activity"),
  ]);
  const matrix = mapMatrix(rawMatrix);
  const activity = mapActivity(rawActivity);

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="HMCTS · Digital and Technology Services"
        title="What DTS is building, who runs it, and what's next."
        lede="One place to see the DTS landscape across all five Jurisdictions. Open a Domain to see who runs what. Click any chip on the roadmap to drill in. The detail still lives in Ardoq, Jira and Confluence — this is the front door."
        actions={
          // "Your team" lived here in the prototype as a shortcut to
          // the signed-in user's team page. Without Phase 4 (Easy
          // Auth → Entra) there's no signed-in user to resolve, so
          // the button had no destination and shipped inert. Removed
          // until auth lands; restore alongside the user lookup.
          <Link href="/upload">
            <Button variant="primary">
              <Upload size={14} aria-hidden="true" />
              Add content
            </Button>
          </Link>
        }
      />

      <Section
        eyebrow="Cross-DTS roadmap"
        heading="Now, next, later — across every Jurisdiction"
        actions={
          <>
            <span className="text-[var(--color-muted)]">Jump to:</span>
            {matrix.map((band) => (
              <a
                key={band.jurisdiction.slug}
                href={`#band-${band.jurisdiction.slug}`}
                className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[13px] hover:bg-[var(--color-surface-sunk)]"
              >
                {band.jurisdiction.name}
              </a>
            ))}
          </>
        }
      >
        <RoadmapMatrix bands={matrix} />
      </Section>

      <Section eyebrow="Recent activity" heading="Latest approved changes across DTS">
        <ActivityFeed entries={activity} />
      </Section>
    </div>
  );
}
