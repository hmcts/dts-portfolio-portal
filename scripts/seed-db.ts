#!/usr/bin/env tsx
//
// scripts/seed-db.ts — wraps loadSeedIntoDb() in a CLI entry point.
// Wired in package.json as `pnpm db:seed` and called by
// scripts/demo.sh after migrations apply.
//
// Idempotent: every entity is upserted by its natural slug; child
// collections (themes, outbound links, initiatives) are replaced
// per-parent. Running it twice converges on the same DB state.

import { db } from "@/lib/db";
import { loadSeedIntoDb } from "@/lib/seed-loader";

async function main() {
  const started = Date.now();
  const result = await loadSeedIntoDb();
  const ms = Date.now() - started;

  console.log(
    [
      "Seed loaded:",
      `  Jurisdictions:    ${result.jurisdictions}`,
      `  ProductDomains:   ${result.domains}`,
      `  Themes:           ${result.themes}`,
      `  Teams:            ${result.teams}`,
      `  Products:         ${result.products}`,
      `  Initiatives:      ${result.initiatives}`,
      `  OutboundLinks:    ${result.outboundLinks}`,
      `  Total time:       ${ms}ms`,
    ].join("\n"),
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
