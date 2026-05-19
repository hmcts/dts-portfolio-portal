export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="mb-2 text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
        DTS Portfolio
      </p>
      <h1 className="font-sans text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
        DTS Portfolio Portal
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--color-ink-muted)]">
        A high-level front door over Ardoq, Jira, and Confluence for HMCTS DTS.
        Scaffold up; pages land in subsequent commits.
      </p>
      <p className="mt-12 text-sm text-[var(--color-ink-muted)]">
        Phase 1 foundation — see{" "}
        <code className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[0.85em]">
          docs/superpowers/plans/2026-05-15-dts-portfolio-portal.md
        </code>
        .
      </p>
    </main>
  );
}
