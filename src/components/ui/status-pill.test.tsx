import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./status-pill";

describe("StatusPill", () => {
  it("renders the label text", () => {
    render(<StatusPill tone="green" label="Live" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders the icon when supplied with aria-hidden", () => {
    render(
      <StatusPill
        tone="amber"
        icon={<svg data-testid="status-icon" />}
        label="Alpha"
      />,
    );
    const wrapper = screen.getByTestId("status-icon").parentElement!;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
  });

  it("never relies on colour alone — always carries a label", () => {
    // Smoke regression test for the §8.1 rule: the label prop is
    // required at the type level, so this just renders without an
    // icon to confirm the label still surfaces.
    render(<StatusPill tone="red" label="Low" />);
    expect(screen.getByText("Low")).toBeVisible();
  });
});
