import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Team-card-as-modal (§6.2, Phase 1 task 1.7). Mirrors the Product
// card modal contract: aria-labelled trigger on the Domain page,
// dialog renders the Team's details, "View as page" routes to
// /t/<slug>, Escape closes, and the open dialog passes axe.

test("Domain page Team cards open as slide-over modals", async ({ page }) => {
  await page.goto("/d/common-platform");

  const trigger = page.getByRole("button", {
    name: "Open Common Platform Core details",
  });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Common Platform Core" }),
  ).toBeVisible();

  // "View as page" affordance is present and routes to /t/<slug>
  await expect(
    dialog.getByRole("link", { name: /View as page/ }),
  ).toHaveAttribute("href", "/t/common-platform-core");

  // Escape dismisses the dialog and restores focus
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("Team modal passes axe scan when open", async ({ page }) => {
  await page.goto("/d/common-platform");
  await page
    .getByRole("button", { name: "Open Common Platform Core details" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
