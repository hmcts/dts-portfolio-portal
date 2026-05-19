import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumbs } from "./breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders each label in order", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Jurisdictions" },
          { label: "Crime", href: "/j/crime" },
          { label: "Common Platform Domain" },
        ]}
      />,
    );
    const text = screen.getByLabelText("Breadcrumb").textContent ?? "";
    expect(text.indexOf("Jurisdictions")).toBeLessThan(text.indexOf("Crime"));
    expect(text.indexOf("Crime")).toBeLessThan(
      text.indexOf("Common Platform Domain"),
    );
  });

  it("marks the last item as aria-current=page", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Jurisdictions", href: "/" },
          { label: "Civil", href: "/j/civil" },
          { label: "Money Claims" },
        ]}
      />,
    );
    const current = screen.getByText("Money Claims");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("links intermediate items", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Jurisdictions", href: "/" },
          { label: "Crime", href: "/j/crime" },
          { label: "Common Platform" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Crime" })).toHaveAttribute(
      "href",
      "/j/crime",
    );
  });
});
