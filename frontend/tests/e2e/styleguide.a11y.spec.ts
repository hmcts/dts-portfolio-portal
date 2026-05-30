import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Every primitive lives on /styleguide. Running the a11y scan there
// catches any colour-contrast or semantic-markup regression in the
// shared primitives before it propagates to real pages.

test("styleguide page has no WCAG 2.2 AA violations", async ({ page }) => {
  await page.goto("/styleguide");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
