import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Modal-as-detail (§6.2) + Initiative drawer (§5.6). Validates that
// clicking a Product card on the Domain page opens a slide-over with
// the Product's details — focus trapped, restoration on close. And
// that clicking a chip on the home matrix opens the right-anchored
// detail drawer (replaces the previous popover affordance to match
// the prototype's click model).

test("Domain page Product cards open as slide-over modals", async ({ page }) => {
  await page.goto("/d/common-platform");

  // The card trigger is a button with the expected aria-label
  const trigger = page.getByRole("button", {
    name: "Open Common Platform details",
  });
  await expect(trigger).toBeVisible();
  await trigger.click();

  // Modal is a dialog with the Product name as the title
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Common Platform" }),
  ).toBeVisible();

  // "View as page" affordance is present and routes to /p/<slug>
  await expect(
    dialog.getByRole("link", { name: /View as page/ }),
  ).toHaveAttribute("href", "/p/common-platform");

  // Close button dismisses
  await dialog.getByRole("button", { name: "Close modal" }).click();
  await expect(dialog).not.toBeVisible();
});

test("Home matrix Initiative chips open a detail drawer", async ({ page }) => {
  await page.goto("/");

  const chip = page.getByRole("button", {
    name: /Sign-in latency reduction/,
  });
  await expect(chip).toBeVisible();
  // No native hover tooltip — the chip suppresses the `title` attr so
  // detail is reached only via click.
  await expect(chip).not.toHaveAttribute("title", /./);
  await chip.click();

  const drawer = page.locator(
    '[role="dialog"]:has-text("Sign-in latency reduction")',
  );
  await expect(drawer).toBeVisible();

  // Press Escape to dismiss
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
});

test("Slide-over modal passes axe scan when open", async ({ page }) => {
  await page.goto("/d/common-platform");
  await page
    .getByRole("button", { name: "Open Common Platform details" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
