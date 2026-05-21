"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Scale, ArrowRight } from "lucide-react";
import { InitiativeChip } from "@/components/initiative-chip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { MatrixJurisdictionBand } from "@/lib/portal-data";

// Cross-DTS roadmap matrix per requirements spec §5.2. Rows: Product
// Domains grouped under their Jurisdiction. Columns: NOW / NEXT /
// LATER. Cells: Initiative chips inherited from the Domain's Products'
// roadmaps.
//
// Jurisdictions other than the first are collapsed by default; the
// preference will eventually persist via localStorage (1.16 task).

const BUCKETS = ["NOW", "NEXT", "LATER"] as const;

export function RoadmapMatrix({
  bands,
}: {
  bands: MatrixJurisdictionBand[];
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(bands.map((b, i) => [b.jurisdiction.slug, i === 0])),
  );

  return (
    <div
      role="region"
      aria-label="Cross-DTS roadmap"
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="grid grid-cols-[280px_repeat(3,1fr)] border-b border-[var(--color-border)] bg-[var(--color-surface-sunk)] text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
        <div className="border-r border-[var(--color-border)] px-4 py-3">
          Product Domain
        </div>
        <div className="border-r border-[var(--color-border)] px-4 py-3">
          Now <span className="text-[var(--color-muted)] normal-case font-normal">· in flight</span>
        </div>
        <div className="border-r border-[var(--color-border)] px-4 py-3">
          Next <span className="text-[var(--color-muted)] normal-case font-normal">· committed</span>
        </div>
        <div className="px-4 py-3">
          Later <span className="text-[var(--color-muted)] normal-case font-normal">· acknowledged</span>
        </div>
      </div>

      {bands.map((band) => {
        const open = !!expanded[band.jurisdiction.slug];
        const bandId = `band-${band.jurisdiction.slug}`;
        const bodyId = `${bandId}-body`;
        return (
          <div key={band.jurisdiction.slug}>
            <div
              className={cn(
                "flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-sunk)] px-4 py-2.5 text-[13px]",
              )}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [band.jurisdiction.slug]: !prev[band.jurisdiction.slug],
                  }))
                }
                className="flex flex-1 items-center gap-2.5 text-left font-semibold text-[var(--color-ink)]"
              >
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className={cn(
                    "transition-transform text-[var(--color-muted)]",
                    open && "rotate-90",
                  )}
                />
                <Scale size={14} aria-hidden="true" />
                <span>{band.jurisdiction.name}</span>
                <span className="text-[12px] font-normal text-[var(--color-muted)]">
                  · {band.domainCount} {band.domainCount === 1 ? "domain" : "domains"} · {band.initiativeCount} {band.initiativeCount === 1 ? "initiative" : "initiatives"}
                </span>
              </button>
              <Link
                href={`/j/${band.jurisdiction.slug}`}
                className="text-[var(--color-ink-soft)]"
              >
                <Button variant="ghost" size="sm">
                  Open jurisdiction
                  <ArrowRight size={12} aria-hidden="true" />
                </Button>
              </Link>
            </div>

            {open ? (
              <div id={bodyId}>
                {band.rows.length === 0 ? (
                  <div className="border-t border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-muted)]">
                    No domains in this Jurisdiction yet.
                  </div>
                ) : (
                  band.rows.map((row) => (
                    <div
                      key={row.domain.slug}
                      className="grid grid-cols-[280px_repeat(3,1fr)] border-t border-[var(--color-border)]"
                    >
                      <div className="border-r border-[var(--color-border)] px-4 py-4">
                        <Link
                          href={`/d/${row.domain.slug}`}
                          className="text-[14px] font-medium text-[var(--color-ink)] hover:underline"
                        >
                          {row.domain.name}
                        </Link>
                        <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                          {row.productCount} {row.productCount === 1 ? "product" : "products"}
                        </div>
                      </div>
                      {BUCKETS.map((bucket, bucketIdx) => (
                        <div
                          key={bucket}
                          className={cn(
                            "flex flex-wrap content-start gap-1.5 px-4 py-4",
                            // Vertical dividers between NOW / NEXT /
                            // LATER cells, matching the prototype's
                            // `.matrix-row .cell { border-right: 1px solid var(--border); }`.
                            // The final cell omits the right border
                            // so the table edge is the only line on
                            // the far right.
                            bucketIdx < BUCKETS.length - 1 &&
                              "border-r border-[var(--color-border)]",
                          )}
                        >
                          {row.cells[bucket].length === 0 ? (
                            <span className="self-center text-[12px] text-[var(--color-muted)]">
                              —
                            </span>
                          ) : (
                            row.cells[bucket].map((i) => (
                              <InitiativeChip key={i.id} initiative={i} />
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
