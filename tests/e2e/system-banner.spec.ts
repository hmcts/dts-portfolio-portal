import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// E2E for the system-degradation banner (ADR-011 tier 3 / Phase 2
// task 2.14 follow-up). playwright.config.ts sets
// AI_PARSER_FORCE_FALLBACK=true on the webServer env, so the banner
// is always present in the e2e environment — these tests pin the
// behaviour the operator sees first thing when opening the portal.

test("the kill-switch banner is present on the home page", async ({
  page,
}) => {
  await page.goto("/");
  const banner = page.getByTestId("system-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("AI helper paused by ops");
});

test("the banner is rendered on every chrome-wrapped route, not just /", async ({
  page,
}) => {
  // Sample one of each entity-page route + the upload + ops surfaces.
  // The shell renders the banner above the topbar so it must appear
  // regardless of which page the user landed on.
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
      page.getByTestId("system-banner"),
      `banner missing on ${route}`,
    ).toBeVisible();
  }
});

test("the banner does not introduce a WCAG 2.2 AA violation on the home page", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
