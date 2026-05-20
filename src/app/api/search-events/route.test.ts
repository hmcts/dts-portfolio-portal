import { describe, expect, it, vi, afterEach } from "vitest";
import type { RecordClickInput } from "@/lib/search/analytics";
import { handleSearchEvent } from "./route";

// Unit tests for the search-events route handler. The handler is
// extracted from POST() so a hand-written recorder stub can be
// injected directly — no module-level mocking, no framework magic.
// Three things this file pins that the existing e2e doesn't reach:
//
//   1. Zod boundary cases (length cap, position range, enum)
//   2. The "swallow DB failures and still return 204" contract
//   3. The input that's actually passed to the recorder is the
//      validated shape, not the raw body

// Hand-written recorder stub. Captures every call for assertion;
// `behaviour` lets the test decide whether each call resolves or
// rejects.
function makeRecorder(behaviour: "resolve" | "throw" = "resolve") {
  const calls: RecordClickInput[] = [];
  const fn = async (input: RecordClickInput): Promise<void> => {
    calls.push(input);
    if (behaviour === "throw") {
      throw new Error("Simulated DB outage");
    }
  };
  return { fn, calls };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/search-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Quiet the console.warn that the swallow path emits via the
// underlying recorder (we asserted on it elsewhere; here it's
// noise).
afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleSearchEvent — valid input", () => {
  it("returns 204 and passes the validated input to the recorder", async () => {
    const recorder = makeRecorder("resolve");
    const res = await handleSearchEvent(
      jsonRequest({
        kind: "click",
        query: "common platform",
        clickedEntityType: "product",
        clickedEntityId: "p1",
        clickedPosition: 0,
      }),
      recorder.fn,
    );
    expect(res.status).toBe(204);
    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]).toEqual({
      query: "common platform",
      clickedEntityType: "product",
      clickedEntityId: "p1",
      clickedPosition: 0,
    });
  });
});

describe("handleSearchEvent — Zod boundary cases", () => {
  it("rejects a query string longer than 500 characters", async () => {
    const recorder = makeRecorder();
    const res = await handleSearchEvent(
      jsonRequest({
        kind: "click",
        query: "a".repeat(501),
        clickedEntityType: "product",
        clickedEntityId: "p1",
        clickedPosition: 0,
      }),
      recorder.fn,
    );
    expect(res.status).toBe(400);
    expect(recorder.calls).toHaveLength(0);
  });

  it("accepts a query string of exactly 500 characters", async () => {
    const recorder = makeRecorder();
    const res = await handleSearchEvent(
      jsonRequest({
        kind: "click",
        query: "a".repeat(500),
        clickedEntityType: "product",
        clickedEntityId: "p1",
        clickedPosition: 0,
      }),
      recorder.fn,
    );
    expect(res.status).toBe(204);
  });

  it("rejects an empty query string", async () => {
    const recorder = makeRecorder();
    const res = await handleSearchEvent(
      jsonRequest({
        kind: "click",
        query: "",
        clickedEntityType: "product",
        clickedEntityId: "p1",
        clickedPosition: 0,
      }),
      recorder.fn,
    );
    expect(res.status).toBe(400);
  });

  it("rejects clickedPosition above the 100 ceiling", async () => {
    const recorder = makeRecorder();
    const res = await handleSearchEvent(
      jsonRequest({
        kind: "click",
        query: "q",
        clickedEntityType: "product",
        clickedEntityId: "p1",
        clickedPosition: 101,
      }),
      recorder.fn,
    );
    expect(res.status).toBe(400);
  });

  it("rejects clickedPosition below 0", async () => {
    const recorder = makeRecorder();
    const res = await handleSearchEvent(
      jsonRequest({
        kind: "click",
        query: "q",
        clickedEntityType: "product",
        clickedEntityId: "p1",
        clickedPosition: -1,
      }),
      recorder.fn,
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-integer clickedPosition", async () => {
    const recorder = makeRecorder();
    const res = await handleSearchEvent(
      jsonRequest({
        kind: "click",
        query: "q",
        clickedEntityType: "product",
        clickedEntityId: "p1",
        clickedPosition: 1.5,
      }),
      recorder.fn,
    );
    expect(res.status).toBe(400);
  });

  it("rejects an unknown clickedEntityType", async () => {
    const recorder = makeRecorder();
    const res = await handleSearchEvent(
      jsonRequest({
        kind: "click",
        query: "q",
        clickedEntityType: "submission", // not in the enum
        clickedEntityId: "p1",
        clickedPosition: 0,
      }),
      recorder.fn,
    );
    expect(res.status).toBe(400);
  });

  it("rejects a clickedEntityId longer than 64 characters", async () => {
    const recorder = makeRecorder();
    const res = await handleSearchEvent(
      jsonRequest({
        kind: "click",
        query: "q",
        clickedEntityType: "product",
        clickedEntityId: "a".repeat(65),
        clickedPosition: 0,
      }),
      recorder.fn,
    );
    expect(res.status).toBe(400);
  });
});

describe("handleSearchEvent — non-JSON body", () => {
  it("returns 400 when the body is not valid JSON", async () => {
    const recorder = makeRecorder();
    const req = new Request("http://localhost/api/search-events", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not json at all",
    });
    const res = await handleSearchEvent(req, recorder.fn);
    expect(res.status).toBe(400);
    expect(recorder.calls).toHaveLength(0);
  });
});

describe("handleSearchEvent — DB failure swallow contract", () => {
  it("still returns 204 even when the recorder throws", async () => {
    // Quiet the console.warn the underlying analytics module would
    // emit if this were the real recorder. Here we throw directly
    // inside the recorder stub so there's nothing to warn.
    const recorder = makeRecorder("throw");
    const res = await handleSearchEvent(
      jsonRequest({
        kind: "click",
        query: "common platform",
        clickedEntityType: "product",
        clickedEntityId: "p1",
        clickedPosition: 0,
      }),
      recorder.fn,
    );
    // Load-bearing contract per the inline comment in route.ts:
    // "analytics loss is preferable to a click failing."
    expect(res.status).toBe(204);
    // The recorder WAS called — we don't skip the recording attempt,
    // we just don't propagate its failure to the client.
    expect(recorder.calls).toHaveLength(1);
  });
});
