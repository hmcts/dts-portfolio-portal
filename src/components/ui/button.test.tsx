import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("uses the outline variant by default", () => {
    render(<Button>Default</Button>);
    expect(screen.getByRole("button").className).toContain(
      "border-strong",
    );
  });

  it.each([
    ["outline", "bg-[var(--color-surface)]"],
    ["primary", "bg-[var(--color-ink)]"],
    ["ghost", "bg-transparent"],
  ] as const)("applies the %s variant background", (variant, fragment) => {
    render(<Button variant={variant}>{variant}</Button>);
    expect(screen.getByRole("button").className).toContain(fragment);
  });
});
