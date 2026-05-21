import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chip } from "./chip";

describe("Chip", () => {
  it("renders the label", () => {
    render(<Chip bucket="NOW" label="Auth flow migration" />);
    expect(screen.getByRole("button")).toHaveTextContent("Auth flow migration");
  });

  it("uses the hint as the title tooltip when supplied", () => {
    render(
      <Chip bucket="NEXT" label="Passkeys pilot" hint="Internal-users-only" />,
    );
    expect(screen.getByRole("button")).toHaveAttribute(
      "title",
      "Internal-users-only",
    );
  });

  it("omits the title attribute entirely when no hint is provided", () => {
    render(<Chip bucket="LATER" label="Event-sourcing re-platform" />);
    expect(screen.getByRole("button")).not.toHaveAttribute("title");
  });

  it.each([
    ["NOW", "color-now-bg"],
    ["NEXT", "color-next-bg"],
    ["LATER", "color-later-bg"],
  ] as const)("applies the %s bucket background variant", (bucket, tokenFragment) => {
    render(<Chip bucket={bucket} label={bucket} />);
    const className = screen.getByRole("button").className;
    expect(className).toContain(tokenFragment);
  });
});
