import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Sidebar } from "./sidebar";
import type { SidebarJurisdiction } from "@/lib/types";

// Component tests for the Sidebar. Pins the rendering contract
// that PR #41 fixed: every Jurisdiction's expand chevron reveals
// the supplied domain list, and an empty list renders the
// graceful "No Domains yet." fallback instead of silently nothing.
//
// Sidebar uses `usePathname` from next/navigation — we mock it
// inline with `vi.mock` to provide a stable return value. The
// rest is plain RTL.
import { vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const FIXTURE: SidebarJurisdiction[] = [
  {
    slug: "crime",
    name: "Crime",
    count: 2,
    domains: [
      { slug: "common-platform", name: "Common Platform" },
      { slug: "courtroom-hearings", name: "Courtroom & Hearings" },
    ],
  },
  {
    slug: "civil",
    name: "Civil",
    count: 1,
    domains: [{ slug: "civil-money", name: "Civil Money" }],
  },
  // Edge case: a Jurisdiction with no Domains (shouldn't happen
  // with the seed but the helper allows it). The Sidebar must
  // render the "No Domains yet." copy rather than nothing.
  {
    slug: "tribunals",
    name: "Tribunals",
    count: 0,
    domains: [],
  },
];

beforeEach(() => {
  // Sidebar persists expanded state to localStorage on every change
  // and rehydrates from it in useEffect. Without clearing between
  // tests, state from one test leaks into the next (a test that
  // expands Civil leaves it expanded for the next, which then sees
  // it ALREADY open and a click toggles CLOSED instead of OPEN).
  // happy-dom's localStorage behaviour differs across environments
  // — this passes locally but fails in CI without the reset.
  try {
    window.localStorage.clear();
  } catch {
    // Some happy-dom configurations disable localStorage entirely;
    // .clear() throws then. Safe to ignore — the tests don't rely
    // on it being present, only on it not being polluted.
  }
});

afterEach(() => {
  cleanup();
});

describe("<Sidebar /> — rendering the supplied jurisdictions", () => {
  it("renders one button per Jurisdiction with its name and count", () => {
    render(<Sidebar jurisdictions={FIXTURE} />);
    // Each Jurisdiction is rendered as a button with an
    // aria-controls pointing at its nav-<slug> region.
    for (const j of FIXTURE) {
      const button = screen.getByRole("button", {
        name: new RegExp(`^${j.name}\\s+${j.count}`),
      });
      expect(button).toBeTruthy();
      expect(button.getAttribute("aria-controls")).toBe(`nav-${j.slug}`);
    }
  });

  it("Crime is expanded by default (matches the prototype's expanded-Crime example)", () => {
    render(<Sidebar jurisdictions={FIXTURE} />);
    // Default expanded state is { crime: true } per the Sidebar's
    // useState initialiser. Its domain links should be visible
    // immediately.
    expect(screen.getByRole("link", { name: "Common Platform" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Courtroom & Hearings" }),
    ).toBeTruthy();
  });

  it("Other Jurisdictions are collapsed by default", () => {
    render(<Sidebar jurisdictions={FIXTURE} />);
    expect(screen.queryByRole("link", { name: "Civil Money" })).toBeNull();
  });
});

describe("<Sidebar /> — expand-chevron behaviour (the bug PR #41 fixed)", () => {
  it("clicking a Jurisdiction's chevron reveals its domain links", () => {
    render(<Sidebar jurisdictions={FIXTURE} />);
    // Civil is collapsed initially.
    expect(screen.queryByRole("link", { name: "Civil Money" })).toBeNull();
    // Click to expand.
    const civilButton = screen.getByRole("button", {
      name: new RegExp("^Civil\\s+1"),
    });
    fireEvent.click(civilButton);
    // Domain link now visible.
    expect(screen.getByRole("link", { name: "Civil Money" })).toBeTruthy();
  });

  it("clicking a chevron twice toggles open then closed", () => {
    render(<Sidebar jurisdictions={FIXTURE} />);
    const civilButton = screen.getByRole("button", {
      name: new RegExp("^Civil\\s+1"),
    });
    fireEvent.click(civilButton);
    expect(screen.getByRole("link", { name: "Civil Money" })).toBeTruthy();
    fireEvent.click(civilButton);
    expect(screen.queryByRole("link", { name: "Civil Money" })).toBeNull();
  });

  it("a Jurisdiction with an EMPTY domains list renders the 'No Domains yet.' copy when expanded", () => {
    render(<Sidebar jurisdictions={FIXTURE} />);
    // Tribunals has domains: [] in the fixture. Expand it and
    // assert the graceful empty-state — pre-PR-41 the section
    // rendered nothing at all, which is the actual bug.
    const tribunalsButton = screen.getByRole("button", {
      name: new RegExp("^Tribunals\\s+0"),
    });
    fireEvent.click(tribunalsButton);
    expect(screen.getByText("No Domains yet.")).toBeTruthy();
  });

  it("aria-expanded reflects the open/closed state", () => {
    render(<Sidebar jurisdictions={FIXTURE} />);
    const civilButton = screen.getByRole("button", {
      name: new RegExp("^Civil\\s+1"),
    });
    expect(civilButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(civilButton);
    expect(civilButton.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("<Sidebar /> — top-level static nav items", () => {
  it("renders Home, Add content, and Help & templates regardless of jurisdictions", () => {
    render(<Sidebar jurisdictions={[]} />);
    expect(screen.getByRole("link", { name: /Home/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Add content/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Help & templates/ })).toBeTruthy();
  });

  it("renders without jurisdictions without crashing (empty array contract)", () => {
    expect(() => render(<Sidebar jurisdictions={[]} />)).not.toThrow();
  });
});
