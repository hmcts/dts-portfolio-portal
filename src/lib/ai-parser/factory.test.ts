import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AzureOpenAIParser,
  TemplateFallbackParser,
  __resetAiParserForTests,
  getAiParser,
} from "./index";

describe("getAiParser factory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    __resetAiParserForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    __resetAiParserForTests();
    vi.unstubAllEnvs();
  });

  it("returns the template fallback when Azure OpenAI env is not set", () => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    expect(getAiParser()).toBeInstanceOf(TemplateFallbackParser);
  });

  it("returns the Azure OpenAI parser when endpoint + deployment are set", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://example-aoai.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o";
    process.env.AZURE_OPENAI_API_KEY = "test-key";
    expect(getAiParser()).toBeInstanceOf(AzureOpenAIParser);
  });

  it("falls back to template when only the endpoint is set (deployment required)", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://example-aoai.openai.azure.com";
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    expect(getAiParser()).toBeInstanceOf(TemplateFallbackParser);
  });

  it("caches the parser across calls within a process", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://example-aoai.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o";
    process.env.AZURE_OPENAI_API_KEY = "test-key";
    const first = getAiParser();
    const second = getAiParser();
    expect(second).toBe(first);
  });

  // Kill-switch per spec §7.5 / Phase 2 task 2.14. Even when AOAI env
  // is fully configured, AI_PARSER_FORCE_FALLBACK=true must short-
  // circuit the factory so ops can drill "AI is offline" without
  // tearing down the AOAI deployment, and so e2e tests can exercise
  // the fallback path deterministically.
  it.each(["true", "1"])(
    "returns the template fallback when AI_PARSER_FORCE_FALLBACK=%s, even with AOAI env set",
    (forced) => {
      process.env.AZURE_OPENAI_ENDPOINT =
        "https://example-aoai.openai.azure.com";
      process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o";
      process.env.AZURE_OPENAI_API_KEY = "test-key";
      process.env.AI_PARSER_FORCE_FALLBACK = forced;
      expect(getAiParser()).toBeInstanceOf(TemplateFallbackParser);
    },
  );

  it("ignores AI_PARSER_FORCE_FALLBACK when set to a non-truthy value", () => {
    process.env.AZURE_OPENAI_ENDPOINT =
      "https://example-aoai.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o";
    process.env.AZURE_OPENAI_API_KEY = "test-key";
    process.env.AI_PARSER_FORCE_FALLBACK = "false";
    expect(getAiParser()).toBeInstanceOf(AzureOpenAIParser);
  });
});
