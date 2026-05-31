"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
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
import { Eyebrow } from "@/components/ui/eyebrow";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import type {
  Jurisdiction,
  Product,
  ProductDomain,
  ProductStage,
  Team,
} from "@/lib/types";

// Team card that opens as a slide-over Sheet per requirements
// spec §6.2 (modal-as-detail). Mirrors ProductCardModal — preserves
// the parent page underneath; "View as page" affordance routes to
// /t/<slug>. Focus is trapped while open and restored on close by
// Radix Dialog.

const STAGE_TONE: Record<ProductStage, "blue" | "amber" | "purple" | "green" | "grey"> = {
  discovery: "blue",
  alpha: "amber",
  beta: "purple",
  live: "green",
  retiring: "grey",
  retired: "grey",
};

function ContactLink({ value }: { value: string }) {
  const isEmail = value.includes("@") && !value.startsWith("#");
  if (isEmail) {
    return (
      <a
        href={`mailto:${value}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-ink-soft)] hover:underline"
      >
        <Mail size={14} aria-hidden="true" />
        {value}
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-ink-soft)]">
      {value}
    </span>
  );
}

export function TeamCardModal({
  team,
  domain,
  jurisdiction,
  products,
  trigger,
}: {
  team: Team;
  domain?: ProductDomain;
  jurisdiction?: Jurisdiction;
  products: Product[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <Eyebrow>
            {jurisdiction?.name ?? "DTS"} · {domain?.name ?? "Team"} · Team
          </Eyebrow>
          <SheetTitle>{team.name}</SheetTitle>
          {team.description ? (
            <SheetDescription>{team.description}</SheetDescription>
          ) : null}
          {team.contact ? (
            <div className="mt-1">
              <ContactLink value={team.contact} />
            </div>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Link href={`/t/${team.slug}`}>
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
              <Eyebrow className="mb-2">Products operated</Eyebrow>
              {products.length === 0 ? (
                <Card>
                  <p className="text-[13px] text-[var(--color-muted)]">
                    This Team is not yet operating any Products.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {products.map((p) => (
                    <Card key={p.slug}>
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={`/p/${p.slug}`}
                          className="text-[14px] font-medium text-[var(--color-ink)] hover:underline"
                        >
                          {p.name}
                        </Link>
                        <StatusPill
                          tone={STAGE_TONE[p.stage]}
                          icon={<CheckCircle2 size={12} aria-hidden="true" />}
                          label={p.stage[0].toUpperCase() + p.stage.slice(1)}
                        />
                      </div>
                      {p.description ? (
                        <p className="mt-1.5 line-clamp-3 text-[13px] text-[var(--color-muted)]">
                          {p.description}
                        </p>
                      ) : null}
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <Eyebrow className="mb-2">Latest activity</Eyebrow>
              <Card>
                <p className="text-[13px] text-[var(--color-muted)]">
                  Pulls from the audit log once the markdown lifecycle is live —
                  wired in Phase 2, Task 2.12.
                </p>
              </Card>
            </section>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
