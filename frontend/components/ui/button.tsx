import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Button per the prototype. Three variants matching what the standalone
// HTML uses: outline (default — surface fill, strong border), primary
// (ink fill, white text), ghost (transparent — for "Open jurisdiction"
// chevron rows).

const buttonStyles = cva(
  "inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outline:
          "rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-sunk)]",
        primary:
          "rounded-[var(--radius-pill)] border border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-surface)] hover:opacity-90",
        ghost:
          "rounded-[var(--radius-pill)] border border-transparent bg-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunk)]",
      },
      size: {
        md: "px-4 py-[9px]",
        sm: "px-3 py-[6px] text-[13px]",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(buttonStyles({ variant, size }), className)}
        {...props}
      />
    );
  },
);
