import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Accessibility baseline test per CLAUDE.md engineering standard
// "Accessibility tests baked into the E2E suite". WCAG 2.2 AA gate
// per requirements spec §8.1 — every page gets an axe scan in CI.

test("home page has no WCAG 2.2 AA violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
