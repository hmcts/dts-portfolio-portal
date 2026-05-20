import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAiParserHealth } from "./ai-parser-health";

// Unit tests for the AI-parser health probe.
//
// Each case wipes the AI env vars first so the test is independent
// of whatever the dev shell or playwright config has set.

const AI_ENV_KEYS = [
  "AI_PARSER_FORCE_FALLBACK",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_DEPLOYMENT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_API_VERSION",
];

describe("getAiParserHealth", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of AI_ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of AI_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("reports online when endpoint + deployment are set and the kill-switch is off", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
    expect(getAiParserHealth()).toEqual({ online: true });
  });

  it.each(["true", "1"])(
    "reports degraded with reason 'kill-switch' when AI_PARSER_FORCE_FALLBACK=%s",
    (v) => {
      process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
      process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
      process.env.AI_PARSER_FORCE_FALLBACK = v;
      expect(getAiParserHealth()).toEqual({
        online: false,
        reason: "kill-switch",
      });
    },
  );

  it.each(["false", "0", "no", "", "anything-else"])(
    "treats AI_PARSER_FORCE_FALLBACK=%j as off (online stays true when configured)",
    (v) => {
      process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
      process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
      process.env.AI_PARSER_FORCE_FALLBACK = v;
      expect(getAiParserHealth().online).toBe(true);
    },
  );

  it("reports degraded with reason 'not-configured' when endpoint is missing", () => {
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
    expect(getAiParserHealth()).toEqual({
      online: false,
      reason: "not-configured",
    });
  });

  it("reports degraded with reason 'not-configured' when deployment is missing", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    expect(getAiParserHealth()).toEqual({
      online: false,
      reason: "not-configured",
    });
  });

  it("reports degraded with reason 'not-configured' when both are missing", () => {
    expect(getAiParserHealth()).toEqual({
      online: false,
      reason: "not-configured",
    });
  });

  it("kill-switch takes precedence over not-configured (operator intent over inferred state)", () => {
    // The operator has explicitly turned AI off — that's the more
    // informative signal than "we don't have the env vars anyway".
    process.env.AI_PARSER_FORCE_FALLBACK = "true";
    // Endpoint/deployment absent.
    expect(getAiParserHealth().reason).toBe("kill-switch");
  });
});
