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
  // Tail of the in-flight metric-write chain. Production code
  // fire-and-forgets metric inserts; tests await this to assert
  // the recording happened. Mirrors AzureOpenAIParser.
  private metricChain: Promise<unknown> = Promise.resolve();

  // Test helper. Returns a promise that resolves once every metric
  // write fired off so far has settled. Not used in production.
  async flushMetricsForTests(): Promise<void> {
    await this.metricChain;
  }

  async parse(rawMarkdown: string): Promise<AiParseResult> {
    const startedAt = Date.now();
    try {
      const result = parseStrictTemplate(rawMarkdown);
      this.recordMetric({
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
      this.recordMetric({
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

  // Fire-and-forget metric write, tracked so tests can flush.
  // A metric-insert failure must never reject parse() — the DB blip
  // is logged for the platform's observability and otherwise swallowed.
  private recordMetric(
    ...args: Parameters<typeof recordParseMetric>
  ): void {
    const next = recordParseMetric(...args).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(
        "[ai-parser] recordParseMetric failed:",
        err instanceof Error ? err.message : String(err),
      );
    });
    this.metricChain = this.metricChain.then(() => next);
  }
}
