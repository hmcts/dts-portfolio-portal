import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// Status pill per requirements spec §6.6 — small soft-tinted background
// with foreground colour. Crucially: every status pill carries an icon
// or text label so meaning is never carried by colour alone (§8.1).

const pillStyles = cva(
  "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-[3px] text-[12px] font-medium",
  {
    variants: {
      tone: {
        green:
          "bg-[var(--color-stage-live-bg)] text-[var(--color-stage-live-fg)]",
        purple:
          "bg-[var(--color-stage-beta-bg)] text-[var(--color-stage-beta-fg)]",
        blue: "bg-[var(--color-stage-discovery-bg)] text-[var(--color-stage-discovery-fg)]",
        amber:
          "bg-[var(--color-stage-alpha-bg)] text-[var(--color-stage-alpha-fg)]",
        grey: "bg-[var(--color-stage-retired-bg)] text-[var(--color-stage-retired-fg)]",
        red: "bg-[var(--color-conf-low-bg)] text-[var(--color-conf-low-fg)]",
      },
    },
    defaultVariants: {
      tone: "grey",
    },
  },
);

export interface StatusPillProps extends VariantProps<typeof pillStyles> {
  icon?: ReactNode;
  label: string;
  className?: string;
}

export function StatusPill({ tone, icon, label, className }: StatusPillProps) {
  return (
    <span className={cn(pillStyles({ tone }), className)}>
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {label}
    </span>
  );
}
