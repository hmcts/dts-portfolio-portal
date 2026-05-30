import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  { name: "Help", url: "/help", h1: "Templates for adding content" },
  // Write-path port (I.8): /upload is temporarily unavailable; h1 changed.
  // Re-enable and update h1 when the write-path port lands.
  // { name: "Upload", url: "/upload", h1: "Upload a markdown file" },
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

test("Custom 404 page renders + passes axe", async ({ page }) => {
  await page.goto("/this-path-does-not-exist");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "We couldn't find that page.",
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
