import { describe, expect, it } from "vitest";
import { TemplateFallbackParser } from "./template-fallback";

describe("TemplateFallbackParser", () => {
  const parser = new TemplateFallbackParser();

  it("parses a canonical Team document and flags every field as high confidence", async () => {
    const md = `---
type: team
name: Hearings Service Team
domain: courtroom-hearings
---

# About

We schedule hearings.

# How to reach us

#crime-hearings on Slack.

# Links

- [Confluence](https://confluence.example/hearings)
`;
    const result = await parser.parse(md);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("strict-template");
    expect(result.output.kind).toBe("team");
    if (result.output.kind !== "team") return;
    expect(result.output.body.about).toContain("schedule hearings");
    expect(result.output.body.howToReachUs).toContain("Slack");
    expect(result.output.body.links).toHaveLength(1);

    // Every field surfaced by the strict parser is marked "high"
    expect(result.confidence["about"]).toBe("high");
    expect(result.confidence["howToReachUs"]).toBe("high");
    expect(result.confidence["links[0].label"]).toBe("high");
    // Fields not present in the source are not flagged
    expect(result.confidence["whatWeOperate"]).toBeUndefined();

    // Strict parser doesn't carry a notion of unrecognised sections
    expect(result.unrecognised).toEqual([]);
  });

  it("parses a Product document with NOW/NEXT/LATER and flags each chip", async () => {
    const md = `---
type: product
name: Common Platform
domain: common-platform
---

# About

The platform.

# Roadmap

## NOW

- Auth flow migration
- Sign-in latency reduction

## NEXT

- Passkeys pilot

## LATER

- Event-sourcing re-platform
`;
    const result = await parser.parse(md);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.output.kind !== "product") return;
    expect(result.output.body.roadmap.NOW).toHaveLength(2);
    expect(result.confidence["roadmap.NOW[0].title"]).toBe("high");
    expect(result.confidence["roadmap.NOW[1].title"]).toBe("high");
    expect(result.confidence["roadmap.NEXT[0].title"]).toBe("high");
    expect(result.confidence["roadmap.LATER[0].title"]).toBe("high");
  });

  it("parses a Domain document with Strategic direction themes", async () => {
    const md = `---
type: domain
name: Common Platform Domain
jurisdiction: crime
---

# About

The unified spine.

# Strategic direction

- Reduce platform sprawl
- Faster sign-in
`;
    const result = await parser.parse(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.output.kind !== "domain") return;
    expect(result.output.body.strategicThemes).toHaveLength(2);
    expect(result.confidence["strategicThemes[0].title"]).toBe("high");
    expect(result.confidence["strategicThemes[1].title"]).toBe("high");
  });

  it("fails safely on malformed front-matter", async () => {
    const md = `---
type: hamster
name: Squeaks
---

# About

A small mammal.
`;
    const result = await parser.parse(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.source).toBe("strict-template");
    expect(result.reason).toMatch(/Front-matter/i);
  });

  it("fails safely on missing front-matter entirely", async () => {
    const md = `# Just a body

No metadata. The parser should refuse.
`;
    const result = await parser.parse(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/front-matter/i);
  });
});
