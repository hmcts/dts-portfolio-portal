import { AzureOpenAIParser } from "./azure-openai";
import { TemplateFallbackParser } from "./template-fallback";
import type { AiParser } from "./types";

export type { AiParser, AiParseResult, AiParseSource, AiParseSuccess, AiParseFailure, ConfidenceFlags, ConfidenceLevel, UnrecognisedSection } from "./types";
export { AzureOpenAIParser } from "./azure-openai";
export { TemplateFallbackParser } from "./template-fallback";

// Factory: pick the appropriate parser based on environment.
//
//   - If AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT are set,
//     use AzureOpenAIParser (auth via managed identity in
//     production, or API key from AZURE_OPENAI_API_KEY for local dev
//     and CI smoke).
//   - Otherwise, use the strict-template fallback so the upload flow
//     never blocks waiting for AI provisioning.
//
// The choice is per-call (the parser is built each time you call
// getAiParser()) so a future env change picks up without a process
// restart. The cost is negligible — neither constructor does network
// I/O at construction time.

let cached: AiParser | undefined;

export function getAiParser(): AiParser {
  if (cached) return cached;

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
