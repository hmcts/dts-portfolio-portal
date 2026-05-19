"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";
import { useSearch } from "@/lib/search/use-search";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";

// Instant search overlay per requirements spec §6.1 + §5.7.
//
// Layout:
//   - Pill-shaped input with a leading magnifier and a "/" hotkey hint
//   - When focused AND query non-empty, a dropdown panel renders
//     immediately below the input with the top results
//   - Up/Down navigates; Enter opens the highlighted result or
//     submits to /search?q=… if nothing is highlighted; Escape
//     closes the overlay and blurs the input
//   - "/" anywhere on the page focuses the input (skipped when the
//     user is already typing into a form field)
//
// LLM answer-card synthesis (task 3.3) renders above the ranked list
// when wired in a follow-up; the placeholder is hidden until then.

const ENTITY_LABELS: Record<string, string> = {
  jurisdiction: "Jurisdiction",
  domain: "Domain",
  team: "Team",
  product: "Product",
  initiative: "Initiative",
};

export function SearchOverlay() {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const { results, loading, error } = useSearch(query);

  // Reset highlighted index when the result list changes
  useEffect(() => {
    setActive(0);
  }, [results]);

  // Global "/" hotkey
  useEffect(() => {
    function onGlobalKey(e: globalThis.KeyboardEvent) {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const editable = target?.isContentEditable;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        editable
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  const open = focused && query.trim() !== "";

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[active];
      if (target?.href) {
        inputRef.current?.blur();
        router.push(target.href);
      } else if (query.trim()) {
        inputRef.current?.blur();
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }
    }
  }

  const headline = useMemo(() => {
    if (loading && results.length === 0) return "Searching…";
    if (error) return `Search failed: ${error}`;
    if (results.length === 0) return "No matches";
    return `${results.length} match${results.length === 1 ? "" : "es"}`;
  }, [loading, error, results.length]);

  return (
    <div className="relative w-full max-w-[520px]">
      <label
        htmlFor={inputId}
        className="flex w-full items-center gap-2.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm focus-within:border-[var(--color-border-strong)]"
      >
        <Search size={16} aria-hidden="true" className="text-[var(--color-muted)]" />
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          role="combobox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Defer so a click on a result lands before blur closes
            // the overlay.
            setTimeout(() => setFocused(false), 120);
          }}
          onKeyDown={onKey}
          placeholder="Ask: 'who owns Common Platform?' — or a name"
          aria-label="Search the portal"
          aria-autocomplete="list"
          aria-controls={`${inputId}-listbox`}
          aria-expanded={open}
          className="min-w-0 flex-1 bg-transparent text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none"
        />
        {loading ? (
          <Loader2
            size={14}
            aria-hidden="true"
            className="animate-spin text-[var(--color-muted)]"
          />
        ) : (
          <kbd className="hidden rounded border border-[var(--color-border)] bg-[var(--color-surface-sunk)] px-1.5 text-[11px] text-[var(--color-muted)] sm:inline">
            /
          </kbd>
        )}
      </label>

      {open ? (
        <div
          id={`${inputId}-listbox`}
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[460px] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_8px_24px_rgba(28,25,23,0.10)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 text-[12px] text-[var(--color-muted)]">
            <span>{headline}</span>
            <Link
              href={`/search?q=${encodeURIComponent(query)}`}
              className="text-[var(--color-ink-soft)] underline-offset-2 hover:underline"
              tabIndex={-1}
            >
              See all
            </Link>
          </div>
          {results.length > 0 ? (
            <ul className="py-1">
              {results.map((r, i) => {
                const isActive = i === active;
                const body = (
                  <div
                    role="option"
                    aria-selected={isActive}
                    className={cn(
                      "flex items-start gap-3 px-4 py-2.5 text-left",
                      isActive ? "bg-[var(--color-surface-sunk)]" : undefined,
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <Eyebrow className="mb-0.5">
                        {ENTITY_LABELS[r.entityType] ?? r.entityType}
                      </Eyebrow>
                      <div className="truncate text-[14px] font-medium text-[var(--color-ink)]">
                        {r.name}
                      </div>
                      {r.description ? (
                        <p className="line-clamp-1 text-[12px] text-[var(--color-muted)]">
                          {r.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
                return (
                  <li key={`${r.entityType}-${r.id}`}>
                    {r.href ? (
                      <Link
                        href={r.href}
                        onMouseEnter={() => setActive(i)}
                        className="block hover:bg-[var(--color-surface-sunk)]"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="block">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : !loading && !error ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--color-muted)]">
              No matches yet. Try a name, a Domain, or "who owns…".
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
