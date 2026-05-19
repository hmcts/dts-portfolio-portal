import { cn } from "@/lib/cn";

// Eyebrow label per spec §6.6 — small, uppercase, tracked, muted.
// Sits above the page H1 and major content blocks.

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]",
        className,
      )}
    >
      {children}
    </p>
  );
}
