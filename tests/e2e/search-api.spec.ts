import { test, expect } from "@playwright/test";

// Smoke tests for /api/search. Goes through the real route handler
// (not the search() function directly) so we exercise the URL
// parsing, JSON shape, and dynamic = 'force-dynamic' behaviour.
//
// The seed db in CI may or may not have any entity rows depending on
// migration order; these tests only assert the shape and the empty-
// query short-circuit, not on specific hits.

test("/api/search with no q returns an empty result array", async ({ request }) => {
  const res = await request.get("/api/search");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.query).toBe("");
  expect(Array.isArray(body.results)).toBe(true);
  expect(body.results.length).toBe(0);
});

test("/api/search with a query returns the expected envelope shape", async ({ request }) => {
  const res = await request.get("/api/search?q=hello");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.query).toBe("hello");
  expect(Array.isArray(body.results)).toBe(true);
});

test("/api/search?counts=1 returns per-type counts", async ({ request }) => {
  const res = await request.get("/api/search?q=test&counts=1");
  const body = await res.json();
  expect(body.counts).toBeDefined();
  expect(body.counts).toHaveProperty("jurisdiction");
  expect(body.counts).toHaveProperty("domain");
  expect(body.counts).toHaveProperty("team");
  expect(body.counts).toHaveProperty("product");
  expect(body.counts).toHaveProperty("initiative");
});

test("/api/search ignores invalid type filters but keeps valid ones", async ({ request }) => {
  // The validity gate is server-side; an invalid type doesn't 400,
  // it's silently dropped. If all types are invalid the filter
  // becomes undefined which means "all".
  const res = await request.get("/api/search?q=anything&type=product,bogus");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.results)).toBe(true);
  // All results must be products
  for (const r of body.results) {
    expect(r.entityType).toBe("product");
  }
});

test("/api/search clamps limit to 50", async ({ request }) => {
  const res = await request.get("/api/search?q=anything&limit=9999");
  const body = await res.json();
  expect(body.results.length).toBeLessThanOrEqual(50);
});
