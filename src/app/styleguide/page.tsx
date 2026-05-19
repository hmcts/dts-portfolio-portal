import {
  Users,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";

// Visual reference page. Renders every primitive in isolation so
// designers and engineers can compare what we built to the prototype
// at docs/prototype/. Not linked from the main nav — accessible via
// /styleguide URL.

export default function Styleguide() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Phase 1 — Visual reference"
        title="Primitives"
        lede="Every component shown in isolation. Compare against docs/prototype/rendered.png to spot drift."
      />

      <Section eyebrow="Type" heading="Type scale">
        <Card>
          <div className="space-y-4">
            <div>
              <Eyebrow>Eyebrow · 11px uppercase tracked</Eyebrow>
              <h1 className="text-[36px] font-semibold leading-[1.1] tracking-[-0.02em]">
                Page title — 36px tight
              </h1>
              <p className="mt-3 text-[18px] text-[var(--color-ink-soft)] max-w-[64ch]">
                Lede — 18px on ink-soft, max 64ch. Reads like a single sentence
                at the top of a route.
              </p>
            </div>
            <div className="border-t border-[var(--color-border)] pt-4">
              <h2 className="text-[22px] font-semibold tracking-[-0.01em]">
                Section heading — H2 22px
              </h2>
              <p className="mt-2 text-[15px] text-[var(--color-ink-soft)]">
                Body — 15px on ink-soft.
              </p>
              <p className="text-[13px] text-[var(--color-muted)]">
                Meta — 13px muted. (muted-2 token exists for borders /
                decoration only — fails AA for body text.)
              </p>
            </div>
          </div>
        </Card>
      </Section>

      <Section eyebrow="Buttons" heading="Button variants">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline">
              <Users size={14} aria-hidden="true" />
              Outline default
            </Button>
            <Button variant="primary">
              <Plus size={14} aria-hidden="true" />
              Primary
            </Button>
            <Button variant="ghost">
              Ghost
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm">
              Small outline
            </Button>
            <Button variant="primary" size="sm">
              Small primary
            </Button>
          </div>
        </Card>
      </Section>

      <Section eyebrow="Initiative chips" heading="NOW / NEXT / LATER">
        <Card>
          <div className="space-y-4">
            <div>
              <Eyebrow className="mb-2">NOW · in flight</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <Chip bucket="NOW" label="Sample workstream — auth flow migration" />
                <Chip bucket="NOW" label="Sign-in latency reduction" />
                <Chip bucket="NOW" label="Schema v2 rollout" />
              </div>
            </div>
            <div>
              <Eyebrow className="mb-2">NEXT · committed</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <Chip bucket="NEXT" label="Passkeys pilot — internal users" />
                <Chip bucket="NEXT" label="Tenant self-service" />
                <Chip bucket="NEXT" label="Bulk-record API" />
              </div>
            </div>
            <div>
              <Eyebrow className="mb-2">LATER · acknowledged</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <Chip bucket="LATER" label="Retire legacy identity brokers" />
                <Chip bucket="LATER" label="Event-sourcing re-platform" />
              </div>
            </div>
          </div>
        </Card>
      </Section>

      <Section eyebrow="Status pills" heading="Product stage + AI confidence">
        <Card>
          <div className="space-y-3">
            <div>
              <Eyebrow className="mb-2">Product stage</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <StatusPill
                  tone="blue"
                  icon={<CheckCircle2 size={12} />}
                  label="Discovery"
                />
                <StatusPill tone="amber" icon={<CheckCircle2 size={12} />} label="Alpha" />
                <StatusPill tone="purple" icon={<CheckCircle2 size={12} />} label="Beta" />
                <StatusPill tone="green" icon={<CheckCircle2 size={12} />} label="Live" />
                <StatusPill tone="grey" icon={<XCircle size={12} />} label="Retired" />
              </div>
            </div>
            <div>
              <Eyebrow className="mb-2">AI parse confidence</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="green" icon={<CheckCircle2 size={12} />} label="High confidence" />
                <StatusPill tone="amber" icon={<AlertTriangle size={12} />} label="Medium" />
                <StatusPill tone="red" icon={<AlertTriangle size={12} />} label="Low" />
              </div>
            </div>
          </div>
        </Card>
      </Section>

      <Section eyebrow="Cards" heading="Card surfaces">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <Eyebrow className="mb-2">Crime · Court Hearings</Eyebrow>
            <div className="text-[15px] font-medium">Common Platform</div>
            <p className="mt-1 text-[13px] text-[var(--color-muted)]">
              The unified case-management platform used across Crime Crown,
              Magistrates and Youth.
            </p>
            <div className="mt-3">
              <StatusPill tone="green" icon={<CheckCircle2 size={12} />} label="Live" />
            </div>
          </Card>
          <Card>
            <Eyebrow className="mb-2">Crime · Hearings Service</Eyebrow>
            <div className="text-[15px] font-medium">Hearings Management</div>
            <p className="mt-1 text-[13px] text-[var(--color-muted)]">
              Scheduling, listing and remote-attendance workflows for Crown
              Court hearings.
            </p>
            <div className="mt-3">
              <StatusPill tone="purple" icon={<CheckCircle2 size={12} />} label="Beta" />
            </div>
          </Card>
          <Card>
            <Eyebrow className="mb-2">Crime · Resulting</Eyebrow>
            <div className="text-[15px] font-medium">Resulting Assistant</div>
            <p className="mt-1 text-[13px] text-[var(--color-muted)]">
              Court clerks capture outcomes; the AI assists with sentence-type
              templating.
            </p>
            <div className="mt-3">
              <StatusPill tone="blue" icon={<CheckCircle2 size={12} />} label="Discovery" />
            </div>
          </Card>
        </div>
      </Section>
    </div>
  );
}
