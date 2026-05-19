import { notFound } from "next/navigation";
import { CheckCircle2, AlertTriangle, Clock, Cpu } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { StatusPill } from "@/components/ui/status-pill";
import { getSubmissionById } from "@/lib/audit-log/queries";
import { ApprovalActions } from "./approval-actions";

// Map the persisted aiParseSource string to a StatusPill descriptor.
// Reviewers need to know whether AOAI or the strict-template fallback
// produced the parse — when AOAI is offline the upload flow stays
// open via the fallback (spec §7.5), so a banner is the only way a
// human reviewer notices the degraded mode.
type ParseSourcePill = {
  tone: "blue" | "amber" | "grey";
  label: string;
};

function parseSourcePill(source: string | null): ParseSourcePill {
  switch (source) {
    case "azure-openai":
      return { tone: "blue", label: "Azure OpenAI" };
    case "strict-template":
      return { tone: "amber", label: "Strict template fallback" };
    case "stub":
      return { tone: "grey", label: "Test stub" };
    default:
      return { tone: "grey", label: "Unknown parser" };
  }
}

// Approval detail screen per requirements spec §7.4. Split-pane
// source-left, parsed-right; AI confidence flags surface as
// warnings; "I didn't know what to do with this" panel for
// unrecognised content; action row at the bottom.

type ConfidenceFlags = Record<string, "high" | "medium" | "low">;

type UnrecognisedSection = {
  heading: string;
  content: string;
  suggestion?: string;
};

interface ParsedShape {
  frontMatter?: { type?: string; name?: string };
  output?: unknown;
  confidence?: ConfidenceFlags;
  unrecognised?: UnrecognisedSection[];
}

function readConfidence(raw: unknown): ConfidenceFlags {
  if (raw && typeof raw === "object") return raw as ConfidenceFlags;
  return {};
}

function fmtPath(p: string): string {
  return p.replace(/\[(\d+)\]/g, " #$1").replace(/\./g, " › ");
}

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const submission = await getSubmissionById(submissionId);
  if (!submission) notFound();

  const sourceMarkdown = Buffer.from(submission.sourceMarkdown).toString(
    "utf8",
  );
  const parsed = (submission.aiParsedOutput ?? null) as ParsedShape | null;
  const confidence = readConfidence(submission.aiConfidenceFlags);
  const entityName = parsed?.frontMatter?.name ?? `Submission ${submissionId.slice(0, 8)}`;
  const lowConfidence = Object.entries(confidence).filter(
    ([, level]) => level !== "high",
  );
  const unrecognised: UnrecognisedSection[] = Array.isArray(parsed?.unrecognised)
    ? parsed.unrecognised
    : [];
  const alreadyApproved = submission.approver !== null;
  const sourcePill = parseSourcePill(submission.aiParseSource);

  return (
    <div className="mx-auto max-w-[1200px]">
      <Breadcrumbs
        items={[
          { label: "Approvals", href: "/approvals" },
          { label: entityName },
        ]}
        className="mb-4"
      />
      <PageHeader
        eyebrow={`Review ${submission.entityKind}`}
        title={entityName}
        lede={`Submitted by ${submission.submitter}. Source bytes are preserved verbatim in the audit log; this screen shows the AI's parse of those bytes. Approve to publish; save-as-draft to come back to it.`}
        actions={
          alreadyApproved ? (
            <StatusPill
              tone="green"
              icon={<CheckCircle2 size={12} aria-hidden="true" />}
              label={`Approved by ${submission.approver}`}
            />
          ) : (
            <StatusPill
              tone="amber"
              icon={<Clock size={12} aria-hidden="true" />}
              label="Awaiting approval"
            />
          )
        }
      />

      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-2">
        <Eyebrow>Parse source</Eyebrow>
        <StatusPill
          tone={sourcePill.tone}
          icon={<Cpu size={12} aria-hidden="true" />}
          label={sourcePill.label}
        />
        {submission.aiParseSource === "strict-template" ? (
          <span className="text-[12px] text-[var(--color-muted)]">
            Azure OpenAI was unavailable or the kill-switch is set — output is
            the strict-template fallback. Non-canonical sections are lost.
          </span>
        ) : null}
      </div>

      {lowConfidence.length > 0 ? (
        <Section
          eyebrow="AI confidence"
          heading={`${lowConfidence.length} field${lowConfidence.length === 1 ? "" : "s"} flagged for review`}
        >
          <Card>
            <ul role="list" className="space-y-2">
              {lowConfidence.map(([path, level]) => (
                <li
                  key={path}
                  className="flex items-start gap-2 text-[13px]"
                >
                  <AlertTriangle
                    size={14}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-[var(--color-conf-low-fg)]"
                  />
                  <div>
                    <span className="font-mono text-[12px] text-[var(--color-ink-soft)]">
                      {fmtPath(path)}
                    </span>{" "}
                    <span className="text-[var(--color-muted)]">
                      — {level} confidence
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      <Section eyebrow="Split view" heading="Source ↔ Parsed">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <Eyebrow className="mb-2">Source markdown</Eyebrow>
            <pre className="max-h-[480px] overflow-auto rounded bg-[var(--color-surface-sunk)] p-3 font-mono text-[12px] leading-relaxed text-[var(--color-ink-soft)]">
              {sourceMarkdown}
            </pre>
          </Card>
          <Card>
            <Eyebrow className="mb-2">Parsed output</Eyebrow>
            <pre className="max-h-[480px] overflow-auto rounded bg-[var(--color-surface-sunk)] p-3 font-mono text-[12px] leading-relaxed text-[var(--color-ink-soft)]">
              {JSON.stringify(parsed?.output ?? null, null, 2)}
            </pre>
          </Card>
        </div>
      </Section>

      {unrecognised.length > 0 ? (
        <Section
          eyebrow="Unrecognised sections"
          heading="Content the parser couldn't map"
        >
          <Card>
            <p className="mb-3 text-[13px] text-[var(--color-muted)]">
              The AI parser surfaced these sections rather than dropping
              them silently. Decide what to do with each — Phase 2 task
              2.6 wires the buttons; for now they're informational.
            </p>
            <ul role="list" className="space-y-3">
              {unrecognised.map((u, i) => (
                <li
                  key={`${u.heading}-${i}`}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-sunk)] p-3"
                >
                  <div className="text-[13px] font-medium text-[var(--color-ink)]">
                    {u.heading}
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--color-ink-soft)]">
                    {u.content}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      <Section eyebrow="Actions" heading="What happens next">
        <Card>
          <ApprovalActions
            submissionId={submission.id}
            alreadyApproved={alreadyApproved}
            nextVersionNumber={(submission.versionNumber ?? 0) + 1}
          />
        </Card>
      </Section>
    </div>
  );
}
