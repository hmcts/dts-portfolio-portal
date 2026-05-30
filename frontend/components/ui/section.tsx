import { cn } from "@/lib/cn";
import { Eyebrow } from "./eyebrow";

// Page section: eyebrow + heading + optional right-aligned actions row,
// then a vertical stack of content. Mirrors the prototype's .section /
// .section-head / .h2 trio without adding a third primitive.

export function Section({
  eyebrow,
  heading,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  heading: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-10", className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}
          <h2 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            {heading}
          </h2>
        </div>
        {actions ? (
          <div className="flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
