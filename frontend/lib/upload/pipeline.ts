// Write-path upload pipeline — unavailable during the write-path re-platform.
// The Prisma client has been removed in the Group K cutover.

export type UploadPipelineResult =
  | {
      ok: true;
      submissionId: string;
      sourceMarkdownSha: string;
      parseOk: boolean;
      parseSource: string;
      parseReason?: string;
      entityKind: "jurisdiction" | "domain" | "team" | "product";
      entityName: string;
    }
  | { ok: false; error: string };

export interface ProcessUploadInput {
  raw: string;
  submitter: string;
}

export async function processUpload(
  _input: ProcessUploadInput,
): Promise<UploadPipelineResult> {
  return {
    ok: false,
    error:
      "Upload is temporarily unavailable while the write path is re-platformed onto the Python backend.",
  };
}
