"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveSubmission } from "@/lib/audit-log/submission";
import { getSubmissionById } from "@/lib/audit-log/queries";
import { publishParsedSubmission } from "@/lib/publish/publish";

// Server actions for the approval screen per spec §7.4. The approve
// action stamps the Submission row with approver / approvedAt /
// versionNumber via the audit-log helper (the only DB-allowed
// mutation path on Submission — see migration
// 20260519200000_submission_append_only).
//
// Spec §7.7 permits self-approval in v1 (submitter == approver). The
// "4-eyes" feature flag in Phase 4 task 4.7 toggles this — for now
// the action allows it.

function decodeClientPrincipal(header: string | null): string | null {
  if (!header) return null;
  try {
    const json = Buffer.from(header, "base64").toString("utf8");
    const parsed = JSON.parse(json) as {
      userDetails?: string;
      claims?: Array<{ typ?: string; val?: string }>;
    };
    if (parsed.userDetails) return parsed.userDetails;
    const email = parsed.claims?.find(
      (c) =>
        c.typ === "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" ||
        c.typ === "preferred_username" ||
        c.typ === "email",
    )?.val;
    return email ?? null;
  } catch {
    return null;
  }
}

async function resolveApprover(): Promise<string> {
  const h = await headers();
  const principal = decodeClientPrincipal(h.get("x-ms-client-principal"));
  if (principal) return principal;
  const dev = h.get("x-dev-submitter");
  if (dev) return dev;
  if (process.env.NODE_ENV !== "production") {
    return process.env.DEV_FAKE_PRINCIPAL_EMAIL ?? "dev.user@justice.gov.uk";
  }
  throw new Error(
    "No authenticated approver identity found. Easy Auth header missing in a production environment.",
  );
}

export interface ApproveResult {
  ok: boolean;
  error?: string;
}

export async function approveSubmissionAction(
  submissionId: string,
  nextVersionNumber: number,
  notes?: string,
): Promise<ApproveResult> {
  let publishedSlug: string | null = null;
  let publishedKind: string | null = null;
  try {
    const submission = await getSubmissionById(submissionId);
    if (!submission) {
      return { ok: false, error: "Submission not found." };
    }
    if (submission.approver !== null) {
      return { ok: false, error: "Submission already approved." };
    }
    const approver = await resolveApprover();
    // Step 1 — publish: upsert the entity in the live tables. This
    // is the only path that writes to entity tables (spec §7.4).
    const published = await publishParsedSubmission(
      submission.aiParsedOutput,
    );
    publishedSlug = published.entitySlug;
    publishedKind = published.entityKind;
    // Step 2 — stamp the audit log row with the approve metadata
    // and the entityId of the published row.
    await approveSubmission({
      submissionId,
      approver,
      versionNumber: nextVersionNumber,
      entityId: published.entityId,
      ...(notes ? { notes } : {}),
    });
    revalidatePath("/approvals");
    revalidatePath(`/approvals/${submissionId}`);
    revalidatePath(`/${publishedKind === "jurisdiction" ? "j" : publishedKind === "domain" ? "d" : publishedKind === "team" ? "t" : "p"}/${publishedSlug}`);
    revalidatePath("/");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  // Redirect to the now-live entity page so the approver sees the
  // published result, not back to the approvals list.
  const route =
    publishedKind === "jurisdiction"
      ? `/j/${publishedSlug}`
      : publishedKind === "domain"
        ? `/d/${publishedSlug}`
        : publishedKind === "team"
          ? `/t/${publishedSlug}`
          : `/p/${publishedSlug}`;
  redirect(route);
}
