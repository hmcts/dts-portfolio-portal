import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { RoadmapMatrix } from "@/components/roadmap-matrix";
import { getServerApiClient } from "@/lib/api-client-server";
import { ApiError } from "@/lib/api-client";
import type { MatrixJurisdictionBand } from "@/lib/types";

// Jurisdiction page per requirements spec §5.3. Header + this-
// jurisdiction-only roadmap matrix + Domains card grid + consumed-by
// Products card grid.

// --- API response shapes (snake_case from the Python backend) ---

interface ApiJurisdiction {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
}

interface ApiProductDomain {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  jurisdiction_id: string;
}

interface ApiConsumedProduct {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  stage: string;
  domain_slug: string;
  domain_name: string;
}

interface ApiTeam {
  id: string;
  slug: string;
  name: string;
}

interface ApiMatrixInitiative {
  id: string;
  product_id: string;
  product_name: string;
  product_href: string;
  bucket: string;
  title: string;
  description?: string | null;
  outbound_url?: string | null;
}

interface ApiMatrixDomainRow {
  domain: ApiProductDomain;
  product_count: number;
  cells: Record<string, ApiMatrixInitiative[]>;
}

interface ApiMatrixBand {
  jurisdiction: ApiJurisdiction;
  domain_count: number;
  initiative_count: number;
  rows: ApiMatrixDomainRow[];
}

// --- Mapper ---

function mapMatrixBand(b: ApiMatrixBand): MatrixJurisdictionBand {
  return {
    jurisdiction: {
      slug: b.jurisdiction.slug as MatrixJurisdictionBand["jurisdiction"]["slug"],
      name: b.jurisdiction.name,
      ...(b.jurisdiction.description
        ? { description: b.jurisdiction.description }
        : {}),
    },
    domainCount: b.domain_count,
    initiativeCount: b.initiative_count,
    rows: b.rows.map((r) => ({
      domain: {
        id: r.domain.id,
        slug: r.domain.slug,
        name: r.domain.name,
        ...(r.domain.description ? { description: r.domain.description } : {}),
        jurisdictionSlug:
          b.jurisdiction.slug as MatrixJurisdictionBand["jurisdiction"]["slug"],
        strategicThemes: [],
      },
      productCount: r.product_count,
      cells: {
        NOW: (r.cells["NOW"] ?? []).map((i) => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          productHref: i.product_href,
          bucket: i.bucket as "NOW" | "NEXT" | "LATER",
          title: i.title,
          ...(i.description ? { description: i.description } : {}),
          ...(i.outbound_url ? { outboundUrl: i.outbound_url } : {}),
        })),
        NEXT: (r.cells["NEXT"] ?? []).map((i) => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          productHref: i.product_href,
          bucket: i.bucket as "NOW" | "NEXT" | "LATER",
          title: i.title,
          ...(i.description ? { description: i.description } : {}),
          ...(i.outbound_url ? { outboundUrl: i.outbound_url } : {}),
        })),
        LATER: (r.cells["LATER"] ?? []).map((i) => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          productHref: i.product_href,
          bucket: i.bucket as "NOW" | "NEXT" | "LATER",
          title: i.title,
          ...(i.description ? { description: i.description } : {}),
          ...(i.outbound_url ? { outboundUrl: i.outbound_url } : {}),
        })),
      },
    })),
  };
}

export default async function JurisdictionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = await getServerApiClient();

  let jurisdiction: ApiJurisdiction;
  try {
    jurisdiction = await api.get<ApiJurisdiction>(`/api/jurisdictions/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [rawMatrix, domains, consumedHere] = await Promise.all([
    api.get<ApiMatrixBand[]>("/api/matrix"),
    api.get<ApiProductDomain[]>(`/api/jurisdictions/${slug}/domains`),
    api.get<ApiConsumedProduct[]>(`/api/jurisdictions/${slug}/consumed-products`),
  ]);

  const rawBand = rawMatrix.find((b) => b.jurisdiction.slug === jurisdiction.slug);
  const matrix = rawBand ? [mapMatrixBand(rawBand)] : [];

  // Derive productCount per domain from the matrix band rows so we
  // avoid N extra API calls. Team counts still need per-domain calls.
  const productCountByDomainSlug = new Map<string, number>(
    rawBand?.rows.map((r) => [r.domain.slug, r.product_count]) ?? [],
  );

  // Fetch team counts per domain in parallel.
  const domainTeamCounts = await Promise.all(
    domains.map(async (d) => {
      const teams = await api.get<ApiTeam[]>(`/api/domains/${d.slug}/teams`);
      return { slug: d.slug, teamCount: teams.length };
    }),
  );
  const teamCountByDomainSlug = new Map(
    domainTeamCounts.map((s) => [s.slug, s.teamCount]),
  );

  return (
    <div className="mx-auto max-w-[1480px]">
      <Breadcrumbs
        items={[
          { label: "Jurisdictions" },
          { label: jurisdiction.name },
        ]}
        className="mb-4"
      />
      <PageHeader
        eyebrow="Jurisdiction"
        title={jurisdiction.name}
        lede={jurisdiction.description ?? undefined}
      />

      <Section
        eyebrow="Domain roadmap"
        heading={`Now, next, later — across ${jurisdiction.name}`}
      >
        <RoadmapMatrix bands={matrix} />
      </Section>

      <Section eyebrow="Domains" heading={`${domains.length} ${domains.length === 1 ? "Domain" : "Domains"} in ${jurisdiction.name}`}>
        {domains.length === 0 ? (
          <Card>
            <p className="text-[var(--color-muted)]">
              No Domains added to this Jurisdiction yet.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {domains.map((d) => {
              const teamCount = teamCountByDomainSlug.get(d.slug) ?? 0;
              const productCount = productCountByDomainSlug.get(d.slug) ?? 0;
              return (
                <Link key={d.slug} href={`/d/${d.slug}`} className="group">
                  <Card className="h-full transition-colors group-hover:border-[var(--color-border-strong)]">
                    <div className="text-[15px] font-medium text-[var(--color-ink)]">
                      {d.name}
                    </div>
                    {d.description ? (
                      <p className="mt-1.5 line-clamp-3 text-[13px] text-[var(--color-muted)]">
                        {d.description}
                      </p>
                    ) : null}
                    <div className="mt-3 text-[12px] text-[var(--color-muted)]">
                      {teamCount} {teamCount === 1 ? "Team" : "Teams"} ·{" "}
                      {productCount} {productCount === 1 ? "Product" : "Products"}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {consumedHere.length > 0 ? (
        <Section
          eyebrow="Consumed from elsewhere"
          heading={`Products used by ${jurisdiction.name}`}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {consumedHere.map((p) => (
              <Link key={p.slug} href={`/p/${p.slug}`} className="group">
                <Card className="h-full transition-colors group-hover:border-[var(--color-border-strong)]">
                  <Eyebrow className="mb-1.5">From {p.domain_name}</Eyebrow>
                  <div className="text-[15px] font-medium text-[var(--color-ink)]">
                    {p.name}
                  </div>
                  {p.description ? (
                    <p className="mt-1.5 line-clamp-2 text-[13px] text-[var(--color-muted)]">
                      {p.description}
                    </p>
                  ) : null}
                </Card>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
