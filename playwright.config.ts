import { defineConfig, devices } from "@playwright/test";

// Playwright config for end-to-end + a11y tests. Booting the dev server
// is handled by `webServer` below — Playwright waits for the URL to
// respond before any tests run.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
    // Force the strict-template fallback parser even if a developer
    // has AOAI vars in their .env.local. The e2e suite relies on
    // deterministic parser output; the AI-down fallback spec is the
    // dedicated test in ai-down-fallback.spec.ts. See ADR-003 / spec
    // §7.5 and Phase 2 task 2.14.
    env: {
      AI_PARSER_FORCE_FALLBACK: "true",
      // Low daily-token budget so the /ops/ai-cost dashboard can be
      // tested against the "exceeded" tone. The seed used by
      // tests/e2e/ops-ai-cost.spec.ts inserts totals over this
      // threshold. Production sets a realistic value via Key Vault.
      AI_PARSE_BUDGET_TOKENS_PER_DAY: "100",
    },
  },
});
