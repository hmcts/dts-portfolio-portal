import { describe, expect, it } from "vitest";
import { looksLikeSlug, normaliseJurisdictionRef, slugify } from "./slugify";

// Unit tests for the slug-derivation helpers per requirements spec
// §3.2. These are pure functions, so the tests are pure too — no
// test doubles, no DB, just `import + assert`.

describe("slugify", () => {
  it("lowercases and dashes a plain name", () => {
    expect(slugify("Common Platform")).toBe("common-platform");
  });

  it("collapses runs of non-alphanumerics into a single dash", () => {
    expect(slugify("Common  Platform / Hearings")).toBe(
      "common-platform-hearings",
    );
  });

  it("strips leading and trailing punctuation", () => {
    expect(slugify("  - Common Platform - ")).toBe("common-platform");
  });

  it("strips accents (NFKD + diacritic removal)", () => {
    // Café Ñoño ÅngströM → cafe-nono-angstrom
    expect(slugify("Café Ñoño ÅngströM")).toBe("cafe-nono-angstrom");
  });

  it("keeps digits", () => {
    expect(slugify("Common Platform 2")).toBe("common-platform-2");
  });

  it("returns an empty string for input with no alphanumerics", () => {
    expect(slugify("---///   ---")).toBe("");
    expect(slugify("    ")).toBe("");
  });

  it("is idempotent — slugify(slugify(x)) === slugify(x)", () => {
    const cases = [
      "Common Platform",
      "Café Ñoño",
      "Common  Platform / Hearings",
      "ALREADY-A-SLUG",
    ];
    for (const c of cases) {
      const once = slugify(c);
      expect(slugify(once)).toBe(once);
    }
  });

  it("clamps very long names at 80 chars", () => {
    const long = "a".repeat(120);
    const out = slugify(long);
    expect(out.length).toBeLessThanOrEqual(80);
    // Boundary: never returns a slug ending in a dash because of
    // the clamp, even if the underlying name was longer.
    expect(out.endsWith("-")).toBe(false);
  });

  it("does not double-dash when the source had separators that collapse", () => {
    expect(slugify("A___B---C   D")).toBe("a-b-c-d");
  });
});

describe("normaliseJurisdictionRef", () => {
  it.each([
    ["crime", "crime"],
    ["Crime", "crime"],
    ["CRIME", "crime"],
    ["  crime  ", "crime"],
    ["civil", "civil"],
    ["family", "family"],
    ["tribunals", "tribunals"],
    ["administrative", "administrative"],
  ])("accepts %j and returns the canonical slug %j", (input, expected) => {
    expect(normaliseJurisdictionRef(input)).toBe(expected);
  });

  it("returns null for an unknown jurisdiction string", () => {
    expect(normaliseJurisdictionRef("outer-space")).toBeNull();
    expect(normaliseJurisdictionRef("Civil Servants")).toBeNull();
    expect(normaliseJurisdictionRef("")).toBeNull();
  });

  it("does not silently fuzzy-match — partial names are rejected", () => {
    // "crim" is not crime; we never want to accept a typo as a hit.
    expect(normaliseJurisdictionRef("crim")).toBeNull();
    expect(normaliseJurisdictionRef("crimes")).toBeNull();
  });
});

describe("looksLikeSlug", () => {
  it("accepts canonical dash-separated lowercase slugs", () => {
    expect(looksLikeSlug("common-platform")).toBe(true);
    expect(looksLikeSlug("crime")).toBe(true);
    expect(looksLikeSlug("a")).toBe(true);
    expect(looksLikeSlug("a-b-c-1-2-3")).toBe(true);
  });

  it("rejects uppercase, spaces, leading/trailing dashes", () => {
    expect(looksLikeSlug("Common-Platform")).toBe(false);
    expect(looksLikeSlug("common platform")).toBe(false);
    expect(looksLikeSlug("-common")).toBe(false);
    expect(looksLikeSlug("common-")).toBe(false);
    expect(looksLikeSlug("common--platform")).toBe(false);
    expect(looksLikeSlug("")).toBe(false);
  });

  it("rejects accents and punctuation", () => {
    expect(looksLikeSlug("café")).toBe(false);
    expect(looksLikeSlug("common.platform")).toBe(false);
    expect(looksLikeSlug("common_platform")).toBe(false);
  });
});
