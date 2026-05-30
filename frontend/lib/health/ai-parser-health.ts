// Health probe for the AI parser path per ADR-011 tier 3.
//
// "Online" here doesn't reach out to Azure OpenAI — it reflects the
// configured state of the process. There are three reasons the AI
// parser path may be degraded:
//
//   1. AI_PARSER_FORCE_FALLBACK is "true"/"1" — explicit ops kill-
//      switch. Uploads fall through to the strict-template parser.
//   2. AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_DEPLOYMENT is unset —
//      AOAI not provisioned. Same effective behaviour: template
//      fallback.
//   3. Otherwise the AzureOpenAI parser is live.
//
// A live network check would tell us more (the AOAI service might
// be slow or rate-limited) but it would also tie the dashboard to
// a network call per render. The configured-state read is cheap and
// captures the cases the operator actively manages.
//
// Mirrors the logic in src/lib/ai-parser/index.ts getAiParser() so
// the banner can't get out of sync with what the factory decides.

export interface AiParserHealth {
  online: boolean;
  // Filled when online === false; human-readable reason for the
  // system banner.
  reason?: "kill-switch" | "not-configured";
}

function isForceFallback(): boolean {
  const v = process.env.AI_PARSER_FORCE_FALLBACK;
  return v === "true" || v === "1";
}

export function getAiParserHealth(): AiParserHealth {
  if (isForceFallback()) {
    return { online: false, reason: "kill-switch" };
  }
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!endpoint || !deployment) {
    return { online: false, reason: "not-configured" };
  }
  return { online: true };
}
