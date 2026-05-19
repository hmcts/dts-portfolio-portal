import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

// Breadcrumbs per requirements spec §6.4. Each segment is clickable
// to navigate up. Format on entity pages: Jurisdiction → Domain →
// Team | Product. Also rendered inside modal-as-detail surfaces.

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--color-muted)]",
        className,
      )}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-[var(--color-ink)] hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={isLast ? "font-medium text-[var(--color-ink)]" : undefined}
              >
                {item.label}
              </span>
            )}
            {!isLast ? (
              <ChevronRight
                size={12}
                aria-hidden="true"
                className="text-[var(--color-muted-2)]"
              />
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
