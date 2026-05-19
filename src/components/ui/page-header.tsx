import { cn } from "@/lib/cn";
import { Eyebrow } from "./eyebrow";

// Page header per requirements spec §5: eyebrow → H1 → lede → optional
// action cluster on the right. Used at the top of every page route.

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-6",
        className,
      )}
    >
      <div className="max-w-[60ch]">
        {eyebrow ? <Eyebrow className="mb-[10px]">{eyebrow}</Eyebrow> : null}
        <h1 className="m-0 text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink)]">
          {title}
        </h1>
        {lede ? (
          <p className="mt-3 max-w-[64ch] text-[18px] leading-snug text-[var(--color-ink-soft)] text-pretty">
            {lede}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}
