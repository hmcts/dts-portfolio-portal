import { db } from "@/lib/db";

// Read-side queries over the Submission audit log. The write side is
// in src/lib/audit-log/submission.ts; these are the helpers Phase 2
// approval surfaces consume.

export async function listPendingSubmissions() {
  return db.submission.findMany({
    where: { approvedAt: null },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      entityKind: true,
      entityId: true,
      submitter: true,
      submittedAt: true,
      sourceMarkdownSha: true,
      versionNumber: true,
      aiParsedOutput: true,
      aiParseSource: true,
    },
  });
}

export async function getSubmissionById(id: string) {
  return db.submission.findUnique({
    where: { id },
  });
}

// Convenience: derive the entity name from the parsed output's
// front-matter shape. Used by the list view to show a friendly
// label without re-parsing the source bytes.
export function entityNameFromParsedOutput(
  parsedOutput: unknown,
): string | null {
  if (
    parsedOutput &&
    typeof parsedOutput === "object" &&
    "frontMatter" in parsedOutput &&
    parsedOutput.frontMatter &&
    typeof parsedOutput.frontMatter === "object" &&
    "name" in parsedOutput.frontMatter &&
    typeof (parsedOutput.frontMatter as { name?: unknown }).name === "string"
  ) {
    return (parsedOutput.frontMatter as { name: string }).name;
  }
  return null;
}
