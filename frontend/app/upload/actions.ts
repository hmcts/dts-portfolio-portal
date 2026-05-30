"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  processUpload,
  type UploadPipelineResult,
} from "@/lib/upload/pipeline";

// Server action for the upload form. Wraps the headless pipeline in
// src/lib/upload/pipeline.ts with submitter-identity extraction from
// Easy Auth (`X-MS-CLIENT-PRINCIPAL` header) per ADR-005, falling
// back to a dev shim in non-production environments so the form
// works without the Easy Auth sidecar attached.

export type { UploadPipelineResult as UploadActionResult } from "@/lib/upload/pipeline";

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

async function resolveSubmitter(): Promise<string> {
  const h = await headers();
  const principal = decodeClientPrincipal(h.get("x-ms-client-principal"));
  if (principal) return principal;
  // Local-dev fallback. Phase 4 task 4.2 rejects this header in
  // production builds; in dev/CI it lets the upload flow work
  // without the Easy Auth sidecar.
  const dev = h.get("x-dev-submitter");
  if (dev) return dev;
  if (process.env.NODE_ENV !== "production") {
    return process.env.DEV_FAKE_PRINCIPAL_EMAIL ?? "dev.user@justice.gov.uk";
  }
  throw new Error(
    "No authenticated submitter identity found on the request. Easy Auth header missing in a production environment.",
  );
}

export async function uploadMarkdownAction(
  formData: FormData,
): Promise<UploadPipelineResult> {
  const file = formData.get("markdownFile");
  const pasted = formData.get("markdownText");

  let raw: string;
  if (file instanceof File && file.size > 0) {
    raw = await file.text();
  } else if (typeof pasted === "string" && pasted.trim() !== "") {
    raw = pasted;
  } else {
    return {
      ok: false,
      error:
        "No markdown supplied. Drop a .md file or paste content into the text area.",
    };
  }

  const submitter = await resolveSubmitter();
  const result = await processUpload({ raw, submitter });

  // Revalidate any cached views that show pending submissions; the
  // approval screen (Phase 2 task 2.6) lists them. No-op until then.
  revalidatePath("/approvals");

  return result;
}
