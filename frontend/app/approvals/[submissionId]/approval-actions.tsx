"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveSubmissionAction } from "./actions";

// Action row for the approval screen — Cancel / Save as draft /
// Approve and publish per spec §7.4. Save-as-draft would write to
// the Submission's aiParsedOutput (an allowed UPDATE column) once
// inline edits land in a follow-up. Approve and publish is the
// terminal action that stamps approver / approvedAt / versionNumber.

export function ApprovalActions({
  submissionId,
  alreadyApproved,
  nextVersionNumber,
}: {
  submissionId: string;
  alreadyApproved: boolean;
  nextVersionNumber: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (alreadyApproved) {
    return (
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-stage-live-bg)] text-[var(--color-stage-live-fg)]"
        >
          <CheckCircle2 size={16} />
        </span>
        <div>
          <div className="text-[14px] font-medium text-[var(--color-ink)]">
            Already approved
          </div>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            This submission has been approved and published. A new upload
            of the same entity creates a fresh Submission row; the audit
            log keeps both — history is never edited.
          </p>
        </div>
      </div>
    );
  }

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveSubmissionAction(
        submissionId,
        nextVersionNumber,
        notes || undefined,
      );
      // Successful approval triggers a server-side redirect to
      // /approvals via the action; we only get here if approve
      // returned an error.
      if (result && !result.ok) {
        setError(result.error ?? "Approval failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-[13px] font-medium text-[var(--color-ink)]">
          Notes (optional)
        </span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-label="Notes for the approval"
          placeholder="Any context the next reviewer should see — kept in the audit log alongside the approve event."
          className="mt-1 block w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-border-strong)]"
        />
      </label>

      {error ? (
        <div className="flex items-start gap-2 rounded border border-[var(--color-conf-low-fg)] bg-[var(--color-conf-low-bg)] p-3 text-[13px] text-[var(--color-conf-low-fg)]">
          <AlertTriangle
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/approvals")}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleApprove}
          disabled={isPending}
        >
          {isPending ? "Approving…" : "Approve and publish"}
        </Button>
        <p className="text-[12px] text-[var(--color-muted)]">
          Version <strong>{nextVersionNumber}</strong> will be stamped on
          the audit log row.
        </p>
      </div>
    </div>
  );
}
