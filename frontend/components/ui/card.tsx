import { cn } from "@/lib/cn";

// Card surface — white fill, 1px hairline border, 14px radius, matches
// the prototype's .card. Padding optional so this composes with grid
// rows that don't want padding (e.g. activity list).

export function Card({
  children,
  className,
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        padding && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
