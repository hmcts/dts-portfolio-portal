"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveSubmission } from "@/lib/audit-log/submission";

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
  try {
    const approver = await resolveApprover();
    await approveSubmission({
      submissionId,
      approver,
      versionNumber: nextVersionNumber,
      ...(notes ? { notes } : {}),
    });
    revalidatePath("/approvals");
    revalidatePath(`/approvals/${submissionId}`);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  redirect("/approvals");
}
