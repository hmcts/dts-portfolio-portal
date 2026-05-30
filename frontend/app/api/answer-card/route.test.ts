import { describe, expect, it } from "vitest";
import type {
  AnswerCardResult,
  AnswerCardResultInput,
} from "@/lib/ai-answer/answer-card";
import { handleAnswerCard, type AnswerCardSynth } from "./route";

// Unit tests for the answer-card POST handler. Hand-written synth
// stub injected via handleAnswerCard's second argument — no
// mocking framework, no module-level replacement. The real POST()
// wires the production synthesiser; tests use a stub that returns
// canned AnswerCardResult values.

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/answer-card", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Hand-written synth stub. Captures every call's (query, results)
// pair, returns whatever AnswerCardResult the test configures.
function makeSynth(result: AnswerCardResult): {
  synth: NonNullable<AnswerCardSynth>;
  calls: Array<{ query: string; results: AnswerCardResultInput[] }>;
} {
  const calls: Array<{ query: string; results: AnswerCardResultInput[] }> = [];
  return {
    calls,
    synth: {
      async synthesise(query, results) {
        calls.push({ query, results });
        return result;
      },
    },
  };
}

const VALID_BODY = {
  query: "who runs common platform?",
  results: [
    {
      entityType: "product",
      name: "Common Platform",
      description: "Unified case management for Crown courts.",
      href: "/p/common-platform",
    },
  ],
};

describe("handleAnswerCard — happy path", () => {
  it("returns the synth's AnswerCardSuccess as JSON with status 200", async () => {
    const synth = makeSynth({
      source: "azure-openai",
      answer: "Common Platform is the unified case-management platform.",
      citations: [0],
    });
    const res = await handleAnswerCard(jsonRequest(VALID_BODY), synth.synth);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("azure-openai");
    expect(body.answer).toContain("Common Platform");
    expect(body.citations).toEqual([0]);
    expect(synth.calls).toHaveLength(1);
    expect(synth.calls[0]!.query).toBe("who runs common platform?");
    expect(synth.calls[0]!.results).toHaveLength(1);
  });

  it("passes the synth's AnswerCardUnavailable through unchanged when the model declines", async () => {
    const synth = makeSynth({
      source: "unavailable",
      answer: null,
      reason: "Model declined to answer (insufficient grounding)",
    });
    const res = await handleAnswerCard(jsonRequest(VALID_BODY), synth.synth);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("unavailable");
    expect(body.answer).toBeNull();
    expect(body.reason).toMatch(/declined/i);
  });
});

describe("handleAnswerCard — synth not configured", () => {
  it("returns a clean 'unavailable' when synth is null (Azure OpenAI not configured)", async () => {
    const res = await handleAnswerCard(jsonRequest(VALID_BODY), null);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("unavailable");
    expect(body.answer).toBeNull();
    expect(body.reason).toMatch(/not configured/i);
  });
});

describe("handleAnswerCard — Zod validation", () => {
  it("rejects a body with no query field", async () => {
    const synth = makeSynth({
      source: "unavailable",
      answer: null,
      reason: "should not be called",
    });
    const res = await handleAnswerCard(
      jsonRequest({ results: [] }),
      synth.synth,
    );
    expect(res.status).toBe(400);
    expect(synth.calls).toHaveLength(0);
  });

  it("rejects an empty query string", async () => {
    const synth = makeSynth({
      source: "unavailable",
      answer: null,
      reason: "x",
    });
    const res = await handleAnswerCard(
      jsonRequest({ query: "", results: [] }),
      synth.synth,
    );
    expect(res.status).toBe(400);
  });

  it("rejects a query longer than 500 characters", async () => {
    const synth = makeSynth({
      source: "unavailable",
      answer: null,
      reason: "x",
    });
    const res = await handleAnswerCard(
      jsonRequest({ query: "a".repeat(501), results: [] }),
      synth.synth,
    );
    expect(res.status).toBe(400);
  });

  it("rejects a results array with more than 20 entries", async () => {
    const synth = makeSynth({
      source: "unavailable",
      answer: null,
      reason: "x",
    });
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      entityType: "product",
      name: `Result ${i}`,
    }));
    const res = await handleAnswerCard(
      jsonRequest({ query: "q", results: tooMany }),
      synth.synth,
    );
    expect(res.status).toBe(400);
  });

  it("accepts an empty results array — the synth handles that case itself", async () => {
    const synth = makeSynth({
      source: "unavailable",
      answer: null,
      reason: "No results to ground in",
    });
    const res = await handleAnswerCard(
      jsonRequest({ query: "q", results: [] }),
      synth.synth,
    );
    expect(res.status).toBe(200);
    expect(synth.calls).toHaveLength(1);
  });

  it("rejects a result missing required fields", async () => {
    const synth = makeSynth({
      source: "unavailable",
      answer: null,
      reason: "x",
    });
    const res = await handleAnswerCard(
      jsonRequest({ query: "q", results: [{ entityType: "product" }] }),
      synth.synth,
    );
    expect(res.status).toBe(400);
  });

  it("accepts null description and null href on a result (the optional fields)", async () => {
    const synth = makeSynth({
      source: "azure-openai",
      answer: "ok",
      citations: [],
    });
    const res = await handleAnswerCard(
      jsonRequest({
        query: "q",
        results: [
          { entityType: "domain", name: "D", description: null, href: null },
        ],
      }),
      synth.synth,
    );
    expect(res.status).toBe(200);
  });
});

describe("handleAnswerCard — non-JSON body", () => {
  it("returns 400 when the body is not valid JSON", async () => {
    const synth = makeSynth({
      source: "unavailable",
      answer: null,
      reason: "x",
    });
    const req = new Request("http://localhost/api/answer-card", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not json",
    });
    const res = await handleAnswerCard(req, synth.synth);
    expect(res.status).toBe(400);
    expect(synth.calls).toHaveLength(0);
  });
});
