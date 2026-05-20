import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// E2E for the AI cost dashboard at /ops/ai-cost (Phase 2 task 2.13).
// Doesn't seed metric data — proves the page renders, the budget
// section explains the env var when unset, and axe is clean.

test("/ops/ai-cost renders the dashboard", async ({ page }) => {
  await page.goto("/ops/ai-cost");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "AI parsing activity",
  );
  // Budget pulse section is always present, regardless of seed state.
  await expect(page.getByText("Budget pulse")).toBeVisible();
  await expect(page.getByText("Daily parses by source")).toBeVisible();
});

test("/ops/ai-cost passes axe with no WCAG 2.2 AA violations", async ({
  page,
}) => {
  await page.goto("/ops/ai-cost");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
