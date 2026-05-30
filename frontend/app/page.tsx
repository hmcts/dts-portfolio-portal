import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { RoadmapMatrix } from "@/components/roadmap-matrix";
import { ActivityFeed } from "@/components/activity-feed";
import { getActivity, getMatrix } from "@/lib/portal-data";

// Home page per requirements spec §5.2. Cross-DTS roadmap matrix
// grouped by Jurisdiction, with the first Jurisdiction's band
// expanded; followed by the "latest approved changes" activity feed
// pulled from the audit log.

export default async function HomePage() {
  const [matrix, activity] = await Promise.all([getMatrix(), getActivity()]);

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
