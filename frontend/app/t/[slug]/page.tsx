import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { getServerApiClient } from "@/lib/api-client-server";
import { ApiError } from "@/lib/api-client";
import type { ProductStage } from "@/lib/types";

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

// --- API response shapes (snake_case from the Python backend) ---

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

interface ApiMatrixDomainInfo {
  id: string;
  slug: string;
  name: string;
}

interface ApiMatrixBand {
  jurisdiction: { id: string; slug: string; name: string };
  rows: Array<{ domain: ApiMatrixDomainInfo }>;
}

interface ApiDomainDetail {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = await getServerApiClient();

  let team: ApiTeam;
  try {
    team = await api.get<ApiTeam>(`/api/teams/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Fetch products and the matrix (used to resolve domain_id → slug) in parallel.
  const [products, matrix] = await Promise.all([
    api.get<ApiProduct[]>(`/api/teams/${slug}/products`),
    api.get<ApiMatrixBand[]>("/api/matrix"),
  ]);

  // Build a map from domain_id → { slug, name, jurisdictionSlug, jurisdictionName }
  // using the matrix response which contains all domains with their IDs.
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

  const domainInfo = domainInfoById.get(team.domain_id);
  const domain = domainInfo
    ? { slug: domainInfo.slug, name: domainInfo.name }
    : undefined;
  const jurisdiction = domainInfo
    ? { slug: domainInfo.jurisdictionSlug, name: domainInfo.jurisdictionName }
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
        lede={team.description ?? undefined}
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
            {products.map((p) => {
              const pDomainInfo = domainInfoById.get(p.domain_id);
              return (
                <Link key={p.slug} href={`/p/${p.slug}`} className="group">
                  <Card className="h-full transition-colors group-hover:border-[var(--color-border-strong)]">
                    <Eyebrow className="mb-1.5">
                      {pDomainInfo?.name ?? p.slug.replace(/-/g, " ")}
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
                  </Card>
                </Link>
              );
            })}
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
