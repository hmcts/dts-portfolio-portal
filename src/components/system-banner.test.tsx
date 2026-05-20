import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemBanner } from "./system-banner";

// Component tests for the system banner. The banner reads
// process.env synchronously via getAiParserHealth(), so each test
// sets the env vars before render. No DOM mutation between tests
// because beforeEach wipes the relevant keys.

const AI_ENV_KEYS = [
  "AI_PARSER_FORCE_FALLBACK",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_DEPLOYMENT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_API_VERSION",
];

describe("SystemBanner", () => {
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

  it("renders nothing when AI is online (returns null)", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
    const { container } = render(<SystemBanner />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("system-banner")).toBeNull();
  });

  it("renders the kill-switch message when AI_PARSER_FORCE_FALLBACK=true", () => {
    process.env.AI_PARSER_FORCE_FALLBACK = "true";
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
    render(<SystemBanner />);
    const banner = screen.getByTestId("system-banner");
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain("AI helper paused by ops");
    expect(banner.textContent).toContain("strict-template fallback");
  });

  it("renders the not-configured message when env vars are absent", () => {
    render(<SystemBanner />);
    const banner = screen.getByTestId("system-banner");
    expect(banner.textContent).toContain("AI helper not configured");
    expect(banner.textContent).toContain("AZURE_OPENAI_ENDPOINT");
  });

  it("uses role='status' with aria-live='polite' so screen readers announce non-intrusively", () => {
    render(<SystemBanner />);
    const banner = screen.getByTestId("system-banner");
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");
  });
});
