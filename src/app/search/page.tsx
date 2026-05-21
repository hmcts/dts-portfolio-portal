import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { search, searchCounts, type SearchEntityType } from "@/lib/search/search";

// Deep results page per requirements spec §5.7. Shown when the user
// presses Enter on the search input or clicks "See all" in the
// overlay. Carries the LLM answer card (Phase 3 task 3.3 — placeholder
// until the AOAI integration lands) above the ranked matches.
// Entity-type filter chips along the top let the user narrow.

export const dynamic = "force-dynamic";

const ENTITY_LABELS: Record<SearchEntityType, string> = {
  jurisdiction: "Jurisdiction",
  domain: "Domain",
  team: "Team",
  product: "Product",
  initiative: "Initiative",
};

interface SearchPageProps {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
  }>;
}

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseTypes(
  raw: string | undefined,
): SearchEntityType[] | undefined {
  if (!raw) return undefined;
  const valid: SearchEntityType[] = [
    "jurisdiction",
    "domain",
    "team",
    "product",
    "initiative",
  ];
  const parsed = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t): t is SearchEntityType =>
      (valid as ReadonlyArray<string>).includes(t),
    );
  return parsed.length > 0 ? parsed : undefined;
}

export default async function SearchResultsPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = (first(params.q) ?? "").trim();
  const types = parseTypes(first(params.type));

  const [results, counts] = q
    ? await Promise.all([
        search(q, { limit: 50, ...(types ? { types } : {}) }),
        searchCounts(q),
      ])
    : [[], { jurisdiction: 0, domain: 0, team: 0, product: 0, initiative: 0 }];

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Search"
        title={q ? `Results for "${q}"` : "Search the portal"}
        lede={
          q
            ? `${results.length} match${results.length === 1 ? "" : "es"} across the portal. Tighten with the filter chips below, or refine the query.`
            : "Type into the search input above. The instant overlay shows the top hits as you type; pressing Enter brings you here for the full ranked list."
        }
      />

      {q ? (
        <Section
          eyebrow="Answer"
          heading="Best single-sentence answer"
        >
          <Card>
            <p className="text-[var(--color-muted)]">
              The LLM answer card (Phase 3 task 3.3) lands when Azure OpenAI
              is wired up. Until then the ranked list below is the source of truth.
            </p>
          </Card>
        </Section>
      ) : null}

      {q ? (
        <Section
          eyebrow="Filter"
          heading="By entity type"
          actions={
            <>
              <FilterChip q={q} type={undefined} label="All" count={results.length} active={!types} />
              {(Object.entries(counts) as [SearchEntityType, number][])
                .filter(([, n]) => n > 0)
                .map(([t, n]) => (
                  <FilterChip
                    key={t}
                    q={q}
                    type={t}
                    label={ENTITY_LABELS[t]}
                    count={n}
                    active={types?.includes(t) ?? false}
                  />
                ))}
            </>
          }
        >
          {results.length === 0 ? (
            <Card>
              <p className="text-[var(--color-muted)]">
                No matches. Try a name, a Domain, or "who owns Common Platform?".
              </p>
            </Card>
          ) : (
            <Card padding={false}>
              <ul role="list" className="divide-y divide-[var(--color-border)]">
                {results.map((r) => {
                  const inner = (
                    <div className="block px-5 py-4">
                      <Eyebrow className="mb-0.5">
                        {ENTITY_LABELS[r.entityType]}
                      </Eyebrow>
                      <div className="text-[15px] font-medium text-[var(--color-ink)]">
                        {r.name}
                      </div>
                      {r.description ? (
                        <p className="mt-0.5 line-clamp-2 text-[13px] text-[var(--color-muted)]">
                          {r.description}
                        </p>
                      ) : null}
                    </div>
                  );
                  return (
                    <li key={`${r.entityType}-${r.id}`}>
                      {r.href ? (
                        <Link
                          href={r.href}
                          className="block hover:bg-[var(--color-surface-sunk)]"
                        >
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </Section>
      ) : null}
    </div>
  );
}

function FilterChip({
  q,
  type,
  label,
  count,
  active,
}: {
  q: string;
  type: SearchEntityType | undefined;
  label: string;
  count: number;
  active: boolean;
}) {
  const href = `/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ""}`;
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-[var(--radius-pill)] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-1 text-[13px] text-[var(--color-surface)]"
          : "rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[13px] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunk)]"
      }
    >
      {label}{" "}
      <span className={active ? "text-[var(--color-surface)] opacity-80" : "text-[var(--color-muted)]"}>
        {count}
      </span>
    </Link>
  );
}
