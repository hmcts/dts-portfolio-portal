import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import {
  getDomainBySlug,
  getJurisdictionBySlug,
  getProductsForTeam,
  getTeamBySlug,
} from "@/lib/portal-data";
import type { ProductStage } from "@/lib/entities";

// Team page per requirements spec §5.5. Header + breadcrumb + About
// block + Products operated + (Phase 2) latest activity from audit
// log. Activity stub for now; wires up in Task 2.12.

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
  const href = isEmail ? `mailto:${value}` : undefined;
  if (href) {
    return (
      <a
        href={href}
        className="inline-flex items-center gap-1.5 text-[var(--color-ink-soft)] hover:underline"
      >
        <Mail size={14} aria-hidden="true" />
        {value}
      </a>
    );
  }
  return (
    <span className="text-[var(--color-ink-soft)]">{value}</span>
  );
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) {
    notFound();
  }
  const [domain, products] = await Promise.all([
    getDomainBySlug(team.domainSlug),
    getProductsForTeam(team.slug),
  ]);
  const jurisdiction = domain
    ? await getJurisdictionBySlug(domain.jurisdictionSlug)
    : undefined;

  return (
    <div className="mx-auto max-w-[1480px]">
      <Breadcrumbs
        items={[
          { label: "Jurisdictions" },
          ...(jurisdiction
            ? [{ label: jurisdiction.name, href: `/j/${jurisdiction.slug}` }]
            : []),
          ...(domain
            ? [{ label: domain.name, href: `/d/${domain.slug}` }]
            : []),
          { label: team.name },
        ]}
        className="mb-4"
      />
      <PageHeader
        eyebrow={`${jurisdiction?.name ?? "DTS"} · ${domain?.name ?? "Team"} · Team`}
        title={team.name}
        lede={team.description}
        actions={
          team.contact ? <ContactLink value={team.contact} /> : undefined
        }
      />

      <Section
        eyebrow="Products"
        heading={`${products.length} ${products.length === 1 ? "Product" : "Products"} ${team.name} operates`}
      >
        {products.length === 0 ? (
          <Card>
            <p className="text-[var(--color-muted)]">
              This Team is not yet operating any Products.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link key={p.slug} href={`/p/${p.slug}`} className="group">
                <Card className="h-full transition-colors group-hover:border-[var(--color-border-strong)]">
                  <Eyebrow className="mb-1.5">{p.domainSlug.replace(/-/g, " ")}</Eyebrow>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[15px] font-medium text-[var(--color-ink)]">
                      {p.name}
                    </div>
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
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section
        eyebrow="Latest activity"
        heading={`What ${team.name} has changed recently`}
      >
        <Card>
          <p className="text-[var(--color-muted)]">
            Pulls from the audit log once the markdown lifecycle is live —
            wired in Phase 2, Task 2.12.
          </p>
        </Card>
      </Section>
    </div>
  );
}
