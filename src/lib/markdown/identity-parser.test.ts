import { describe, expect, it } from "vitest";
import {
  IdentityParseError,
  parseIdentity,
} from "./identity-parser";

describe("parseIdentity", () => {
  describe("happy paths", () => {
    it("parses a well-formed team document", () => {
      const md = `---
type: team
name: Hearings Service Team
domain: courtroom-hearings
---

# About

We run hearings.
`;
      const out = parseIdentity(md);
      expect(out.frontMatter.type).toBe("team");
      expect(out.frontMatter.name).toBe("Hearings Service Team");
      if (out.frontMatter.type === "team") {
        expect(out.frontMatter.domain).toBe("courtroom-hearings");
      }
      expect(out.body).toContain("# About");
    });

    it("parses a well-formed product document", () => {
      const md = `---
type: product
name: Common Platform
domain: common-platform
---

# About

The unified case-management platform.
`;
      const out = parseIdentity(md);
      expect(out.frontMatter.type).toBe("product");
      expect(out.frontMatter.name).toBe("Common Platform");
    });

    it("parses a well-formed domain document", () => {
      const md = `---
type: domain
name: Common Platform Domain
jurisdiction: crime
---

# About

Spine of Crime case management.
`;
      const out = parseIdentity(md);
      expect(out.frontMatter.type).toBe("domain");
      if (out.frontMatter.type === "domain") {
        expect(out.frontMatter.jurisdiction).toBe("crime");
      }
    });

    it("parses a well-formed jurisdiction document", () => {
      const md = `---
type: jurisdiction
name: Crime
---

# About

Crown, Magistrates and Youth courts.
`;
      const out = parseIdentity(md);
      expect(out.frontMatter.type).toBe("jurisdiction");
      expect(out.frontMatter.name).toBe("Crime");
    });

    it("preserves the body unchanged below the front-matter", () => {
      const md = `---
type: team
name: Identity Team
domain: common-platform
---

Some body content
with multiple lines.
`;
      const out = parseIdentity(md);
      expect(out.body.trim()).toBe(
        "Some body content\nwith multiple lines.",
      );
    });
  });

  describe("rejections", () => {
    it("rejects an empty document", () => {
      expect(() => parseIdentity("")).toThrow(IdentityParseError);
      expect(() => parseIdentity("   ")).toThrow(IdentityParseError);
    });

    it("rejects a document with no front-matter at all", () => {
      const md = "# Just a body, no metadata\n\nNothing to identify this.";
      expect(() => parseIdentity(md)).toThrow(/No YAML front-matter/);
    });

    it("rejects malformed YAML", () => {
      const md = `---
type: team
name: "unbalanced
---

Body.
`;
      expect(() => parseIdentity(md)).toThrow(IdentityParseError);
    });

    it("rejects a missing type field", () => {
      const md = `---
name: A Team
domain: common-platform
---

Body.
`;
      expect(() => parseIdentity(md)).toThrow(/missing the required `type`/);
    });

    it("rejects an unknown type", () => {
      const md = `---
type: hamster
name: Squeaks
---

Body.
`;
      expect(() => parseIdentity(md)).toThrow(IdentityParseError);
    });

    it("rejects a team without a parent domain reference", () => {
      const md = `---
type: team
name: Orphan Team
---

Body.
`;
      try {
        parseIdentity(md);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(IdentityParseError);
        const issues = (err as IdentityParseError).issues;
        expect(issues?.some((i) => i.path.includes("domain"))).toBe(true);
      }
    });

    it("rejects a domain without a parent jurisdiction reference", () => {
      const md = `---
type: domain
name: Orphan Domain
---

Body.
`;
      expect(() => parseIdentity(md)).toThrow(IdentityParseError);
    });

    it("rejects a domain pointing at an unknown jurisdiction", () => {
      const md = `---
type: domain
name: Aliens
jurisdiction: outer-space
---

Body.
`;
      expect(() => parseIdentity(md)).toThrow(IdentityParseError);
    });

    it("rejects an empty name", () => {
      const md = `---
type: team
name: ""
domain: common-platform
---

Body.
`;
      expect(() => parseIdentity(md)).toThrow(IdentityParseError);
    });
  });

  // Product `team` + `stage` were added as a Phase 2 simplification
  // (see the comment at the field definition). The fields are optional
  // but, when present, must round-trip and be schema-validated.
  describe("product team + stage fields", () => {
    function productMd(extra: string): string {
      return `---
type: product
name: Common Platform
domain: common-platform
${extra}---

# About

Body.
`;
    }

    it("parses a product with only `team` set", () => {
      const out = parseIdentity(productMd("team: hearings-team\n"));
      expect(out.frontMatter.type).toBe("product");
      if (out.frontMatter.type === "product") {
        expect(out.frontMatter.team).toBe("hearings-team");
        expect(out.frontMatter.stage).toBeUndefined();
      }
    });

    it("parses a product with only `stage` set", () => {
      const out = parseIdentity(productMd("stage: beta\n"));
      if (out.frontMatter.type === "product") {
        expect(out.frontMatter.stage).toBe("beta");
        expect(out.frontMatter.team).toBeUndefined();
      }
    });

    it("parses a product with both `team` and `stage`", () => {
      const out = parseIdentity(
        productMd("team: Hearings Team\nstage: live\n"),
      );
      if (out.frontMatter.type === "product") {
        // `team` is intentionally tolerant — name or slug accepted;
        // normalisation happens at approve time, not here.
        expect(out.frontMatter.team).toBe("Hearings Team");
        expect(out.frontMatter.stage).toBe("live");
      }
    });

    it("parses a product with neither field — both stay undefined", () => {
      const out = parseIdentity(productMd(""));
      if (out.frontMatter.type === "product") {
        expect(out.frontMatter.team).toBeUndefined();
        expect(out.frontMatter.stage).toBeUndefined();
      }
    });

    it.each(["discovery", "alpha", "beta", "live", "retiring", "retired"])(
      "accepts `stage: %s` (the full ProductStage enum)",
      (stage) => {
        const out = parseIdentity(productMd(`stage: ${stage}\n`));
        if (out.frontMatter.type === "product") {
          expect(out.frontMatter.stage).toBe(stage);
        }
      },
    );

    it("rejects an invalid `stage` enum value", () => {
      expect(() =>
        parseIdentity(productMd("stage: prototype\n")),
      ).toThrow(IdentityParseError);
    });

    it("rejects an empty-string `team` (optional must mean absent, not blank)", () => {
      expect(() => parseIdentity(productMd('team: ""\n'))).toThrow(
        IdentityParseError,
      );
    });
  });
});
