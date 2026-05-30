import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// Initiative chip per requirements spec §4.3 — appears in NOW / NEXT /
// LATER columns of the roadmap matrix. Three time-bucket variants with
// distinct background, foreground, and edge colours.
//
// Status pills never rely on colour alone (§8.1) — the chip text plus
// the bucket label in the matrix header carry the semantics.

const chipStyles = cva(
  "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-[5px] text-left text-[13px] transition-colors cursor-pointer focus:outline-none",
  {
    variants: {
      bucket: {
        NOW: "bg-[var(--color-now-bg)] text-[var(--color-now-fg)] border-[var(--color-now-edge)] hover:brightness-[0.98]",
        NEXT: "bg-[var(--color-next-bg)] text-[var(--color-next-fg)] border-[var(--color-next-edge)] hover:brightness-[0.98]",
        LATER:
          "bg-[var(--color-later-bg)] text-[var(--color-later-fg)] border-[var(--color-later-edge)] hover:brightness-[0.98]",
      },
    },
    defaultVariants: {
      bucket: "NOW",
    },
  },
);

export interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title">,
    VariantProps<typeof chipStyles> {
  label: string;
  hint?: string;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { bucket, label, hint, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(chipStyles({ bucket }), className)}
      // Only render the native title tooltip when an explicit hint
      // is supplied. Chips that surface their detail through a click
      // affordance (e.g. InitiativeChip → Sheet drawer) pass no hint
      // and therefore have no hover popup.
      title={hint}
      {...props}
    >
      <span className="truncate">{label}</span>
    </button>
  );
});
