import type { Prisma } from "@prisma/client";
import { getAiParser } from "@/lib/ai-parser";
import { createSubmission } from "@/lib/audit-log/submission";

// Headless upload pipeline. The server action wraps this with header
// extraction for the submitter identity; tests call it directly.
//
// The pipeline runs in a deterministic order so a failure at any
// stage produces a typed result the caller can render:
//   1. Identity parse — front-matter declares the entity kind
//   2. AI parse — Azure OpenAI when configured, strict-template
//      fallback otherwise (per ADR-003)
//   3. Persist — appendonly Submission row carries the source bytes,
//      the AI output, and the per-field confidence flags

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
  input: ProcessUploadInput,
): Promise<UploadPipelineResult> {
  if (!input.raw || input.raw.trim() === "") {
    return {
      ok: false,
      error:
        "No markdown supplied. Drop a .md file or paste content into the text area.",
    };
  }

  // Single parser pass — the parser does its own identity-parse
  // internally. Calling parseIdentity twice trips a gray-matter
  // caching quirk where the second invocation returns a different
  // shape (the `orig` field carries the source instead of `matter`).
  const parseResult = await getAiParser().parse(input.raw);

  if (!parseResult.ok) {
    // Identity parse failed (no front-matter, malformed YAML, unknown
    // entity type, etc). We can't record a Submission without the
    // entity kind, so surface the reason and refuse the upload.
    // Spec §7.5 calls out a "draft + raw markdown" path for total
    // parse failure once auth lands; Phase 2 task 2.14 fleshes that
    // out. For now, the safest behaviour is to refuse.
    return { ok: false, error: parseResult.reason };
  }

  const bytes = Buffer.from(input.raw, "utf8");
  const { id, sourceMarkdownSha } = await createSubmission({
    entityKind: parseResult.frontMatter.type,
    submitter: input.submitter,
    sourceMarkdown: bytes,
    aiParsedOutput: parseResult.output as unknown as Prisma.InputJsonValue,
    aiConfidenceFlags: parseResult.confidence as unknown as Prisma.InputJsonValue,
  });

  return {
    ok: true,
    submissionId: id,
    sourceMarkdownSha,
    parseOk: true,
    parseSource: parseResult.source,
    entityKind: parseResult.frontMatter.type,
    entityName: parseResult.frontMatter.name,
  };
}
