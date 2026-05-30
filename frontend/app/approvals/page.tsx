import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";

// Approvals queue — temporarily unavailable while the write-path is
// re-platformed onto the Python backend. The approvals queue returns
// in the follow-up write-path port release.
//
// Spec ref: §7.4. Write-path port plan: docs/superpowers/plans/

export default function ApprovalsListPage() {
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Approvals"
        title="Pending submissions"
        lede="The approvals queue is temporarily unavailable while we migrate the platform."
      />
      <Section eyebrow="Status" heading="Coming back online soon">
        <Card>
          <p className="text-[var(--color-ink-soft)]">
            The approvals queue is being re-platformed alongside the rest of
            the portal. The read path (Domains, Teams, Products, the roadmap
            matrix, search) continues to work as before. The write path and
            approvals workflow return in a follow-up release.
          </p>
        </Card>
      </Section>
    </div>
  );
}
