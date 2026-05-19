import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Smoke + a11y for the four entity pages. Slugs are taken from the
// Phase 1 seed (src/lib/seed.ts) and cover one of each entity type
// plus a cross-jurisdiction product (Correspondence Service is
// consumed by every other jurisdiction).

const PAGES = [
  { name: "Jurisdiction · Crime", url: "/j/crime", h1: "Crime" },
  {
    name: "Domain · Common Platform",
    url: "/d/common-platform",
    h1: "Common Platform Domain",
  },
  { name: "Team · Hearings", url: "/t/hearings", h1: "Hearings Service Team" },
  {
    name: "Product · Common Platform",
    url: "/p/common-platform",
    h1: "Common Platform",
  },
];

for (const page of PAGES) {
  test(`${page.name} renders + passes axe`, async ({ page: pw }) => {
    await pw.goto(page.url);
    await expect(pw.getByRole("heading", { level: 1 })).toHaveText(page.h1);
    const results = await new AxeBuilder({ page: pw })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test("Unknown slug returns 404 on Product route", async ({ page }) => {
  const response = await page.goto("/p/no-such-product");
  expect(response?.status()).toBe(404);
});
