import { test, expect } from "@playwright/test";

// E2E for the /api/answer-card endpoint (Phase 3 task 3.3). Pins
// the wire-level contract the overlay's eventual fetch will rely
// on. The e2e dev server doesn't have AZURE_OPENAI_ENDPOINT set
// (playwright.config.ts only sets AI_PARSER_FORCE_FALLBACK), so
// the synthesiser factory returns null and the route surfaces the
// "Azure OpenAI is not configured" unavailable response.
//
// The happy path (with a stubbed synth) is covered by the route's
// unit test in src/app/api/answer-card/route.test.ts.

test("/api/answer-card returns 'unavailable' when AOAI is not configured", async ({
  request,
}) => {
  const res = await request.post("/api/answer-card", {
    data: {
      query: "who runs common platform?",
      results: [
        {
          entityType: "product",
          name: "Common Platform",
          description: "Unified case-management platform.",
          href: "/p/common-platform",
        },
      ],
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.source).toBe("unavailable");
  expect(body.answer).toBeNull();
  expect(body.reason).toMatch(/not configured/i);
});

test("/api/answer-card rejects a missing query", async ({ request }) => {
  const res = await request.post("/api/answer-card", {
    data: { results: [] },
  });
  expect(res.status()).toBe(400);
});

test("/api/answer-card rejects a query longer than 500 characters", async ({
  request,
}) => {
  const res = await request.post("/api/answer-card", {
    data: { query: "a".repeat(501), results: [] },
  });
  expect(res.status()).toBe(400);
});

test("/api/answer-card rejects more than 20 results", async ({ request }) => {
  const tooMany = Array.from({ length: 21 }, (_, i) => ({
    entityType: "product",
    name: `Result ${i}`,
  }));
  const res = await request.post("/api/answer-card", {
    data: { query: "q", results: tooMany },
  });
  expect(res.status()).toBe(400);
});

test("/api/answer-card rejects a non-JSON body", async ({ request }) => {
  const res = await request.post("/api/answer-card", {
    data: "not json" as unknown as object,
    headers: { "content-type": "text/plain" },
  });
  expect(res.status()).toBe(400);
});
