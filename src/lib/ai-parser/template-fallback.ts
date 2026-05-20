import {
  parseStrictTemplate,
  type StrictTemplateResult,
} from "@/lib/markdown/template-parser";
import {
  IdentityParseError,
} from "@/lib/markdown/identity-parser";
import { recordParseMetric } from "./metrics";
import type {
  AiParser,
  AiParseResult,
  ConfidenceFlags,
} from "./types";

// Strict-template fallback. The AI-unavailable path per spec §7.5 —
// when Azure OpenAI is offline (or env not configured), this still
// accepts canonically-shaped markdown so the upload flow doesn't
// stall.
//
// Every field's confidence is "high" because the strict parser is
// deterministic — if the document matched the template, the output
// reflects exactly what the author wrote, no inference involved.

function flagFields(result: StrictTemplateResult): ConfidenceFlags {
  const flags: ConfidenceFlags = {};
  const output = result.output;

  switch (output.kind) {
    case "jurisdiction":
      if (output.about !== undefined) flags["about"] = "high";
      break;
    case "domain":
      if (output.body.about !== undefined) flags["about"] = "high";
      output.body.strategicThemes.forEach((_, i) => {
        flags[`strategicThemes[${i}].title`] = "high";
      });
      break;
    case "team":
      if (output.body.about !== undefined) flags["about"] = "high";
      if (output.body.whatWeOperate !== undefined)
        flags["whatWeOperate"] = "high";
      if (output.body.howToReachUs !== undefined)
        flags["howToReachUs"] = "high";
      output.body.links.forEach((_, i) => {
        flags[`links[${i}].label`] = "high";
      });
      break;
    case "product":
      if (output.body.about !== undefined) flags["about"] = "high";
      (["NOW", "NEXT", "LATER"] as const).forEach((bucket) => {
        output.body.roadmap[bucket].forEach((_, i) => {
          flags[`roadmap.${bucket}[${i}].title`] = "high";
        });
      });
      output.body.links.forEach((_, i) => {
        flags[`links[${i}].label`] = "high";
      });
      break;
  }

  return flags;
}

export class TemplateFallbackParser implements AiParser {
  async parse(rawMarkdown: string): Promise<AiParseResult> {
    const startedAt = Date.now();
    try {
      const result = parseStrictTemplate(rawMarkdown);
      fireAndForgetRecord({
        source: "strict-template",
        outcome: "success",
        latencyMs: Date.now() - startedAt,
      });
      return {
        ok: true,
        source: "strict-template",
        frontMatter: result.frontMatter,
        output: result.output,
        confidence: flagFields(result),
        // The strict parser doesn't carry a notion of "unrecognised
        // content" — by definition, anything outside the canonical
        // headers is invisible to it. The Phase 2 upload UI should
        // warn that uploads taking this path lose any non-canonical
        // sections; that's the trade-off for the AI-down fallback.
        unrecognised: [],
      };
    } catch (err) {
      const reason =
        err instanceof IdentityParseError
          ? `Front-matter invalid: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      fireAndForgetRecord({
        source: "strict-template",
        outcome: "failure",
        latencyMs: Date.now() - startedAt,
        failureReason: reason,
      });
      return {
        ok: false,
        source: "strict-template",
        reason,
      };
    }
  }
}

// Mirror of the same helper in azure-openai.ts. Keeps a metric write
// from rejecting the parse() promise if the DB is briefly unreachable.
function fireAndForgetRecord(
  ...args: Parameters<typeof recordParseMetric>
): void {
  recordParseMetric(...args).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn(
      "[ai-parser] recordParseMetric failed:",
      err instanceof Error ? err.message : String(err),
    );
  });
}
