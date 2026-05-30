import type { StrictTemplateResult } from "@/lib/markdown/template-parser";

// Public interface for the AI parser per requirements spec §7.5. The
// shape is intentionally the same as the strict-template parser
// produces — so the approve-and-publish flow doesn't need to know
// which source path was used. Confidence flags and unrecognised
// sections are sidecars the approver UI surfaces (§7.4).

export type AiParseSource = "azure-openai" | "strict-template" | "stub";

export type ConfidenceLevel = "high" | "medium" | "low";

// Field-level confidence. Keys are JSON-pointer-style paths matching
// the structure of `output.body` (e.g. "about", "strategicThemes[0].title",
// "roadmap.NOW[1].description"). The approver UI highlights anything
// below "high" so the reviewer can verify.
export type ConfidenceFlags = Record<string, ConfidenceLevel>;

// Content the parser saw in the source but didn't know what to do
// with. Per §7.5, AI must surface this rather than silently drop it.
// The approval screen lets the reviewer pick a disposition.
export interface UnrecognisedSection {
  heading: string;
  content: string;
  suggestion?: "drop" | "add-as-note" | "fix-in-source";
}

export type AiParseSuccess = StrictTemplateResult & {
  ok: true;
  source: AiParseSource;
  confidence: ConfidenceFlags;
  unrecognised: UnrecognisedSection[];
};

export interface AiParseFailure {
  ok: false;
  source: AiParseSource;
  reason: string;
}

export type AiParseResult = AiParseSuccess | AiParseFailure;

// The AI parser interface every implementation conforms to.
export interface AiParser {
  parse(rawMarkdown: string): Promise<AiParseResult>;
}
