import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import {
  getDomainBySlug,
  getInitiativesForProduct,
  getJurisdictionBySlug,
  getProductBySlug,
  getTeamBySlug,
} from "@/lib/portal-data";
import type { ProductStage, TimeBucket } from "@/lib/entities";

// Product page per requirements spec §5.6. Header + description +
// NOW/NEXT/LATER roadmap + outbound-links block + Operating Team card
// + Strategic Domain card + Consumed-by list.

const STAGE_TONE: Record<ProductStage, "blue" | "amber" | "purple" | "green" | "grey"> = {
  discovery: "blue",
  alpha: "amber",
  beta: "purple",
  live: "green",
  retiring: "grey",
  retired: "grey",
};

const BUCKETS: TimeBucket[] = ["NOW", "NEXT", "LATER"];

const BUCKET_LABELS: Record<TimeBucket, string> = {
  NOW: "In flight",
  NEXT: "Committed for the upcoming horizon",
  LATER: "Acknowledged but unscheduled",
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    notFound();
  }
  const [domain, team, initiatives] = await Promise.all([
    getDomainBySlug(product.domainSlug),
    getTeamBySlug(product.operatingTeamSlug),
    getInitiativesForProduct(product.id),
  ]);
  const jurisdiction = domain
    ? await getJurisdictionBySlug(domain.jurisdictionSlug)
    : undefined;
  // Resolve the "consumed by" jurisdictions up-front so the JSX
  // iteration below stays synchronous.
  const consumedByJurisdictions = (
    await Promise.all(
      product.consumedBy.map(async (s) => await getJurisdictionBySlug(s)),
    )
  ).filter((j): j is NonNullable<typeof j> => j !== undefined);
  const initiativesByBucket: Record<TimeBucket, typeof initiatives> = {
    NOW: initiatives.filter((i) => i.bucket === "NOW"),
    NEXT: initiatives.filter((i) => i.bucket === "NEXT"),
    LATER: initiatives.filter((i) => i.bucket === "LATER"),
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <Breadcrumbs
        items={[
          { label: "Jurisdictions" },
          ...(jurisdiction
            ? [{ label: jurisdiction.name, href: `/j/${jurisdiction.slug}` }]
            : []),
          ...(domain
            ? [{ label: domain.name, href: `/d/${domain.slug}` }]
            : []),
          { label: product.name },
        ]}
        className="mb-4"
      />
      <PageHeader
        eyebrow={`${jurisdiction?.name ?? "DTS"} · ${domain?.name ?? "Product"} · Product`}
        title={product.name}
        lede={product.description}
        actions={
          <StatusPill
            tone={STAGE_TONE[product.stage]}
            icon={<CheckCircle2 size={12} aria-hidden="true" />}
            label={product.stage[0].toUpperCase() + product.stage.slice(1)}
          />
        }
      />

      <Section eyebrow="Roadmap" heading="What's now, next, and later">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {BUCKETS.map((bucket) => (
            <Card key={bucket}>
              <Eyebrow className="mb-2">
                {bucket} · {BUCKET_LABELS[bucket]}
              </Eyebrow>
              {initiativesByBucket[bucket].length === 0 ? (
                <p className="text-[13px] text-[var(--color-muted)]">
                  Nothing in this bucket yet.
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
      </Section>

      {product.outboundLinks.length > 0 ? (
        <Section eyebrow="Outbound links" heading="Source-system links">
          <Card>
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
          </Card>
        </Section>
      ) : null}

      <Section eyebrow="Ownership" heading="Who runs this Product">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {team ? (
            <Link href={`/t/${team.slug}`} className="group">
              <Card className="h-full transition-colors group-hover:border-[var(--color-border-strong)]">
                <Eyebrow className="mb-1.5">Operational owner</Eyebrow>
                <div className="text-[15px] font-medium text-[var(--color-ink)]">
                  {team.name}
                </div>
                {team.description ? (
                  <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
                    {team.description}
                  </p>
                ) : null}
              </Card>
            </Link>
          ) : null}
          {domain ? (
            <Link href={`/d/${domain.slug}`} className="group">
              <Card className="h-full transition-colors group-hover:border-[var(--color-border-strong)]">
                <Eyebrow className="mb-1.5">Strategic owner</Eyebrow>
                <div className="text-[15px] font-medium text-[var(--color-ink)]">
                  {domain.name}
                </div>
                {domain.description ? (
                  <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
                    {domain.description}
                  </p>
                ) : null}
              </Card>
            </Link>
          ) : null}
        </div>
      </Section>

      {product.consumedBy.length > 0 ? (
        <Section
          eyebrow="Consumed by"
          heading={`Used by ${product.consumedBy.length} other ${product.consumedBy.length === 1 ? "Jurisdiction" : "Jurisdictions"}`}
        >
          <Card>
            <ul role="list" className="flex flex-wrap gap-2">
              {consumedByJurisdictions.map((j) => (
                <li key={j.slug}>
                  <Link
                    href={`/j/${j.slug}`}
                    className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunk)]"
                  >
                    {j.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}
