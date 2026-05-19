import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Helpers for the append-only Submission audit log per spec §7.6.
// Append-only enforcement lives at the DB layer (see migration
// 20260519200000_submission_append_only); these helpers wrap the
// allowed-mutation paths so the rest of the app doesn't need to know
// which columns are sealed and which are settable at approve time.

export interface CreateSubmissionInput {
  entityKind: "jurisdiction" | "domain" | "team" | "product";
  entityId?: string;
  submitter: string;
  sourceMarkdown: Buffer | Uint8Array;
  aiParsedOutput?: Prisma.InputJsonValue;
  aiConfidenceFlags?: Prisma.InputJsonValue;
  // Which parser produced `aiParsedOutput` — see schema comment on
  // Submission.aiParseSource. Surfaces on the approval screen.
  aiParseSource?: string;
  notes?: string;
}

// SHA-256 hex of the raw source markdown. Used as the cache key for
// idempotent AI parsing (spec §7.5) and as a content-addressable
// reference between Submission and Approval events.
export function hashSourceMarkdown(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<{ id: string; sourceMarkdownSha: string }> {
  const buf =
    input.sourceMarkdown instanceof Buffer
      ? input.sourceMarkdown
      : Buffer.from(input.sourceMarkdown);
  const sourceMarkdownSha = hashSourceMarkdown(buf);

  const created = await db.submission.create({
    data: {
      entityKind: input.entityKind,
      entityId: input.entityId ?? null,
      submitter: input.submitter,
      sourceMarkdown: buf,
      sourceMarkdownSha,
      aiParsedOutput: input.aiParsedOutput ?? Prisma.JsonNull,
      aiConfidenceFlags: input.aiConfidenceFlags ?? Prisma.JsonNull,
      aiParseSource: input.aiParseSource ?? null,
      notes: input.notes ?? null,
    },
    select: { id: true, sourceMarkdownSha: true },
  });

  return created;
}

export interface ApproveSubmissionInput {
  submissionId: string;
  approver: string;
  versionNumber: number;
  notes?: string;
}

export async function approveSubmission(
  input: ApproveSubmissionInput,
): Promise<void> {
  await db.submission.update({
    where: { id: input.submissionId },
    data: {
      approver: input.approver,
      approvedAt: new Date(),
      versionNumber: input.versionNumber,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
}

