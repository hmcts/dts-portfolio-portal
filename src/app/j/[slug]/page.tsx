import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { RoadmapMatrix } from "@/components/roadmap-matrix";
import {
  getDomainsByJurisdiction,
  getJurisdictionBySlug,
  getMatrix,
  getProductsConsumedBy,
  getProductsForDomain,
  getTeamsForDomain,
} from "@/lib/portal-data";

// Jurisdiction page per requirements spec §5.3. Header + this-
// jurisdiction-only roadmap matrix + Domains card grid + consumed-by
// Products card grid.

export default async function JurisdictionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jurisdiction = getJurisdictionBySlug(slug);
  if (!jurisdiction) {
    notFound();
  }

  const matrix = getMatrix().filter(
    (band) => band.jurisdiction.slug === jurisdiction.slug,
  );
  const domains = getDomainsByJurisdiction(jurisdiction.slug);
  const consumedHere = getProductsConsumedBy(jurisdiction.slug);

  return (
    <div className="mx-auto max-w-[1100px]">
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
        lede={jurisdiction.description}
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
              const teamCount = getTeamsForDomain(d.slug).length;
              const productCount = getProductsForDomain(d.slug).length;
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
                  <Eyebrow className="mb-1.5">From {p.domainSlug.replace(/-/g, " ")}</Eyebrow>
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
