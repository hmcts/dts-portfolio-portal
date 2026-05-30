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
import { getServerApiClient } from "@/lib/api-client-server";
import { ApiError } from "@/lib/api-client";
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

// --- API response shapes (snake_case from the Python backend) ---

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
  bucket: TimeBucket;
  title: string;
  description?: string | null;
  outbound_url?: string | null;
}

interface ApiMatrixBand {
  jurisdiction: { id: string; slug: string; name: string };
  rows: Array<{
    domain: { id: string; slug: string; name: string };
  }>;
}

interface ApiTeam {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  contact?: string | null;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = await getServerApiClient();

  let product: ApiProduct;
  try {
    product = await api.get<ApiProduct>(`/api/products/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Fetch initiatives and the matrix (for ID→slug resolution) in parallel.
  const [initiatives, matrix] = await Promise.all([
    api.get<ApiInitiative[]>(`/api/products/${slug}/initiatives`),
    api.get<ApiMatrixBand[]>("/api/matrix"),
  ]);

  // Build ID-to-info maps from the matrix.
  const domainInfoById = new Map<
    string,
    { slug: string; name: string; jurisdictionSlug: string; jurisdictionName: string }
  >();
  for (const band of matrix) {
    for (const row of band.rows) {
      domainInfoById.set(row.domain.id, {
        slug: row.domain.slug,
        name: row.domain.name,
        jurisdictionSlug: band.jurisdiction.slug,
        jurisdictionName: band.jurisdiction.name,
      });
    }
  }

  const domainInfo = domainInfoById.get(product.domain_id);
  const domain = domainInfo
    ? { slug: domainInfo.slug, name: domainInfo.name }
    : undefined;
  const jurisdiction = domainInfo
    ? { slug: domainInfo.jurisdictionSlug, name: domainInfo.jurisdictionName }
    : undefined;

  // Fetch the operating team using the domain's team list.
  let team: ApiTeam | undefined;
  if (domainInfo) {
    const domainTeams = await api.get<ApiTeam[]>(
      `/api/domains/${domainInfo.slug}/teams`,
    );
    team = domainTeams.find((t) => t.id === product.operating_team_id);
  }

  // Group initiatives by bucket.
  const initiativesByBucket: Record<TimeBucket, ApiInitiative[]> = {
    NOW: initiatives.filter((i) => i.bucket === "NOW"),
    NEXT: initiatives.filter((i) => i.bucket === "NEXT"),
    LATER: initiatives.filter((i) => i.bucket === "LATER"),
  };

  // consumedBy and outboundLinks are not returned by the current backend
  // product endpoint (they require join-table resolution not yet exposed).
  // Both sections gracefully render nothing when the arrays are empty.
  const consumedBy: string[] = [];
  const outboundLinks: { label: string; url: string }[] = [];

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
          { label: product.name },
        ]}
        className="mb-4"
      />
      <PageHeader
        eyebrow={`${jurisdiction?.name ?? "DTS"} · ${domain?.name ?? "Product"} · Product`}
        title={product.name}
        lede={product.description ?? undefined}
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

      {outboundLinks.length > 0 ? (
        <Section eyebrow="Outbound links" heading="Source-system links">
          <Card>
            <ul role="list" className="flex flex-wrap gap-2">
              {outboundLinks.map((link) => (
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
              </Card>
            </Link>
          ) : null}
        </div>
      </Section>

      {consumedBy.length > 0 ? (
        <Section
          eyebrow="Consumed by"
          heading={`Used by ${consumedBy.length} other ${consumedBy.length === 1 ? "Jurisdiction" : "Jurisdictions"}`}
        >
          <Card>
            <ul role="list" className="flex flex-wrap gap-2">
              {consumedBy.map((jSlug) => (
                <li key={jSlug}>
                  <Link
                    href={`/j/${jSlug}`}
                    className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunk)]"
                  >
                    {jSlug}
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
