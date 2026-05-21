"use client";

import { ExternalLink } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import type { Initiative, TimeBucket } from "@/lib/entities";

// Initiative chip with a slide-over Sheet on click. Matches the
// prototype's drawer-style detail surface (right-anchored, focus
// trapped, ESC to close).
//
// No hover tooltip — `hint` is intentionally not passed to the
// underlying Chip primitive so the browser-native `title` popup is
// suppressed; the drawer carries the full detail instead.

const BUCKET_LABELS: Record<TimeBucket, string> = {
  NOW: "Now · in flight",
  NEXT: "Next · committed",
  LATER: "Later · acknowledged",
};

export function InitiativeChip({
  initiative,
  productName,
}: {
  initiative: Initiative;
  productName?: string;
}) {
  const bucket = initiative.bucket as TimeBucket;
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
          {initiative.description ? (
            <p className="text-[14px] text-[var(--color-ink-soft)]">
              {initiative.description}
            </p>
          ) : null}
          {initiative.outboundUrl ? (
            <a
              href={initiative.outboundUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-ink-soft)] hover:underline"
            >
              Open source
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
