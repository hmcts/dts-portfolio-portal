"use client";

import { ExternalLink } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Initiative, TimeBucket } from "@/lib/entities";

// Initiative chip with a popover per requirements spec §5.6 — click
// the chip to see one-line description, owner, and outbound link.
// The chip itself is a button; the popover is anchored to it.

export function InitiativeChip({
  initiative,
  productName,
}: {
  initiative: Initiative;
  productName?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Chip
          bucket={initiative.bucket as TimeBucket}
          label={initiative.title}
          hint={initiative.description ?? initiative.title}
        />
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            {initiative.bucket} · {productName ?? "Initiative"}
          </div>
          <div className="text-[15px] font-medium text-[var(--color-ink)]">
            {initiative.title}
          </div>
          {initiative.description ? (
            <p className="text-[13px] text-[var(--color-ink-soft)]">
              {initiative.description}
            </p>
          ) : null}
          {initiative.outboundUrl ? (
            <a
              href={initiative.outboundUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-[var(--color-ink-soft)] hover:underline"
            >
              Open source
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
