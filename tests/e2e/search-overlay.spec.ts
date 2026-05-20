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

test("⌘/Ctrl-K keyboard shortcut focuses the search input", async ({
  page,
  browserName: _browserName,
}) => {
  await page.goto("/");
  await page.locator("h1").click();
  // Use Control on Linux/Windows; Meta on macOS. Playwright's
  // KeyboardModifier doesn't auto-translate, so press both modifiers
  // — the handler accepts either.
  await page.keyboard.press("Control+K");
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

// Canned /api/search response used by the keyboard-nav tests below.
// Hrefs point at routes that already exist on the site so the actual
// navigation succeeds and the URL assertion is meaningful. (The overlay
// passes hrefs through Next's <Link>, which performs a client-side
// route change.)
const STUB_RESULTS = {
  results: [
    {
      entityType: "domain",
      id: "d1",
      slug: "stub-domain-1",
      name: "Stub Domain Alpha",
      description: "First stubbed result for keyboard-nav tests",
      rank: 0.9,
      href: "/help",
    },
    {
      entityType: "team",
      id: "t1",
      slug: "stub-team-1",
      name: "Stub Team Beta",
      description: "Second stubbed result",
      rank: 0.8,
      href: "/styleguide",
    },
    {
      entityType: "product",
      id: "p1",
      slug: "stub-product-1",
      name: "Stub Product Gamma",
      description: "Third stubbed result",
      rank: 0.7,
      href: "/upload",
    },
  ],
};

test("Up/Down/Enter navigates the result list and opens the highlighted result", async ({
  page,
}) => {
  // Intercept /api/search so the overlay always shows three known
  // results regardless of DB state.
  await page.route("**/api/search?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(STUB_RESULTS),
    });
  });

  await page.goto("/");
  await page.getByLabel("Search the portal").fill("stub");
  const listbox = page.getByRole("listbox", { name: /Search results/ });
  await expect(listbox).toBeVisible();

  // Three results rendered.
  const options = listbox.getByRole("option");
  await expect(options).toHaveCount(3);
  // The first option is highlighted by default (the overlay's
  // `active` index starts at 0 — verified by the aria-selected
  // attribute).
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");

  // Down arrow moves the highlight; Up arrow moves it back.
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(2)).toHaveAttribute("aria-selected", "true");
  // Bound: another ArrowDown stays at the last index.
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(2)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");

  // Enter opens the currently-highlighted result. The second result
  // points at /styleguide.
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/styleguide$/);
});

test("Enter with no result highlighted submits to /search?q=...", async ({
  page,
}) => {
  // Intercept /api/search to return ZERO results so there is nothing
  // for Enter to "open" — the handler should fall through to
  // /search?q=...
  await page.route("**/api/search?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Search the portal").fill("no-such-thing");
  // Wait for the listbox to be open with the empty-state copy so
  // we know the fetch settled before pressing Enter.
  await expect(
    page.getByRole("listbox", { name: /Search results/ }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=no-such-thing/);
});

test("Clicking a result navigates to its href", async ({ page }) => {
  await page.route("**/api/search?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(STUB_RESULTS),
    });
  });

  await page.goto("/");
  await page.getByLabel("Search the portal").fill("stub");
  const listbox = page.getByRole("listbox", { name: /Search results/ });
  await expect(listbox).toBeVisible();

  // Click the third result (Stub Product Gamma → /upload).
  await listbox.getByRole("option").nth(2).click();
  await expect(page).toHaveURL(/\/upload$/);
});

test('/search "All" filter chip strips any active type parameter', async ({
  page,
}) => {
  // The per-type chips (Domains / Teams / Products) only render when
  // the DB has matching rows for that type — testing them needs
  // seeded entity data, which e2e doesn't currently set up. The
  // "All" chip is always rendered regardless, so its href contract
  // is what we pin here:
  //   * Visit /search?q=foo&type=domain (a type-filtered URL)
  //   * The "All" chip's href should drop the type param
  //   * Clicking it should land on /search?q=foo (no type)
  await page.goto("/search?q=foo&type=domain");

  const allChip = page.getByRole("link", { name: /^All\b/i });
  await expect(allChip).toBeVisible();
  // The chip's href encodes the no-type URL.
  await expect(allChip).toHaveAttribute("href", /\/search\?q=foo$/);

  await allChip.click();
  await expect(page).toHaveURL(/\/search\?q=foo$/);
});
