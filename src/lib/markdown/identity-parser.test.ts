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
});
