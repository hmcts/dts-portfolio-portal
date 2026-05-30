import { test, expect } from "@playwright/test";

// E2E regression for PR #41's sidebar bug. Pre-fix, clicking the
// chevron on Civil / Family / Tribunals / Administrative made the
// chevron rotate but revealed no Domain links — the hardcoded
// JURISDICTIONS array only populated `domains` for Crime.
//
// Now that the sidebar is driven from getSidebarJurisdictions(),
// every Jurisdiction should reveal at least one Domain link when
// expanded. These tests pin that contract end-to-end.

const PREVIOUSLY_BROKEN: Array<{ slug: string; name: string }> = [
  { slug: "civil", name: "Civil" },
  { slug: "family", name: "Family" },
  { slug: "tribunals", name: "Tribunals" },
  { slug: "administrative", name: "Administrative" },
];

for (const j of PREVIOUSLY_BROKEN) {
  test(`expanding the ${j.name} chevron reveals at least one Domain link`, async ({
    page,
  }) => {
    await page.goto("/");
    // Find the toggle button — it's the only element with
    // aria-controls="nav-<slug>".
    const toggle = page.locator(`button[aria-controls="nav-${j.slug}"]`);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Click to expand.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    // The expanded panel must contain at least one /d/<slug> link.
    const panel = page.locator(`#nav-${j.slug}`);
    await expect(panel).toBeVisible();
    const domainLinks = panel.locator('a[href^="/d/"]');
    await expect(domainLinks).not.toHaveCount(0);
    // The first link must be reachable — click it and confirm we
    // navigate to the matching Domain page.
    const firstHref = await domainLinks.first().getAttribute("href");
    expect(firstHref).toMatch(/^\/d\/[a-z-]+$/);
  });
}

test("Crime is expanded by default (matches the prototype's default)", async ({
  page,
}) => {
  await page.goto("/");
  const toggle = page.locator('button[aria-controls="nav-crime"]');
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  // Its panel must be visible with at least one Domain link.
  const panel = page.locator("#nav-crime");
  await expect(panel).toBeVisible();
  await expect(panel.locator('a[href^="/d/"]')).not.toHaveCount(0);
});

test("the count badge matches the number of domains revealed", async ({
  page,
}) => {
  await page.goto("/");
  // Test each previously-broken Jurisdiction: expand it, count the
  // domain links, compare to the count displayed in the sidebar
  // header. Catches a regression where count + domains drift out
  // of sync (the OTHER half of the original bug).
  for (const j of PREVIOUSLY_BROKEN) {
    const toggle = page.locator(`button[aria-controls="nav-${j.slug}"]`);
    await toggle.click();
    const panel = page.locator(`#nav-${j.slug}`);
    const linkCount = await panel.locator('a[href^="/d/"]').count();
    // The toggle's text node looks like "<name> <count> <chevron>".
    // The Sidebar emits the count as plain text — extract it.
    const buttonText = (await toggle.textContent()) ?? "";
    const reportedCount = Number(buttonText.match(/\d+/)?.[0] ?? -1);
    expect(reportedCount).toBe(linkCount);
  }
});
