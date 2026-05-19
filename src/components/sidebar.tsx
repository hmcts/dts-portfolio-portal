"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ChevronRight,
  Plus,
  HelpCircle,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

// Fixed jurisdiction taxonomy per requirements spec §3.2. The domain
// list under each is wired to live data once seed lands in 1.6; for now
// the foundation shows the v1 Crime placeholders so the prototype's
// expanded-Crime example renders identically.
const JURISDICTIONS: Array<{
  slug: string;
  name: string;
  count: number;
  domains?: Array<{ slug: string; name: string }>;
}> = [
  {
    slug: "crime",
    name: "Crime",
    count: 3,
    domains: [
      { slug: "common-platform", name: "Common Platform" },
      { slug: "courtroom-hearings", name: "Courtroom & Hearings" },
      { slug: "case-preparation", name: "Case Preparation" },
    ],
  },
  { slug: "civil", name: "Civil", count: 2 },
  { slug: "family", name: "Family", count: 2 },
  { slug: "tribunals", name: "Tribunals", count: 3 },
  { slug: "administrative", name: "Administrative", count: 1 },
];

interface NavItemProps {
  href?: string;
  icon?: LucideIcon;
  label: string;
  active?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
  small?: boolean;
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  trailing,
  onClick,
  small,
}: NavItemProps) {
  const classes = cn(
    "flex w-full items-center gap-2.5 rounded-lg text-left transition-colors whitespace-nowrap",
    small ? "px-2.5 py-1.5 text-[13px]" : "px-2.5 py-2 text-sm",
    active
      ? "bg-[var(--color-surface-sunk)] text-[var(--color-ink)] font-medium"
      : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunk)]",
  );
  const content = (
    <>
      {Icon ? <Icon size={small ? 14 : 16} aria-hidden="true" /> : null}
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} onClick={onClick}>
      {content}
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    crime: true,
  });
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      aria-label="Portal navigation"
      className="flex h-dvh w-[224px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-ink)] text-[11px] font-semibold tracking-wider text-[var(--color-surface)]"
        >
          DTS
        </span>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold text-[var(--color-ink)]">
            DTS Portfolio
          </div>
          <div className="text-[11px] text-[var(--color-muted)]">HMCTS</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
        <NavItem
          href="/"
          icon={Home}
          label="Home"
          active={isActive("/")}
        />

        <div className="mt-3 px-2.5 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
          Jurisdictions
        </div>

        {JURISDICTIONS.map((j) => {
          const open = !!expanded[j.slug];
          const href = `/j/${j.slug}`;
          return (
            <div key={j.slug}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`nav-${j.slug}`}
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [j.slug]: !prev[j.slug] }))
                }
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm whitespace-nowrap transition-colors",
                  isActive(href)
                    ? "bg-[var(--color-surface-sunk)] text-[var(--color-ink)] font-medium"
                    : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunk)]",
                )}
              >
                <Scale size={16} aria-hidden="true" />
                <span className="flex-1 truncate">{j.name}</span>
                <span className="text-[12px] text-[var(--color-muted)]">
                  {j.count}
                </span>
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className={cn(
                    "transition-transform",
                    open && "rotate-90",
                  )}
                />
              </button>
              {open && j.domains ? (
                <div id={`nav-${j.slug}`} className="ml-7 mt-0.5 flex flex-col gap-0.5">
                  {j.domains.map((d) => (
                    <NavItem
                      key={d.slug}
                      href={`/d/${d.slug}`}
                      label={d.name}
                      active={isActive(`/d/${d.slug}`)}
                      small
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="mt-3 px-2.5 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
          Curate
        </div>
        <NavItem
          href="/upload"
          icon={Plus}
          label="Add content"
          active={isActive("/upload")}
        />
        <NavItem
          href="/help"
          icon={HelpCircle}
          label="Help & templates"
          active={isActive("/help")}
        />
      </nav>
    </aside>
  );
}
