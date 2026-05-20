import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  entityNameFromParsedOutput,
  listPendingSubmissions,
} from "@/lib/audit-log/queries";

// Approvals index per requirements spec §7.4 — list of pending
// Submissions awaiting review. The detail screen at
// /approvals/[id] is the split-pane reviewer surface.

function formatRelative(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ApprovalsListPage() {
  const submissions = await listPendingSubmissions();

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Approvals"
        title="Pending submissions"
        lede="Markdown uploads sit here until an approver reviews the parsed output and publishes them. The original bytes are preserved append-only — approving never edits history, it stamps the row."
      />

      <Section
        eyebrow="Queue"
        heading={`${submissions.length} ${submissions.length === 1 ? "submission" : "submissions"} awaiting review`}
      >
        {submissions.length === 0 ? (
          <Card>
            <p className="text-[var(--color-muted)]">
              No submissions in the queue. Markdown uploads land here via the{" "}
              <Link href="/upload" className="underline">
                Add content
              </Link>{" "}
              page.
            </p>
          </Card>
        ) : (
          <Card padding={false}>
            <ul role="list" className="divide-y divide-[var(--color-border)]">
              {submissions.map((s) => {
                const name = entityNameFromParsedOutput(s.aiParsedOutput);
                return (
                  <li key={s.id}>
                    <Link
                      href={`/approvals/${s.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-surface-sunk)]"
                    >
                      <span
                        aria-hidden="true"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunk)] text-[var(--color-muted)]"
                      >
                        <FileText size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Eyebrow className="mb-0.5">{s.entityKind}</Eyebrow>
                        <div className="truncate text-[15px] font-medium text-[var(--color-ink)]">
                          {name ??
                            `Submission ${s.id.slice(0, 8)}…`}
                        </div>
                        <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                          From {s.submitter} · {formatRelative(s.submittedAt)} ·
                          SHA{" "}
                          <code className="font-mono">
                            {s.sourceMarkdownSha.slice(0, 8)}
                          </code>
                        </div>
                      </div>
                      <ArrowRight
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-[var(--color-muted)]"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </Section>
    </div>
  );
}
