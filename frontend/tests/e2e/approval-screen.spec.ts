import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// E2E for the approval screen — uploads a markdown via the form,
// then navigates to the approval detail page and walks through the
// content. Doesn't actually approve (would require sub-second
// reliability against the redirect); the integration tests cover
// the approve mutation directly.

test("Approvals list renders the seeded queue and detail page", async ({
  page,
}) => {
  // Unique team name per run so multiple runs against the same DB
  // don't ambiguate the .first() locator below.
  const uniqueSuffix = Date.now().toString(36);
  const teamName = `E2E Approval Team ${uniqueSuffix}`;
  const fixtureMarker = `End-to-end test fixture ${uniqueSuffix}`;

  await page.goto("/upload");
  const md = `---
type: team
name: ${teamName}
domain: common-platform
---

# About

${fixtureMarker}.

# How to reach us

#e2e on Slack.
`;
  await page.getByLabel("Markdown content").fill(md);
  await page.getByRole("button", { name: /Upload and parse/ }).click();
  await expect(
    page.getByText(/Submission queued/),
  ).toBeVisible({ timeout: 10_000 });

  // List view
  await page.goto("/approvals");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Pending submissions",
  );

  // Click into the detail — getByRole picks the link wrapping the
  // list item, so we land on /approvals/[id] cleanly.
  await page.getByRole("link", { name: new RegExp(teamName) }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(teamName);

  // The fixture marker appears in both the source pane (raw markdown)
  // and the parsed pane (JSON output). Either being visible is enough
  // — both indicates the detail page rendered.
  await expect(page.getByText(fixtureMarker).first()).toBeVisible();

  // Approve action is present and enabled
  await expect(
    page.getByRole("button", { name: /Approve and publish/ }),
  ).toBeEnabled();
});

test("Approvals list page passes axe", async ({ page }) => {
  await page.goto("/approvals");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
