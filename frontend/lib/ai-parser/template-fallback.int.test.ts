import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TemplateFallbackParser } from "./template-fallback";

// Integration tests for TemplateFallbackParser's metric-recording
// branches (Phase 2 task 2.13). Mirrors azure-openai.int.test.ts —
// every parse() exit point must write exactly one AiParseMetric row
// with the right outcome + reason. Token counts stay null because
// the strict-template path doesn't call a model.
//
// No stub needed for the parser itself — it's a deterministic local
// parser, not an external client. The DB writes are fully real
// against the docker-compose Postgres.

async function truncate() {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "AiParseMetric" RESTART IDENTITY',
  );
}

beforeEach(truncate);
afterAll(async () => {
  await truncate();
  await db.$disconnect();
});

// A markdown document the strict-template parser accepts end-to-end.
// Sections are the canonical Team headers per spec §7.2.
const VALID_TEAM_MD = `---
type: team
name: Template Fallback Test Team
domain: common-platform
---

# About

We exist to exercise the strict-template fallback parser.

# What we operate

* Common Platform UI

# Latest activity

* Tested the parser today.

# How to reach us

Slack: #template-fallback
`;

describe("TemplateFallbackParser metric recording", () => {
  it("records a success row on a happy parse, with no token counts and no failure reason", async () => {
    const parser = new TemplateFallbackParser();
    const result = await parser.parse(VALID_TEAM_MD);
    await parser.flushMetricsForTests();

    expect(result.ok).toBe(true);

    const rows = await db.aiParseMetric.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "strict-template",
      outcome: "success",
      model: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      failureReason: null,
    });
    expect(rows[0]!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("records a failure row when the front-matter is missing", async () => {
    const parser = new TemplateFallbackParser();
    const result = await parser.parse("No front-matter, just a body.\n");
    await parser.flushMetricsForTests();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Front-matter invalid/);
    }

    const row = (await db.aiParseMetric.findMany())[0]!;
    expect(row.outcome).toBe("failure");
    expect(row.failureReason).toMatch(/Front-matter invalid/);
    expect(row.promptTokens).toBeNull();
  });

  it("records a failure row when the front-matter is malformed YAML", async () => {
    const parser = new TemplateFallbackParser();
    const result = await parser.parse(`---
type: team
name: "unbalanced
---

Body.
`);
    await parser.flushMetricsForTests();

    expect(result.ok).toBe(false);

    const row = (await db.aiParseMetric.findMany())[0]!;
    expect(row.outcome).toBe("failure");
    expect(row.failureReason).not.toBeNull();
    // The exact YAML-parser message varies by version; just assert
    // we recorded SOMETHING explaining the failure.
    expect(row.failureReason!.length).toBeGreaterThan(0);
  });

  it("tolerates a body with no canonical headers — strict-template is intentionally lenient", async () => {
    // Front-matter passes; body lacks canonical Team sections.
    // Per parseTeam() in template-parser.ts, missing sections become
    // undefined fields — they are NOT a parse failure. The metric
    // row should reflect success, with no token counts.
    //
    // This is the deliberate behaviour: the strict-template path is
    // the AI-down fallback and must accept anything the identity
    // parser approved (otherwise legitimate uploads stall during an
    // AOAI outage). Confidence flags are how the approval screen
    // surfaces "we couldn't find a section here", not a parse error.
    const parser = new TemplateFallbackParser();
    const result = await parser.parse(`---
type: team
name: Lenient Body Team
domain: common-platform
---

This body has no canonical headers at all, just prose.
`);
    await parser.flushMetricsForTests();

    expect(result.ok).toBe(true);

    const row = (await db.aiParseMetric.findMany())[0]!;
    expect(row.outcome).toBe("success");
    expect(row.source).toBe("strict-template");
  });

  it("writes exactly one row per parse() call", async () => {
    const parser = new TemplateFallbackParser();
    await parser.parse(VALID_TEAM_MD);
    await parser.parse(VALID_TEAM_MD);
    await parser.parse("no front-matter");
    await parser.flushMetricsForTests();

    expect(await db.aiParseMetric.count()).toBe(3);
  });
});
