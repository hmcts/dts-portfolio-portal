// Write-path audit-log queries — unavailable during the write-path
// re-platform. The Prisma client has been removed in the Group K cutover.

export async function listPendingSubmissions(): Promise<never[]> {
  throw new Error(
    "Audit-log queries unavailable: Prisma client removed in Group K cutover.",
  );
}

export async function getSubmissionById(_id: string): Promise<null> {
  throw new Error(
    "Audit-log queries unavailable: Prisma client removed in Group K cutover.",
  );
}

// Convenience: derive the entity name from the parsed output's
// front-matter shape. This is a pure function — no DB dependency.
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
