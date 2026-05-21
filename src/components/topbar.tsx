import { SearchOverlay } from "./search-overlay";
import {
  TopbarStatusSlot,
  isTopbarDegraded,
} from "./topbar-status-slot";

// Top bar: portal-wide search overlay (Phase 3), the gov.uk-style
// phase badge, and the system-status slot.
//
// The status slot has two modes:
//   * Healthy — gov.uk "this is a new service" message.
//   * Degraded — replaces the new-service message with the AI
//     degradation copy and tints the bar amber. ADR-011 tier 3:
//     visible degradation lives in the same bar the user is
//     looking at anyway, not stacked above it as a second row.
//
// Layout: the <header> spans full width so the bottom border + the
// degraded tint go edge-to-edge. The contents are wrapped in a
// mx-auto max-w-[1480px] container so the Beta pill, status slot,
// and search overlay align with the page content beneath it (which
// uses the same max-width pattern). The header's outer px-8 mirrors
// AppShell's main padding so on narrow viewports the bar contents
// stay inset by the same amount as the page below.

export function Topbar() {
  const degraded = isTopbarDegraded();

  // When degraded, swap the surface to a warm tan and the border
  // to a matching deeper tan. The Beta pill and search overlay
  // keep their own colours.
  const headerClass = degraded
    ? "sticky top-0 z-10 h-14 border-b border-[#f0d27a] bg-[#fff8e6] px-8"
    : "sticky top-0 z-10 h-14 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8";

  return (
    <header role="banner" className={headerClass}>
      <div className="mx-auto flex h-full max-w-[1480px] items-center gap-4">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[#1d70b8] px-2.5 py-0.5 text-[12px] font-semibold tracking-wide text-white">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-white"
          />
          Beta
        </span>

        <TopbarStatusSlot />

        <div className="ml-auto flex items-center">
          <SearchOverlay />
        </div>
      </div>
    </header>
  );
}
