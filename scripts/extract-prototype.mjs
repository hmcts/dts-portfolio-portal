// Local-only utility: renders the standalone prototype HTML in a
// headless browser, waits for its bundler to unpack, then dumps the
// resulting DOM + computed styles + a screenshot so we have a real
// visual reference for the Phase 1 implementation.
//
// Run: node scripts/extract-prototype.mjs
//
// Output:
//   docs/prototype/rendered.html        — flattened DOM after bundler unpacks
//   docs/prototype/rendered.png         — full-page screenshot
//   docs/prototype/computed-tokens.json — computed CSS values on key landmarks
//
// Output is gitignored; only the source standalone HTML is committed.

import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const protoHtml = resolve(
  repoRoot,
  "docs/prototype/DTS Portfolio Portal - standalone.html",
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`file://${protoHtml}`);
await page.waitForFunction(
  () => !document.getElementById("__bundler_thumbnail"),
  { timeout: 30_000 },
);
await page.waitForTimeout(1500); // let any async post-unpack work settle

const html = await page.content();
await writeFile(resolve(repoRoot, "docs/prototype/rendered.html"), html);

await page.screenshot({
  path: resolve(repoRoot, "docs/prototype/rendered.png"),
  fullPage: true,
});

const tokens = await page.evaluate(() => {
  const body = document.body;
  const html = document.documentElement;
  const getStyles = (el) => {
    const s = getComputedStyle(el);
    return {
      tag: el.tagName?.toLowerCase(),
      backgroundColor: s.backgroundColor,
      color: s.color,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      borderRadius: s.borderRadius,
      borderColor: s.borderColor,
    };
  };
  const landmarks = {
    html: getStyles(html),
    body: getStyles(body),
    h1: getStyles(document.querySelector("h1") ?? body),
    nav: getStyles(document.querySelector("nav") ?? body),
    button: getStyles(document.querySelector("button") ?? body),
    card: getStyles(
      document.querySelector('[class*="card"]') ??
        document.querySelector("article") ??
        body,
    ),
  };
  return landmarks;
});

await writeFile(
  resolve(repoRoot, "docs/prototype/computed-tokens.json"),
  JSON.stringify(tokens, null, 2),
);

await browser.close();
console.log("Prototype extracted to docs/prototype/rendered.{html,png} + computed-tokens.json");
