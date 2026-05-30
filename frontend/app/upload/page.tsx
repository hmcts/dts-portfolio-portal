import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";

// Upload screen — temporarily unavailable while the write-path is
// re-platformed onto the Python backend. The read path (Domains,
// Teams, Products, the roadmap matrix, search) continues to work as
// before. The write path returns in a follow-up release.
//
// Spec ref: §7.1. Write-path port plan: docs/superpowers/plans/

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Curate"
        title="Add content"
        lede="Upload is temporarily unavailable while we migrate the platform."
      />
      <Section eyebrow="Status" heading="Coming back online soon">
        <Card>
          <p className="text-[var(--color-ink-soft)]">
            The markdown upload + AI parse + approvals workflow is being
            re-platformed alongside the rest of the portal. The read path
            (Domains, Teams, Products, the roadmap matrix, search) continues
            to work as before. The write path returns in a follow-up release.
          </p>
        </Card>
      </Section>
    </div>
  );
}
