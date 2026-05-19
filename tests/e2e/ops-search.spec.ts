import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// E2E for the search relevance dashboard at /ops/search (Phase 3
// task 3.7).

test("/ops/search renders the dashboard", async ({ page }) => {
  await page.goto("/ops/search");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Search relevance",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: /Activity/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: /Zero-result queries/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: /Queries with answers but zero clicks/,
    }),
  ).toBeVisible();
});

test("/ops/search passes axe with no WCAG 2.2 AA violations", async ({
  page,
}) => {
  await page.goto("/ops/search");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("/api/search-events accepts a well-formed click event", async ({
  request,
}) => {
  const res = await request.post("/api/search-events", {
    data: {
      kind: "click",
      query: "common platform",
      clickedEntityType: "product",
      clickedEntityId: "test-id",
      clickedPosition: 0,
    },
  });
  expect(res.status()).toBe(204);
});

test("/api/search-events rejects an invalid event shape", async ({
  request,
}) => {
  const res = await request.post("/api/search-events", {
    data: { kind: "click" }, // missing required fields
  });
  expect(res.status()).toBe(400);
});

test("/api/search-events rejects a non-JSON body", async ({ request }) => {
  const res = await request.post("/api/search-events", {
    data: "not json at all" as unknown as object,
    headers: { "content-type": "text/plain" },
  });
  expect(res.status()).toBe(400);
});
