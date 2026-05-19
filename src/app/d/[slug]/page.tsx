import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { ProductCardModal } from "@/components/product-card-modal";
import {
  getDomainBySlug,
  getInitiativesForProduct,
  getJurisdictionBySlug,
  getProductsForDomain,
  getTeamsForDomain,
} from "@/lib/portal-data";
import type { ProductStage } from "@/lib/entities";

// Product Domain page per requirements spec §5.4. Header + strategic
// themes + Teams card grid + Products card grid. Filter strip is a
// placeholder until 1.15's interactivity lands.

const STAGE_TONE: Record<ProductStage, "blue" | "amber" | "purple" | "green" | "grey"> = {
  discovery: "blue",
  alpha: "amber",
  beta: "purple",
  live: "green",
  retiring: "grey",
  retired: "grey",
};

export default async function DomainPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const domain = getDomainBySlug(slug);
  if (!domain) {
    notFound();
  }
  const jurisdiction = getJurisdictionBySlug(domain.jurisdictionSlug);
  const teams = getTeamsForDomain(domain.slug);
  const products = getProductsForDomain(domain.slug);

  return (
    <div className="mx-auto max-w-[1100px]">
      <Breadcrumbs
        items={[
          { label: "Jurisdictions" },
          { label: jurisdiction!.name, href: `/j/${jurisdiction!.slug}` },
          { label: domain.name },
        ]}
        className="mb-4"
      />
      <PageHeader
        eyebrow={`${jurisdiction!.name} · Product Domain`}
        title={domain.name}
        lede={domain.description}
      />

      {domain.strategicThemes && domain.strategicThemes.length > 0 ? (
        <Section
          eyebrow="Strategic direction"
          heading={`What ${domain.name} is steering towards`}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {domain.strategicThemes.map((theme, idx) => (
              <Card key={`${theme.title}-${idx}`}>
                <div className="text-[15px] font-medium text-[var(--color-ink)]">
                  {theme.title}
                </div>
                {theme.description ? (
                  <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
                    {theme.description}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        eyebrow="Teams"
        heading={`${teams.length} ${teams.length === 1 ? "Team" : "Teams"} in ${domain.name}`}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const productsForT = products.filter((p) => p.operatingTeamSlug === t.slug);
            return (
              <Link key={t.slug} href={`/t/${t.slug}`} className="group">
                <Card className="h-full transition-colors group-hover:border-[var(--color-border-strong)]">
                  <div className="text-[15px] font-medium text-[var(--color-ink)]">
                    {t.name}
                  </div>
                  {t.description ? (
                    <p className="mt-1.5 line-clamp-3 text-[13px] text-[var(--color-muted)]">
                      {t.description}
                    </p>
                  ) : null}
                  <div className="mt-3 text-[12px] text-[var(--color-muted)]">
                    {productsForT.length} {productsForT.length === 1 ? "Product" : "Products"} operated
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section
        eyebrow="Products"
        heading={`${products.length} ${products.length === 1 ? "Product" : "Products"} in ${domain.name}`}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const team = teams.find((t) => t.slug === p.operatingTeamSlug);
            const initiatives = getInitiativesForProduct(p.id);
            return (
              <ProductCardModal
                key={p.slug}
                product={p}
                domain={domain}
                team={team}
                initiatives={initiatives}
                trigger={
                  <button
                    type="button"
                    className="group block text-left"
                    aria-label={`Open ${p.name} details`}
                  >
                    <Card className="h-full transition-colors group-hover:border-[var(--color-border-strong)]">
                      <Eyebrow className="mb-1.5">
                        {jurisdiction!.name} · {domain.name}
                      </Eyebrow>
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
                      {team ? (
                        <div className="mt-3 text-[12px] text-[var(--color-muted)]">
                          Operated by {team.name}
                        </div>
                      ) : null}
                    </Card>
                  </button>
                }
              />
            );
          })}
        </div>
      </Section>
    </div>
  );
}
