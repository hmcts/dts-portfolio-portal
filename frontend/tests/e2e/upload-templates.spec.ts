import { test, expect } from "@playwright/test";

// E2E for the new template-downloads section on the /upload page.
// First-time contributors land here, so the templates need to be
// the first thing they see — not buried on /help. These tests pin
// that contract: each of the three templates has a download link
// pointing at a real public/ file.

// Write-path port (I.8): the /upload page is temporarily replaced with
// a "coming back online" notice while the write-path is re-platformed
// onto the Python backend. The template download section is absent from
// the interim page. Skip all tests in this file until the write-path
// port lands and restores the upload page with its template section.

const TEMPLATES = [
  { slug: "new-domain", title: "new-domain.md" },
  { slug: "new-team", title: "new-team.md" },
  { slug: "new-product", title: "new-product.md" },
];

test.skip(
  "/upload renders the 'Download a starter template' section",
  async ({ page }) => {
    await page.goto("/upload");
    await expect(
      page.getByRole("heading", { level: 2, name: /Download a starter template/ }),
    ).toBeVisible();
  },
);

test.skip(
  "the page has three Download template links, one per template, with the right hrefs",
  async ({ page }) => {
    await page.goto("/upload");
    const links = page.getByRole("link", { name: /Download template/ });
    await expect(links).toHaveCount(3);
    const hrefs = await links.evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(hrefs.sort()).toEqual([
      "/templates/new-domain.md",
      "/templates/new-product.md",
      "/templates/new-team.md",
    ]);
    // Every link must carry the `download` attribute so browsers
    // save rather than navigate.
    const downloadAttrs = await links.evaluateAll((els) =>
      els.map((el) => el.getAttribute("download")),
    );
    expect(downloadAttrs).toEqual(["", "", ""]);
  },
);

test.skip(
  "the template files are actually served from /templates/",
  async ({ request }) => {
    // Pin the contract that the public/ files are reachable. Without
    // this, the page would offer downloads that 404.
    for (const t of TEMPLATES) {
      const res = await request.get(`/templates/${t.slug}.md`);
      expect(
        res.ok(),
        `/templates/${t.slug}.md should be served from public/`,
      ).toBe(true);
      const body = await res.text();
      // Templates include YAML front-matter — sanity-check the file
      // isn't empty or a default 404 page.
      expect(body.length).toBeGreaterThan(50);
      expect(body).toMatch(/^---/);
    }
  },
);
