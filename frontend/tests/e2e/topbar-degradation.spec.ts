import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// E2E for the topbar's degradation slot (ADR-011 tier 3 / Phase 2
// task 2.14 follow-up). playwright.config.ts sets
// AI_PARSER_FORCE_FALLBACK=true on the webServer env, so the
// degradation slot is always populated in the e2e environment —
// these tests pin what the operator sees first thing when opening
// the portal.

test("the topbar shows the AI-degradation chunk on the home page", async ({
  page,
}) => {
  await page.goto("/");
  const degradation = page.getByTestId("ai-degradation");
  await expect(degradation).toBeVisible();
  await expect(degradation).toContainText("AI helper paused by ops");
});

test("the degradation chunk is rendered on every chrome-wrapped route", async ({
  page,
}) => {
  // Sample one of each entity-page route + the upload + ops surfaces.
  // The shell renders the topbar everywhere, so the degradation
  // chunk must appear regardless of which page the user landed on.
  const routes = [
    "/help",
    "/upload",
    "/approvals",
    "/ops/ai-cost",
    "/ops/search",
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(
      page.getByTestId("ai-degradation"),
      `degradation chunk missing on ${route}`,
    ).toBeVisible();
  }
});

test("the topbar with the degradation chunk passes axe WCAG 2.2 AA", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
