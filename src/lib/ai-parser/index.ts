import { AzureOpenAIParser } from "./azure-openai";
import { TemplateFallbackParser } from "./template-fallback";
import type { AiParser } from "./types";

export type { AiParser, AiParseResult, AiParseSource, AiParseSuccess, AiParseFailure, ConfidenceFlags, ConfidenceLevel, UnrecognisedSection } from "./types";
export { AzureOpenAIParser } from "./azure-openai";
export { TemplateFallbackParser } from "./template-fallback";

// Factory: pick the appropriate parser based on environment.
//
//   - If AI_PARSER_FORCE_FALLBACK is truthy (`"true"` or `"1"`), the
//     template fallback is returned regardless of any other env. This
//     is the ops kill-switch for "AOAI is offline" drills (spec §7.5
//     — the portal MUST stay up when AOAI is down) and the lever the
//     e2e fallback test pulls.
//   - Otherwise, if AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT
//     are set, use AzureOpenAIParser (auth via managed identity in
//     production, or API key from AZURE_OPENAI_API_KEY for local dev
//     and CI smoke).
//   - Otherwise, use the strict-template fallback so the upload flow
//     never blocks waiting for AI provisioning.
//
// The choice is cached for the process lifetime; tests reset via
// __resetAiParserForTests(). Construction is cheap (no network I/O)
// so per-call recomputation would be fine — caching exists only to
// keep a single instance for instanceof checks.

let cached: AiParser | undefined;

function isForceFallback(): boolean {
  const v = process.env.AI_PARSER_FORCE_FALLBACK;
  return v === "true" || v === "1";
}

export function getAiParser(): AiParser {
  if (cached) return cached;

  if (isForceFallback()) {
    cached = new TemplateFallbackParser();
    return cached;
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (endpoint && deployment) {
    cached = new AzureOpenAIParser({
      endpoint,
      deployment,
      ...(apiVersion ? { apiVersion } : {}),
      ...(apiKey ? { apiKey } : {}),
    });
    return cached;
  }

  cached = new TemplateFallbackParser();
  return cached;
}

// Test helper — reset the cached parser. Lets tests change env vars
// between cases without process restart.
export function __resetAiParserForTests(): void {
  cached = undefined;
}
