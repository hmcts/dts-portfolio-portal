// Global loading UI per requirements spec §3.2 ("skeleton cards /
// shimmer for loading"). Next.js renders this between server-component
// fetches so the AppShell stays put while a route streams in.

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1100px]" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="h-3 w-44 animate-pulse rounded bg-[var(--color-surface-sunk)]" />
        <div className="h-9 w-2/3 animate-pulse rounded bg-[var(--color-surface-sunk)]" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--color-surface-sunk)]" />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="h-32 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
        ))}
      </div>
      <span className="sr-only">Loading content…</span>
    </div>
  );
}
