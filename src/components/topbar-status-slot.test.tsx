import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TopbarStatusSlot,
  isTopbarDegraded,
} from "./topbar-status-slot";

// Tests for the topbar's status slot — the bit that switches
// between the gov.uk "new service" copy and the AI degradation
// chunk. The slot reads process.env synchronously via
// getAiParserHealth(); each test sets env before render.

const AI_ENV_KEYS = [
  "AI_PARSER_FORCE_FALLBACK",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_DEPLOYMENT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_API_VERSION",
];

describe("TopbarStatusSlot", () => {
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

  describe("healthy state", () => {
    it("renders the 'new service' copy when AI endpoint + deployment are set", () => {
      process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
      process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
      render(<TopbarStatusSlot />);
      expect(screen.getByText(/This is a new service/)).toBeTruthy();
      expect(screen.queryByTestId("ai-degradation")).toBeNull();
    });

    it("isTopbarDegraded() returns false when healthy", () => {
      process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
      process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
      expect(isTopbarDegraded()).toBe(false);
    });
  });

  describe("kill-switch state", () => {
    beforeEach(() => {
      process.env.AI_PARSER_FORCE_FALLBACK = "true";
      process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
      process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
    });

    it("replaces the new-service copy with the kill-switch degradation chunk", () => {
      render(<TopbarStatusSlot />);
      const chunk = screen.getByTestId("ai-degradation");
      expect(chunk.textContent).toContain("AI helper paused by ops");
      expect(chunk.textContent).toContain("strict-template fallback");
      expect(screen.queryByText(/This is a new service/)).toBeNull();
    });

    it("isTopbarDegraded() returns true when kill-switched", () => {
      expect(isTopbarDegraded()).toBe(true);
    });
  });

  describe("not-configured state", () => {
    it("shows the not-configured copy when env vars are absent", () => {
      render(<TopbarStatusSlot />);
      const chunk = screen.getByTestId("ai-degradation");
      expect(chunk.textContent).toContain("AI helper not configured");
    });

    it("isTopbarDegraded() returns true when env is missing", () => {
      expect(isTopbarDegraded()).toBe(true);
    });
  });

  describe("ARIA contract on the degradation chunk", () => {
    it("uses role='status' + aria-live='polite' for non-intrusive SR announcements", () => {
      process.env.AI_PARSER_FORCE_FALLBACK = "true";
      render(<TopbarStatusSlot />);
      const chunk = screen.getByTestId("ai-degradation");
      expect(chunk.getAttribute("role")).toBe("status");
      expect(chunk.getAttribute("aria-live")).toBe("polite");
    });
  });
});
