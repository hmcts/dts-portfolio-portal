import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { ProductCardModal } from "@/components/product-card-modal";
import { TeamCardModal } from "@/components/team-card-modal";
import { getServerApiClient } from "@/lib/api-client-server";
import { ApiError } from "@/lib/api-client";
import type {
  Initiative,
  Jurisdiction,
  Product,
  ProductDomain,
  ProductStage,
  Team,
} from "@/lib/entities";

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

// --- API response shapes (snake_case from the Python backend) ---

interface ApiDomain {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  jurisdiction_id: string;
}

interface ApiJurisdictionSlim {
  slug: string;
  name: string;
  count: number;
  domains: { slug: string; name: string }[];
}

interface ApiTeam {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  contact?: string | null;
  domain_id: string;
}

interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  stage: ProductStage;
  domain_id: string;
  operating_team_id: string;
}

interface ApiInitiative {
  id: string;
  product_id: string;
  bucket: "NOW" | "NEXT" | "LATER";
  title: string;
  description?: string | null;
  outbound_url?: string | null;
}

// --- Mappers ---

function mapDomain(d: ApiDomain, jurisdictionSlug: string): ProductDomain {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    ...(d.description ? { description: d.description } : {}),
    // Strategic themes are not returned by the backend domain endpoint;
    // they will be included once the backend extends its response model.
    strategicThemes: [],
    jurisdictionSlug: jurisdictionSlug as ProductDomain["jurisdictionSlug"],
  };
}

function mapTeam(t: ApiTeam, domainSlug: string): Team {
  const team: Team = {
    id: t.id,
    slug: t.slug,
    name: t.name,
    domainSlug,
  };
  if (t.description) team.description = t.description;
  if (t.contact) team.contact = t.contact;
  return team;
}

function mapProduct(
  p: ApiProduct,
  domainSlug: string,
  teamSlugById: Map<string, string>,
): Product {
  const out: Product = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    stage: p.stage,
    domainSlug,
    operatingTeamSlug: teamSlugById.get(p.operating_team_id) ?? "",
    consumedBy: [],
    outboundLinks: [],
  };
  if (p.description) out.description = p.description;
  return out;
}

function mapInitiative(i: ApiInitiative): Initiative {
  const initiative: Initiative = {
    id: i.id,
    productId: i.product_id,
    bucket: i.bucket,
    title: i.title,
  };
  if (i.description) initiative.description = i.description;
  if (i.outbound_url) initiative.outboundUrl = i.outbound_url;
  return initiative;
}

export default async function DomainPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = await getServerApiClient();

  let apiDomain: ApiDomain;
  try {
    apiDomain = await api.get<ApiDomain>(`/api/domains/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Resolve the jurisdiction slug: get all jurisdictions from the sidebar,
  // find the one whose domains list contains our slug.
  const [sidebarJurisdictions, teams, products] = await Promise.all([
    api.get<ApiJurisdictionSlim[]>("/api/sidebar/jurisdictions"),
    api.get<ApiTeam[]>(`/api/domains/${slug}/teams`),
    api.get<ApiProduct[]>(`/api/domains/${slug}/products`),
  ]);

  const jurisdictionSlim = sidebarJurisdictions.find((j) =>
    j.domains.some((d) => d.slug === slug),
  );
  const jurisdictionSlug = (jurisdictionSlim?.slug ??
    "") as ProductDomain["jurisdictionSlug"];

  const jurisdiction: Jurisdiction | undefined = jurisdictionSlim
    ? {
        slug: jurisdictionSlug,
        name: jurisdictionSlim.name,
      }
    : undefined;

  const domain = mapDomain(apiDomain, jurisdictionSlug);
  const teamSlugById = new Map(teams.map((t) => [t.id, t.slug]));
  const mappedTeams = teams.map((t) => mapTeam(t, slug));
  const mappedProducts = products.map((p) =>
    mapProduct(p, slug, teamSlugById),
  );

  // Fetch initiatives per product in parallel, keyed by product id.
  const initiativesByProductId = new Map<string, Initiative[]>(
    await Promise.all(
      products.map(async (p) => {
        const raw = await api.get<ApiInitiative[]>(
          `/api/products/${p.slug}/initiatives`,
        );
        return [p.id, raw.map(mapInitiative)] as const;
      }),
    ),
  );

  return (
    <div className="mx-auto max-w-[1480px]">
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
        heading={`${mappedTeams.length} ${mappedTeams.length === 1 ? "Team" : "Teams"} in ${domain.name}`}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mappedTeams.map((t) => {
            const productsForT = mappedProducts.filter(
              (p) => p.operatingTeamSlug === t.slug,
            );
            return (
              <TeamCardModal
                key={t.slug}
                team={t}
                domain={domain}
                jurisdiction={jurisdiction}
                products={productsForT}
                trigger={
                  <button
                    type="button"
                    className="group block text-left"
                    aria-label={`Open ${t.name} details`}
                  >
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
                        {productsForT.length}{" "}
                        {productsForT.length === 1 ? "Product" : "Products"}{" "}
                        operated
                      </div>
                    </Card>
                  </button>
                }
              />
            );
          })}
        </div>
      </Section>

      <Section
        eyebrow="Products"
        heading={`${mappedProducts.length} ${mappedProducts.length === 1 ? "Product" : "Products"} in ${domain.name}`}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mappedProducts.map((p) => {
            const team = mappedTeams.find((t) => t.slug === p.operatingTeamSlug);
            const initiatives = initiativesByProductId.get(p.id) ?? [];
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
                          label={
                            p.stage[0].toUpperCase() + p.stage.slice(1)
                          }
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
