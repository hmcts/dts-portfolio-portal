import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("collapses conflicting Tailwind utilities to the last one", () => {
    // tailwind-merge keeps the rightmost class of the same family.
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("preserves classes from different families side by side", () => {
    const result = cn("p-4", "text-lg", "rounded-md");
    expect(result).toContain("p-4");
    expect(result).toContain("text-lg");
    expect(result).toContain("rounded-md");
  });
});
