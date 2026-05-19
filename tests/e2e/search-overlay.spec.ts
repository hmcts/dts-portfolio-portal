import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// E2E for the instant search overlay (Phase 3 task 3.4) and the
// deep results page (task 3.5). Both consume /api/search (Phase 3
// task 3.2) so the tests don't seed data — they exercise the UX
// regardless of whether the DB has entity rows.

test("Typing into the search input shows the overlay headline", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("Search the portal");
  await input.fill("crime");
  // The headline shows "N matches" or "No matches" once the
  // request completes. Either is a valid sign the overlay is wired.
  await expect(page.getByRole("listbox", { name: /Search results/ })).toBeVisible();
});

test('"/" keyboard shortcut focuses the search input from anywhere', async ({
  page,
}) => {
  await page.goto("/");
  // Move focus to a non-input element first
  await page.locator("h1").click();
  await page.keyboard.press("/");
  await expect(page.getByLabel("Search the portal")).toBeFocused();
});

test("Escape closes the overlay and blurs the input", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Search the portal");
  await input.fill("anything");
  await expect(
    page.getByRole("listbox", { name: /Search results/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(input).not.toBeFocused();
});

test("/search?q=... renders the deep results page with the query in the header", async ({
  page,
}) => {
  await page.goto("/search?q=Common%20Platform");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    'Results for "Common Platform"',
  );
});

test("/search with no query shows the empty-state copy", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Search the portal",
  );
});

test("/search?q=... passes axe with no WCAG 2.2 AA violations", async ({
  page,
}) => {
  await page.goto("/search?q=Common%20Platform");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
