import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { processUpload } from "./pipeline";

// Integration tests for the upload pipeline. End-to-end through:
//   identity parse → AI parse (strict-template fallback in CI; no
//   AOAI configured) → Submission INSERT via the audit-log helper.

const VALID_TEAM_MARKDOWN = `---
type: team
name: Pipeline Test Team
domain: common-platform
---

# About

A team that exists solely to exercise the upload pipeline.

# How to reach us

#pipeline-tests on Slack.

# Links

- [Confluence](https://confluence.example/pipeline-tests)
`;

const VALID_PRODUCT_MARKDOWN = `---
type: product
name: Pipeline Test Product
domain: common-platform
---

# About

A test product.

# Roadmap

## NOW

- Initial setup

## NEXT

- Wider rollout
`;

async function truncate() {
  await db.$executeRawUnsafe('TRUNCATE TABLE "Submission" RESTART IDENTITY');
}

beforeEach(truncate);
afterAll(async () => {
  await truncate();
  await db.$disconnect();
});

describe("processUpload pipeline", () => {
  it("creates a Submission for a valid Team document", async () => {
    const result = await processUpload({
      raw: VALID_TEAM_MARKDOWN,
      submitter: "alice@justice.gov.uk",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.entityKind).toBe("team");
    expect(result.entityName).toBe("Pipeline Test Team");
    expect(result.parseOk).toBe(true);
    // No AOAI in CI — fallback should be the source
    expect(result.parseSource).toBe("strict-template");
    expect(result.sourceMarkdownSha).toMatch(/^[0-9a-f]{64}$/);

    const row = await db.submission.findUnique({
      where: { id: result.submissionId },
    });
    expect(row).not.toBeNull();
    expect(row!.entityKind).toBe("team");
    expect(row!.submitter).toBe("alice@justice.gov.uk");
    expect(row!.approver).toBeNull();
    // Source bytes preserved verbatim
    expect(Buffer.from(row!.sourceMarkdown).toString("utf8")).toBe(
      VALID_TEAM_MARKDOWN,
    );
    expect(row!.aiParsedOutput).not.toBeNull();
  });

  it("creates a Submission for a valid Product document with roadmap chips", async () => {
    const result = await processUpload({
      raw: VALID_PRODUCT_MARKDOWN,
      submitter: "bob@justice.gov.uk",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entityKind).toBe("product");
    expect(result.parseOk).toBe(true);

    const row = await db.submission.findUnique({
      where: { id: result.submissionId },
    });
    expect(row!.entityKind).toBe("product");
    // The parsed output should carry the NOW/NEXT roadmap buckets
    const parsed = row!.aiParsedOutput as { body?: { roadmap?: Record<string, unknown[]> } };
    expect(parsed.body?.roadmap?.NOW).toBeDefined();
    expect(parsed.body?.roadmap?.NEXT).toBeDefined();
  });

  it("rejects empty input without touching the DB", async () => {
    const result = await processUpload({
      raw: "   \n  ",
      submitter: "alice@justice.gov.uk",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/No markdown/i);

    const rows = await db.submission.count();
    expect(rows).toBe(0);
  });

  it("rejects markdown with no front-matter without touching the DB", async () => {
    const result = await processUpload({
      raw: "# Just a body\n\nNo front-matter at all.",
      submitter: "alice@justice.gov.uk",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/front-matter/i);

    const rows = await db.submission.count();
    expect(rows).toBe(0);
  });

  it("rejects malformed front-matter with a useful error", async () => {
    const result = await processUpload({
      raw: `---
type: hamster
name: Squeaks
---

# About

Not a thing.
`,
      submitter: "alice@justice.gov.uk",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.toLowerCase()).toMatch(/type|hamster|shape/i);

    const rows = await db.submission.count();
    expect(rows).toBe(0);
  });

  it("preserves source-markdown bytes exactly for hash idempotency", async () => {
    const first = await processUpload({
      raw: VALID_TEAM_MARKDOWN,
      submitter: "alice@justice.gov.uk",
    });
    const second = await processUpload({
      raw: VALID_TEAM_MARKDOWN,
      submitter: "alice@justice.gov.uk",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    // Same bytes → same SHA — the cache key for §7.5 idempotent reparse
    expect(second.sourceMarkdownSha).toBe(first.sourceMarkdownSha);
  });
});
