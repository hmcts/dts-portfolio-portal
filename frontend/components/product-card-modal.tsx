"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, ArrowRight } from "lucide-react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import type {
  Initiative,
  Product,
  ProductDomain,
  ProductStage,
  Team,
  TimeBucket,
} from "@/lib/types";

// Product card that opens as a slide-over Sheet per requirements
// spec §6.2 (modal-as-detail). Preserves the parent page underneath;
// "View as page" affordance routes to /p/<slug>. Focus is trapped
// while open and restored on close by Radix Dialog.

const STAGE_TONE: Record<ProductStage, "blue" | "amber" | "purple" | "green" | "grey"> = {
  discovery: "blue",
  alpha: "amber",
  beta: "purple",
  live: "green",
  retiring: "grey",
  retired: "grey",
};

const BUCKETS: TimeBucket[] = ["NOW", "NEXT", "LATER"];

export function ProductCardModal({
  product,
  domain,
  team,
  initiatives,
  trigger,
}: {
  product: Product;
  domain?: ProductDomain;
  team?: Team;
  initiatives: Initiative[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const initiativesByBucket: Record<TimeBucket, Initiative[]> = {
    NOW: initiatives.filter((i) => i.bucket === "NOW"),
    NEXT: initiatives.filter((i) => i.bucket === "NEXT"),
    LATER: initiatives.filter((i) => i.bucket === "LATER"),
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <Eyebrow>
            {domain?.name ?? "Product"} · Product
          </Eyebrow>
          <div className="flex items-start justify-between gap-3">
            <SheetTitle>{product.name}</SheetTitle>
            <StatusPill
              tone={STAGE_TONE[product.stage]}
              icon={<CheckCircle2 size={12} aria-hidden="true" />}
              label={product.stage[0].toUpperCase() + product.stage.slice(1)}
            />
          </div>
          {product.description ? (
            <SheetDescription>{product.description}</SheetDescription>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Link href={`/p/${product.slug}`}>
              <Button variant="primary" size="sm">
                View as page
                <ArrowRight size={12} aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </SheetHeader>

        <SheetBody>
          <div className="space-y-5">
            <section>
              <Eyebrow className="mb-2">Roadmap</Eyebrow>
              <div className="space-y-3">
                {BUCKETS.map((bucket) => (
                  <Card key={bucket}>
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
                      {bucket}
                    </div>
                    {initiativesByBucket[bucket].length === 0 ? (
                      <p className="text-[13px] text-[var(--color-muted)]">
                        Nothing here yet.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {initiativesByBucket[bucket].map((i) => (
                          <Chip
                            key={i.id}
                            bucket={bucket}
                            label={i.title}
                            hint={i.description ?? i.title}
                          />
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>

            {product.outboundLinks.length > 0 ? (
              <section>
                <Eyebrow className="mb-2">Outbound links</Eyebrow>
                <ul role="list" className="flex flex-wrap gap-2">
                  {product.outboundLinks.map((link) => (
                    <li key={link.url}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunk)]"
                      >
                        {link.label}
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <Eyebrow className="mb-2">Ownership</Eyebrow>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {team ? (
                  <Card>
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
                      Operational owner
                    </div>
                    <Link
                      href={`/t/${team.slug}`}
                      className="mt-1 block text-[14px] font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {team.name}
                    </Link>
                  </Card>
                ) : null}
                {domain ? (
                  <Card>
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
                      Strategic owner
                    </div>
                    <Link
                      href={`/d/${domain.slug}`}
                      className="mt-1 block text-[14px] font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {domain.name}
                    </Link>
                  </Card>
                ) : null}
              </div>
            </section>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
