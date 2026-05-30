import { test, expect } from "@playwright/test";

// AI-down fallback drill per spec §7.5 / Phase 2 task 2.14.
//
// The portal must stay operable when Azure OpenAI is offline. The
// kill-switch `AI_PARSER_FORCE_FALLBACK=true` (set on the playwright
// webServer in playwright.config.ts) makes the parser factory return
// the strict-template fallback regardless of AOAI configuration —
// exactly the behaviour ops needs during a "AI is down" drill.
//
// What this test exercises end-to-end:
//   1. Paste canonically-shaped markdown into /upload
//   2. The upload succeeds without AOAI ever being called
//   3. The success panel announces the parse source as
//      "strict-template" (so the submitter knows AI was unavailable)
//   4. The /approvals list shows the queued submission
//   5. The approval detail page surfaces a "Strict template fallback"
//      pill so the reviewer can tell at a glance which parser ran

// Write-path port (I.8): the upload form is temporarily disabled while
// the write-path is re-platformed onto the Python backend. This test
// depends on the upload form. Re-enable when the write-path port
// restores the upload + approvals workflow.
test.skip(
  "upload → approval flow runs end-to-end via the strict-template fallback",
  async ({ page }) => {
    // Unique product name per run so reruns against a persistent DB
    // don't ambiguate the locators below.
    const uniqueSuffix = Date.now().toString(36);
    const productName = `AI-Down Fallback Product ${uniqueSuffix}`;
    const fixtureMarker = `Fallback drill fixture ${uniqueSuffix}`;

    // 1. Paste a Product-shaped markdown that the strict-template parser
    // can handle deterministically. Identity-parser only requires
    // `type`, `name`, and `domain` for a product; slugs are validated
    // at approve time, not at upload time.
    await page.goto("/upload");
    const md = `---
type: product
name: ${productName}
domain: common-platform
---

# About

${fixtureMarker}.

# Roadmap

## NOW

- Wire the ops kill-switch

## NEXT

- Run the AOAI-down game day
`;
    await page.getByLabel("Markdown content").fill(md);
    await page.getByRole("button", { name: /Upload and parse/ }).click();

    // 2 + 3. Success panel announces the parse source. The form renders
    // "Parse source: strict-template" verbatim — that string is the
    // reviewer's first signal that AI was bypassed.
    await expect(
      page.getByText(/Submission queued/),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/parse source:\s*strict-template/i),
    ).toBeVisible();

    // 4. The approvals list carries the row.
    await page.goto("/approvals");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Pending submissions",
    );
    await page.getByRole("link", { name: new RegExp(productName) }).click();

    // 5. Detail page surfaces the parse-source pill. The label is
    // "Strict template fallback" — see parseSourcePill() in
    // src/app/approvals/[submissionId]/page.tsx. The pill text is
    // exact-match because the StatusPill renders the label verbatim.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(productName);
    await expect(page.getByText("Strict template fallback")).toBeVisible();

    // The accompanying explanatory text only renders for the fallback
    // case — verifies the conditional branch in the approval page.
    await expect(
      page.getByText(/strict-template fallback\. Non-canonical sections are lost/i),
    ).toBeVisible();
  },
);
