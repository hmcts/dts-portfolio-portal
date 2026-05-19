import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";

// Phase 1 foundation home page. Renders the AppShell + PageHeader +
// placeholder Section showing the visual primitives in production
// context. The roadmap matrix and recent-activity feed wire up in the
// pages chunk (1.9+).

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="HMCTS · Digital and Technology Services"
        title="What DTS is building, who runs it, and what's next."
        lede="One place to see the DTS landscape across all five Jurisdictions. Open a Domain to see who runs what. Click any chip on the roadmap to drill in. The detail still lives in Ardoq, Jira and Confluence — this is the front door."
        actions={
          <>
            <Button variant="outline">
              <Users size={14} aria-hidden="true" />
              Your team
            </Button>
            <Button variant="primary">
              <Plus size={14} aria-hidden="true" />
              Add content
            </Button>
          </>
        }
      />

      <Section
        eyebrow="Cross-DTS roadmap"
        heading="Now, next, later — across every Jurisdiction"
      >
        <Card>
          <p className="text-[var(--color-muted)]">
            The roadmap matrix lands in the pages chunk (Phase 1 task 1.9).
            See <code>docs/superpowers/plans/2026-05-15-dts-portfolio-portal.md</code> for the task list.
          </p>
        </Card>
      </Section>
    </div>
  );
}
