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
});
