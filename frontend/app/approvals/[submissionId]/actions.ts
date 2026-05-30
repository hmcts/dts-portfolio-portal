"use server";

// Write-path approval actions — unavailable during the write-path re-platform.
// The Prisma client has been removed in the Group K cutover.

export interface ApproveResult {
  ok: boolean;
  error?: string;
}

export async function approveSubmissionAction(
  _submissionId: string,
  _nextVersionNumber: number,
  _notes?: string,
): Promise<ApproveResult> {
  return {
    ok: false,
    error:
      "The approval action is temporarily unavailable while the write path is re-platformed onto the Python backend.",
  };
}
