import { SearchOverlay } from "./search-overlay";

// Top bar: portal-wide search overlay (Phase 3) plus a gov.uk-style
// phase badge ("this is a new service") while we're in beta.

export function Topbar() {
  return (
    <header
      role="banner"
      className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6"
    >
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[#1d70b8] px-2.5 py-0.5 text-[12px] font-semibold tracking-wide text-white">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-white" />
        Beta
      </span>
      <span className="hidden text-[13px] text-[var(--color-muted)] md:inline">
        This is a new service — your feedback will help us improve it.
      </span>
      <div className="ml-auto flex items-center">
        <SearchOverlay />
      </div>
    </header>
  );
}
