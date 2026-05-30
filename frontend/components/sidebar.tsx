"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ChevronRight,
  Upload,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

// localStorage key for persisting the expanded-state of each
// jurisdiction's domain list. Stable across releases so users keep
// their choice. Read-after-mount and write-on-change keeps the SSR
// render deterministic ("Crime expanded" matches the prototype).
const SIDEBAR_STORAGE_KEY = "dts-portal:sidebar:jurisdictions";

// The seed stores Domain names as "<Theme> Domain" (e.g. "Common
// Platform Domain"). The prototype's sidebar lists them without the
// suffix to keep each row compact. Entity pages still use the full
// name as the title so the data layer keeps it intact.
function trimDomainSuffix(name: string): string {
  return name.replace(/\s+Domain$/i, "");
}

// Shape of one Jurisdiction in the sidebar nav. Sourced from
// getSidebarJurisdictions() in portal-data.ts so counts + lists
// stay in sync with the actual content. The previous hardcoded
// version showed wrong counts for Civil / Family / Tribunals /
// Administrative and had NO domain list for any of them — the
// expand chevron worked but rendered an empty section.
export interface SidebarJurisdiction {
  slug: string;
  name: string;
  count: number;
  domains: Array<{ slug: string; name: string }>;
}

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

export function Sidebar({
  jurisdictions,
}: {
  jurisdictions: SidebarJurisdiction[];
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    crime: true,
  });

  // Rehydrate from localStorage after first render. Done in an effect
  // so the SSR-rendered markup matches the client's first paint —
  // see CLAUDE.md note on SSR safety.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") {
          setExpanded((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      // localStorage disabled or value corrupt — fall back to defaults.
    }
  }, []);

  // Persist on every change. Wrapped in try/catch because Safari
  // private-mode and storage quotas can throw.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        JSON.stringify(expanded),
      );
    } catch {
      // Ignore — in-memory state still works for this session.
    }
  }, [expanded]);

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

        {jurisdictions.map((j) => {
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
                {/* Chevron leads — the prototype puts the
                    open/closed indicator BEFORE the Jurisdiction
                    name. No Scale icon: the prototype omits any
                    Jurisdiction-row icon entirely. */}
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-[var(--color-muted)] transition-transform",
                    open && "rotate-90",
                  )}
                />
                <span className="flex-1 truncate">{j.name}</span>
                <span className="text-[12px] text-[var(--color-muted)]">
                  {j.count}
                </span>
              </button>
              {open && j.domains.length > 0 ? (
                <div id={`nav-${j.slug}`} className="ml-7 mt-0.5 flex flex-col gap-0.5">
                  {j.domains.map((d) => (
                    <NavItem
                      key={d.slug}
                      href={`/d/${d.slug}`}
                      label={trimDomainSuffix(d.name)}
                      active={isActive(`/d/${d.slug}`)}
                      small
                    />
                  ))}
                </div>
              ) : open ? (
                <div
                  id={`nav-${j.slug}`}
                  className="ml-7 mt-0.5 px-2.5 py-1.5 text-[12px] text-[var(--color-muted)]"
                >
                  No Domains yet.
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
          icon={Upload}
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
