"use client";

import Link from "next/link";
import { ArrowRight, Box, Info, ArrowUpRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import type { Initiative, TimeBucket } from "@/lib/types";

// Initiative chip with a slide-over Sheet on click. The drawer
// mirrors the standalone prototype's structure section-for-section:
// eyebrow + title, a standalone bucket pill, the description (or a
// "not yet added" placeholder so the layout stays stable), a static
// banner explaining what chips are and aren't, then two labelled
// link cards — parent Product and outbound link. Sections render
// regardless of data presence so the structure is always visible.

const BUCKET_LABELS: Record<TimeBucket, string> = {
  NOW: "Now · in flight",
  NEXT: "Next · committed",
  LATER: "Later · acknowledged",
};

const PILL_STYLES: Record<TimeBucket, string> = {
  NOW: "bg-[var(--color-now-bg)] text-[var(--color-now-fg)] border-[var(--color-now-edge)]",
  NEXT: "bg-[var(--color-next-bg)] text-[var(--color-next-fg)] border-[var(--color-next-edge)]",
  LATER:
    "bg-[var(--color-later-bg)] text-[var(--color-later-fg)] border-[var(--color-later-edge)]",
};

// Map an outbound URL to a human-readable system label. The
// prototype shows "jira" beneath an "Open in Jira" link; this
// detects the same systems by URL shape and falls back to the
// hostname. Heuristics — these are demo URLs, not anything to
// validate against.
function linkSystemLabel(url: string): { label: string; openIn: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host.includes("jira") || host.includes("atlassian") || path.startsWith("/browse/")) {
      return { label: "jira", openIn: "Open in Jira" };
    }
    if (host.includes("confluence")) {
      return { label: "confluence", openIn: "Open in Confluence" };
    }
    if (host.includes("ardoq")) {
      return { label: "ardoq", openIn: "Open in Ardoq" };
    }
    return { label: host, openIn: `Open at ${host}` };
  } catch {
    return { label: "external", openIn: "Open source" };
  }
}

export function InitiativeChip({
  initiative,
  productName,
  productHref,
}: {
  initiative: Initiative;
  productName?: string;
  productHref?: string;
}) {
  const bucket = initiative.bucket as TimeBucket;
  const outbound = initiative.outboundUrl
    ? linkSystemLabel(initiative.outboundUrl)
    : null;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Chip bucket={bucket} label={initiative.title} />
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            {BUCKET_LABELS[bucket]}
            {productName ? ` · on ${productName}` : null}
          </div>
          <SheetTitle>{initiative.title}</SheetTitle>
        </SheetHeader>

        <SheetBody>
          {/* Standalone bucket pill — same tone as the chip on the
              matrix, repeated here so the drawer reads as a detail
              view of the chip you just clicked. */}
          <span
            className={cn(
              "inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-[3px] text-[12px] font-medium",
              PILL_STYLES[bucket],
            )}
          >
            {bucket}
          </span>

          <p className="mt-4 text-[15px] text-[var(--color-ink-soft)] text-pretty">
            {initiative.description ?? "No description added yet."}
          </p>

          {/* "Chips are headlines, not tickets" — static helper,
              same copy as the prototype. Keeps reviewers from
              expecting ticket-level fidelity here. */}
          <div className="mt-6 flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-sunk)] px-4 py-3 text-[13px] text-[var(--color-ink-soft)]">
            <Info
              size={14}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--color-muted)]"
            />
            <p className="text-pretty">
              Initiative chips are headlines, not tickets. They don&apos;t have
              Jira numbers, sprint references, RAG status or
              percent-complete. The detail lives in Jira.
            </p>
          </div>

          {/* Parent product — always rendered. Falls back to a
              muted placeholder when the chip's data layer hasn't
              supplied a product link, so the section structure is
              stable. */}
          <div className="mt-6">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
              Parent product
            </div>
            {productName && productHref ? (
              <Link
                href={productHref}
                className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[14px] transition-colors hover:bg-[var(--color-surface-sunk)]"
              >
                <Box
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-muted)]"
                />
                <span className="flex-1 font-medium text-[var(--color-ink)]">
                  {productName}
                </span>
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[14px] text-[var(--color-muted)]">
                <Box size={16} aria-hidden="true" className="shrink-0" />
                <span className="flex-1">Not linked to a Product yet.</span>
              </div>
            )}
          </div>

          {/* Outbound link — also always rendered. When no URL is
              set, shows a muted "not yet linked" stub so reviewers
              can see where the link would appear. */}
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
              Outbound link
            </div>
            {outbound && initiative.outboundUrl ? (
              <a
                href={initiative.outboundUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[14px] transition-colors hover:bg-[var(--color-surface-sunk)]"
              >
                <ArrowUpRight
                  size={14}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-muted)]"
                />
                <span className="flex-1 text-[var(--color-ink)]">
                  {outbound.openIn}
                </span>
                <span className="text-[12px] text-[var(--color-muted-2)]">
                  {outbound.label}
                </span>
              </a>
            ) : (
              <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[14px] text-[var(--color-muted)]">
                <ArrowUpRight size={14} aria-hidden="true" className="shrink-0" />
                <span className="flex-1">No outbound link added yet.</span>
              </div>
            )}
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
