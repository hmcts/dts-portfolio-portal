// Write-path publish module — unavailable during the write-path re-platform.
// The Prisma client has been removed in the Group K cutover.

export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}

export interface PublishResult {
  entityKind: "jurisdiction" | "domain" | "team" | "product";
  entityId: string;
  entitySlug: string;
  entityName: string;
}

export async function publishParsedSubmission(
  _aiParsedOutput: unknown,
): Promise<PublishResult> {
  throw new PublishError(
    "Publish write path unavailable: Prisma client removed in Group K cutover.",
  );
}
