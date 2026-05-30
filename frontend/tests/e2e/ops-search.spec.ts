import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Client } from "pg";

// E2E for the search relevance dashboard at /ops/search (Phase 3
// task 3.7). The seeded case at the bottom opens a pg connection
// directly, inserts known SearchEvent rows, asserts the dashboard
// renders the right CTR + zero-result table + unclicked table, then
// cleans up. The 5-minute click-correlation window means the seed
// must include matching `createdAt` timestamps for the click join
// to fire (or NOT fire) as intended.

test("/ops/search renders the dashboard", async ({ page }) => {
  await page.goto("/ops/search");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Search relevance",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: /Activity/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: /Zero-result queries/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: /Queries with answers but zero clicks/,
    }),
  ).toBeVisible();
});

test("/ops/search passes axe with no WCAG 2.2 AA violations", async ({
  page,
}) => {
  await page.goto("/ops/search");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("/api/search-events accepts a well-formed click event", async ({
  request,
}) => {
  const res = await request.post("/api/search-events", {
    data: {
      kind: "click",
      query: "common platform",
      clickedEntityType: "product",
      clickedEntityId: "test-id",
      clickedPosition: 0,
    },
  });
  expect(res.status()).toBe(204);
});

test("/api/search-events rejects an invalid event shape", async ({
  request,
}) => {
  const res = await request.post("/api/search-events", {
    data: { kind: "click" }, // missing required fields
  });
  expect(res.status()).toBe(400);
});

test("/api/search-events rejects a non-JSON body", async ({ request }) => {
  const res = await request.post("/api/search-events", {
    data: "not json at all" as unknown as object,
    headers: { "content-type": "text/plain" },
  });
  expect(res.status()).toBe(400);
});

// Helper — scope a pg connection to a single block. Mirrors the
// helper used by tests/e2e/ops-ai-cost.spec.ts; if a third file
// arrives, lift this into tests/helpers/.
async function withPg<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set to seed /ops/search data — see playwright.config.ts",
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

// The next two tests both manipulate the SearchEvent table. Run
// them serially so they can't race under `fullyParallel: true`
// (Playwright's local default uses multiple workers per file).
test.describe.serial("ops-search dashboard with DB state", () => {

test("/ops/search renders seeded data — CTR, zero-result table, unclicked table", async ({
  page,
}) => {
  // Seed shape:
  //   - 4 query events, 1 click event
  //   - "alpha" gets 3 results AND a click within 5 min → counts in
  //     totals; does NOT appear in unclicked
  //   - "beta" gets 2 results and no click → appears in unclicked
  //   - "no matches" gets 0 results twice → appears in zero-result
  //     with occurrences=2
  //
  //   Expected totals: queries=4 (alpha + beta + 2×no matches),
  //   clicks=1, CTR = 25.0%
  const now = new Date();
  const nowIso = now.toISOString();
  await withPg(async (client) => {
    await client.query('TRUNCATE TABLE "SearchEvent" RESTART IDENTITY');
    await client.query(
      `INSERT INTO "SearchEvent"
         (id, "createdAt", kind, query, "resultCount", "clickedEntityType", "clickedEntityId", "clickedPosition")
       VALUES
         ('e-q-alpha',     $1::timestamp,                       'query', 'alpha',       3,    NULL,      NULL,    NULL),
         ('e-c-alpha',     $1::timestamp + INTERVAL '30 seconds','click', 'alpha',       NULL, 'product', 'a1',    0),
         ('e-q-beta',      $1::timestamp,                       'query', 'beta',        2,    NULL,      NULL,    NULL),
         ('e-q-nomatch-1', $1::timestamp,                       'query', 'no matches',  0,    NULL,      NULL,    NULL),
         ('e-q-nomatch-2', $1::timestamp,                       'query', 'no matches',  0,    NULL,      NULL,    NULL)`,
      [nowIso],
    );
  });

  try {
    await page.goto("/ops/search");

    // Activity tiles: 4 queries, 1 click, CTR 25.0%.
    await expect(
      page.getByText("Total queries").locator(".."),
    ).toContainText("4");
    await expect(
      page.getByText("Result clicks").locator(".."),
    ).toContainText("1");
    await expect(
      page.getByText("Click-through rate").locator(".."),
    ).toContainText("25.0%");

    // Zero-result section: heading shows count, table contains the
    // "no matches" row with occurrences=2.
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /Zero-result queries \(1\)/,
      }),
    ).toBeVisible();
    const zeroRow = page.getByRole("row").filter({ hasText: "no matches" });
    await expect(zeroRow.first()).toBeVisible();
    await expect(zeroRow.first()).toContainText("2"); // occurrences

    // Unclicked section: heading shows count, "beta" appears,
    // "alpha" does NOT (it had a click).
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /Queries with answers but zero clicks \(1\)/,
      }),
    ).toBeVisible();
    const unclickedRow = page.getByRole("row").filter({ hasText: "beta" });
    await expect(unclickedRow.first()).toBeVisible();
    // "alpha" had a click — it must not show up in either data
    // table (zero-result or unclicked). It only contributes to the
    // activity tile totals at the top of the page.
    await expect(
      page.getByRole("row").filter({ hasText: "alpha" }),
    ).toHaveCount(0);
  } finally {
    await withPg(async (client) => {
      await client.query('TRUNCATE TABLE "SearchEvent" RESTART IDENTITY');
    });
  }
});

test("/ops/search shows the empty-state copy when there are no events", async ({
  page,
}) => {
  // Pin the empty-state strings the dashboard renders when both
  // arrays are empty. The dashboard heading test only asserts that
  // the section headings are present — this confirms the *body* of
  // each section makes sense before any data is collected.
  await withPg(async (client) => {
    await client.query('TRUNCATE TABLE "SearchEvent" RESTART IDENTITY');
  });

  await page.goto("/ops/search");
  await expect(
    page.getByText(/No zero-result queries in the last \d+ days/),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Every answered query in the last \d+ days got at least one click/,
    ),
  ).toBeVisible();
});

}); // end describe.serial
