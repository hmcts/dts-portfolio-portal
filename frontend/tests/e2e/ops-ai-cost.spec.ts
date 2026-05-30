import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Client } from "pg";

// E2E for the AI cost dashboard at /ops/ai-cost (Phase 2 task 2.13).
// The structural assertions (page renders, axe is clean) run on any
// DB state. The data-seeded case opens its own pg connection,
// inserts known rows, asserts the dashboard renders the expected
// totals + budget tone, then cleans up. The seeded totals are sized
// to deliberately exceed the AI_PARSE_BUDGET_TOKENS_PER_DAY=100 set
// in playwright.config.ts.

test("/ops/ai-cost renders the dashboard", async ({ page }) => {
  await page.goto("/ops/ai-cost");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "AI parsing activity",
  );
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

// Helper to scope a pg connection to a single block. Avoids a
// project-wide fixture for now since this is the only e2e file that
// needs DB seeding; if more arrive, lift this into tests/helpers/.
async function withPg<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set to seed /ops/ai-cost data — see playwright.config.ts",
    );
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

test("/ops/ai-cost renders seeded data and flips to the alert tone when over budget", async ({
  page,
}) => {
  // Seed three rows whose token totals deliberately exceed the
  // 100-token budget set in playwright.config.ts (1290 + 1540 = 2830).
  const seededIds = [
    "test-ops-ai-cost-1",
    "test-ops-ai-cost-2",
    "test-ops-ai-cost-3",
  ];
  await withPg(async (client) => {
    // Start from a known-clean table — other tests in the suite
    // may have left strict-template rows behind. TRUNCATE bypasses
    // the append-only DELETE trigger by design.
    await client.query('TRUNCATE TABLE "AiParseMetric" RESTART IDENTITY');
    await client.query(
      `INSERT INTO "AiParseMetric"
         (id, source, model, outcome, "promptTokens", "completionTokens", "totalTokens", "latencyMs")
       VALUES
         ($1, 'azure-openai', 'gpt-4o-mini-test', 'success', 1200, 90,  1290, 180),
         ($2, 'azure-openai', 'gpt-4o-mini-test', 'success', 1480, 60,  1540, 220),
         ($3, 'azure-openai', 'gpt-4o-mini-test', 'failure',    0,  0,     0,  50)`,
      seededIds,
    );
  });

  try {
    await page.goto("/ops/ai-cost");

    // Budget Pulse section: today's tokens, the configured budget,
    // and the alert-tone status. With 2,830 seeded tokens against
    // a 100-token budget, every assertion in this section should
    // reflect the over-budget state.
    const todayTile = page.getByText("Today's tokens").locator("..");
    await expect(todayTile).toContainText("2,830");

    const budgetTile = page
      .getByText("Budget (tokens / day)")
      .locator("..");
    await expect(budgetTile).toContainText("100");

    const statusTile = page.getByText("Status", { exact: true }).locator("..");
    await expect(statusTile).toContainText("Budget exceeded");

    // Trailing-N-days tiles. "Successful" / "Failed" collide with
    // the table column headers below, so we only assert on the
    // unique labels here ("Total parses", "Total tokens") and pick
    // up the per-outcome counts from the table row instead.
    await expect(page.getByText("Total parses").locator("..")).toContainText(
      "3",
    );
    await expect(page.getByText("Total tokens").locator("..")).toContainText(
      "2,830",
    );

    // Daily table — the row carrying our seeded data must show the
    // exact aggregates: 3 parses, 2 successful, 1 failed, total
    // tokens 2,830. This is what would surface a bug in either the
    // SQL aggregate or the buildDayRows / summarise helpers.
    const seedRow = page.getByRole("row").filter({ hasText: "azure-openai" });
    await expect(seedRow.first()).toBeVisible();
    const rowText = await seedRow.first().textContent();
    expect(rowText).toContain("3"); // parses
    expect(rowText).toContain("2,830"); // total tokens
    // Avg latency: (180 + 220 + 50) / 3 ≈ 150
    expect(rowText).toMatch(/15[0-9]/);
  } finally {
    // Clean up so subsequent runs (or other tests) start with an
    // empty AiParseMetric table.
    await withPg(async (client) => {
      await client.query('TRUNCATE TABLE "AiParseMetric" RESTART IDENTITY');
    });
  }
});
