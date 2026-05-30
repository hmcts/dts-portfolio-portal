import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";

// Approval detail screen — temporarily unavailable while the write-path is
// re-platformed onto the Python backend. Returns when the write path returns.
//
// Spec ref: §7.4. Write-path port plan: docs/superpowers/plans/

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Approvals"
        title={`Submission ${submissionId.slice(0, 8)}`}
        lede="The approvals queue is temporarily unavailable while we migrate the platform."
      />
      <Section eyebrow="Status" heading="Coming back online soon">
        <Card>
          <p className="text-[var(--color-ink-soft)]">
            The approval detail view is being re-platformed alongside the rest of
            the portal. The read path (Domains, Teams, Products, the roadmap
            matrix, search) continues to work as before. The write path and
            approvals workflow return in a follow-up release.
          </p>
        </Card>
      </Section>
    </div>
  );
}
