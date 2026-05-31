import { createHash } from "node:crypto";

// Write-path audit-log submission helpers — unavailable during the
// write-path re-platform. The Prisma client has been removed in the
// Group K cutover.

export interface CreateSubmissionInput {
  entityKind: "jurisdiction" | "domain" | "team" | "product";
  entityId?: string;
  submitter: string;
  sourceMarkdown: Buffer | Uint8Array;
  // Typed as unknown: previously Prisma.InputJsonValue, removed with Prisma.
  aiParsedOutput?: unknown;
  aiConfidenceFlags?: unknown;
  aiParseSource?: string;
  notes?: string;
}

// SHA-256 hex of the raw source markdown. Pure function — no DB dependency.
export function hashSourceMarkdown(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function createSubmission(
  _input: CreateSubmissionInput,
): Promise<{ id: string; sourceMarkdownSha: string }> {
  throw new Error(
    "Submission write path unavailable: Prisma client removed in Group K cutover.",
  );
}

export interface ApproveSubmissionInput {
  submissionId: string;
  approver: string;
  versionNumber: number;
  notes?: string;
  entityId?: string;
}

export async function approveSubmission(
  _input: ApproveSubmissionInput,
): Promise<void> {
  throw new Error(
    "Submission approve path unavailable: Prisma client removed in Group K cutover.",
  );
}
