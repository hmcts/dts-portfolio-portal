import { Search } from "lucide-react";

// Top bar: portal-wide search input (functional wiring comes in
// Phase 3) plus a phase badge for the "this is a new service"
// message gov.uk pattern requires while we're in beta.

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
      <div className="ml-auto flex w-full max-w-[520px] items-center">
        <label className="flex w-full items-center gap-2.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm focus-within:border-[var(--color-border-strong)]">
          <Search size={16} aria-hidden="true" className="text-[var(--color-muted)]" />
          <input
            type="search"
            placeholder="Ask: 'who owns Common Platform?' — or a name"
            aria-label="Search the portal"
            className="min-w-0 flex-1 bg-transparent text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none"
          />
          <kbd className="hidden rounded border border-[var(--color-border)] bg-[var(--color-surface-sunk)] px-1.5 text-[11px] text-[var(--color-muted)] sm:inline">
            /
          </kbd>
        </label>
      </div>
    </header>
  );
}
