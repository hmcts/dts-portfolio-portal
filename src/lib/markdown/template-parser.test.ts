import { describe, expect, it } from "vitest";
import { parseStrictTemplate } from "./template-parser";

describe("parseStrictTemplate", () => {
  describe("domain", () => {
    it("parses About + Strategic direction themes", () => {
      const md = `---
type: domain
name: Common Platform Domain
jurisdiction: crime
---

# About

The unified case-management spine.

# Strategic direction

- Reduce platform sprawl
  We're consolidating shared services.
- Faster sign-in
- Quieter incidents through observability
`;
      const out = parseStrictTemplate(md);
      expect(out.output.kind).toBe("domain");
      if (out.output.kind !== "domain") return;
      expect(out.output.body.about).toContain("unified case-management");
      expect(out.output.body.strategicThemes.length).toBe(3);
      expect(out.output.body.strategicThemes[0]).toEqual({
        title: "Reduce platform sprawl",
        description: "We're consolidating shared services.",
      });
      expect(out.output.body.strategicThemes[1].title).toBe(
        "Faster sign-in",
      );
    });

    it("handles a missing Strategic direction section as empty", () => {
      const md = `---
type: domain
name: Empty Domain
jurisdiction: civil
---

# About

Just an about block.
`;
      const out = parseStrictTemplate(md);
      if (out.output.kind !== "domain") return;
      expect(out.output.body.strategicThemes).toEqual([]);
    });
  });

  describe("team", () => {
    it("parses About + What we operate + How to reach us + Links", () => {
      const md = `---
type: team
name: Hearings Service Team
domain: courtroom-hearings
---

# About

We schedule hearings.

# What we operate

Hearings Management and Listings.

# How to reach us

Email hearings@justice.gov.uk or Slack #hearings.

# Links

- [Confluence](https://confluence.example/hearings)
- [Ardoq](https://ardoq.example/hearings)
`;
      const out = parseStrictTemplate(md);
      if (out.output.kind !== "team") return;
      expect(out.output.body.about).toContain("schedule hearings");
      expect(out.output.body.whatWeOperate).toContain(
        "Hearings Management",
      );
      expect(out.output.body.howToReachUs).toContain("hearings@");
      expect(out.output.body.links).toEqual([
        { label: "Confluence", url: "https://confluence.example/hearings" },
        { label: "Ardoq", url: "https://ardoq.example/hearings" },
      ]);
    });
  });

  describe("product", () => {
    it("parses About + Roadmap NOW/NEXT/LATER + Links", () => {
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
  Sub-700ms p95.

## NEXT

- Passkeys pilot

## LATER

- Event-sourcing re-platform

# Links

- [Confluence](https://confluence.example/cp)
`;
      const out = parseStrictTemplate(md);
      if (out.output.kind !== "product") return;
      expect(out.output.body.roadmap.NOW.map((i) => i.title)).toEqual([
        "Auth flow migration",
        "Sign-in latency reduction",
      ]);
      expect(out.output.body.roadmap.NOW[1].description).toBe(
        "Sub-700ms p95.",
      );
      expect(out.output.body.roadmap.NEXT.map((i) => i.title)).toEqual([
        "Passkeys pilot",
      ]);
      expect(out.output.body.roadmap.LATER.map((i) => i.title)).toEqual([
        "Event-sourcing re-platform",
      ]);
      expect(out.output.body.links).toEqual([
        { label: "Confluence", url: "https://confluence.example/cp" },
      ]);
    });

    it("handles a Roadmap with only some buckets present", () => {
      const md = `---
type: product
name: Sparse Product
domain: common-platform
---

# Roadmap

## NOW

- Just a now item
`;
      const out = parseStrictTemplate(md);
      if (out.output.kind !== "product") return;
      expect(out.output.body.roadmap.NOW.length).toBe(1);
      expect(out.output.body.roadmap.NEXT).toEqual([]);
      expect(out.output.body.roadmap.LATER).toEqual([]);
    });
  });

  describe("jurisdiction", () => {
    it("parses About only", () => {
      const md = `---
type: jurisdiction
name: Crime
---

# About

Crown, Magistrates and Youth courts.
`;
      const out = parseStrictTemplate(md);
      if (out.output.kind !== "jurisdiction") return;
      expect(out.output.about).toContain("Crown");
    });
  });
});
