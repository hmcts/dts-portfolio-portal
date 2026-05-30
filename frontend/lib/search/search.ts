import { db } from "@/lib/db";

// Portal-wide search per requirements spec §6.1 + §5.7. Postgres
// full-text on the entity tables, weighted so name matches outrank
// description matches.
//
// Strategy: each entity table carries a `searchTsv` generated column
// (see migration 20260520000000_search_fts_columns). This module runs
// a UNION across them, ranks by ts_rank, and returns a typed result
// list the API layer (Phase 3 task 3.2) consumes.
//
// The LLM answer-card synthesis on top of this (Phase 3 task 3.3) is
// a separate concern — it takes these results plus the query, asks
// Azure OpenAI for a one-sentence summary, and surfaces both in the
// search overlay UI.

export type SearchEntityType =
  | "jurisdiction"
  | "domain"
  | "team"
  | "product"
  | "initiative";

export interface SearchResult {
  entityType: SearchEntityType;
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  /** Postgres ts_rank — higher is more relevant. */
  rank: number;
  /** Resolved URL the search overlay links to. */
  href: string | null;
}

const ENTITY_TYPES: ReadonlyArray<SearchEntityType> = [
  "jurisdiction",
  "domain",
  "team",
  "product",
  "initiative",
];

export interface SearchOptions {
  /** Maximum total results across all entity types. */
  limit?: number;
  /** Restrict to a subset of entity types (default: all). */
  types?: SearchEntityType[];
}

function buildHref(row: { entityType: SearchEntityType; slug: string | null }): string | null {
  switch (row.entityType) {
    case "jurisdiction":
      return row.slug ? `/j/${row.slug}` : null;
    case "domain":
      return row.slug ? `/d/${row.slug}` : null;
    case "team":
      return row.slug ? `/t/${row.slug}` : null;
    case "product":
      return row.slug ? `/p/${row.slug}` : null;
    case "initiative":
      // Initiatives don't have their own page (spec §3.2); they
      // open as popovers from the Product page. The search overlay
      // links to the parent Product if the row carries one.
      return null;
  }
}

// Row shape returned by the UNION query. PG returns numeric strings
// for ts_rank by default — we coerce in JS.
interface RawSearchRow {
  entityType: SearchEntityType;
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  rank: number | string;
}

export async function search(
  rawQuery: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (query === "") return [];
  const limit = options.limit ?? 20;
  const types = options.types ?? ENTITY_TYPES;
  const filterTypes = new Set(types);

  // websearch_to_tsquery accepts natural-language input including
  // negation (`-foo`) and quoted phrases (`"common platform"`). It's
  // the right input parser for the portal's "ask anything" search
  // bar per §6.1.
  //
  // We assemble the UNION dynamically based on the requested types so
  // a per-type filtered query doesn't pay for irrelevant scans.
  const parts: string[] = [];
  if (filterTypes.has("jurisdiction")) {
    parts.push(`
      SELECT 'jurisdiction'::text AS "entityType",
             id, slug, name, description,
             ts_rank("searchTsv", q.query) AS rank
      FROM "Jurisdiction", q
      WHERE "searchTsv" @@ q.query
    `);
  }
  if (filterTypes.has("domain")) {
    parts.push(`
      SELECT 'domain'::text AS "entityType",
             id, slug, name, description,
             ts_rank("searchTsv", q.query) AS rank
      FROM "ProductDomain", q
      WHERE "searchTsv" @@ q.query
    `);
  }
  if (filterTypes.has("team")) {
    parts.push(`
      SELECT 'team'::text AS "entityType",
             id, slug, name, description,
             ts_rank("searchTsv", q.query) AS rank
      FROM "Team", q
      WHERE "searchTsv" @@ q.query
    `);
  }
  if (filterTypes.has("product")) {
    parts.push(`
      SELECT 'product'::text AS "entityType",
             id, slug, name, description,
             ts_rank("searchTsv", q.query) AS rank
      FROM "Product", q
      WHERE "searchTsv" @@ q.query
    `);
  }
  if (filterTypes.has("initiative")) {
    parts.push(`
      SELECT 'initiative'::text AS "entityType",
             id,
             NULL::text AS slug,
             title AS name,
             description,
             ts_rank("searchTsv", q.query) AS rank
      FROM "Initiative", q
      WHERE "searchTsv" @@ q.query
    `);
  }
  if (parts.length === 0) return [];

  const sql = `
    WITH q AS (SELECT websearch_to_tsquery('english', $1) AS query)
    SELECT * FROM (
      ${parts.join("\nUNION ALL\n")}
    ) hits
    ORDER BY rank DESC, name ASC
    LIMIT $2;
  `;

  const rows = await db.$queryRawUnsafe<RawSearchRow[]>(sql, query, limit);
  return rows.map((r) => ({
    entityType: r.entityType,
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    rank: typeof r.rank === "string" ? Number.parseFloat(r.rank) : r.rank,
    href: buildHref({ entityType: r.entityType, slug: r.slug }),
  }));
}

// Convenience: the matrix of entity-type filter chips on the deep
// search page (spec §5.7) — counts per type for the current query.
export async function searchCounts(
  rawQuery: string,
): Promise<Record<SearchEntityType, number>> {
  const all = await search(rawQuery, { limit: 200 });
  const counts: Record<SearchEntityType, number> = {
    jurisdiction: 0,
    domain: 0,
    team: 0,
    product: 0,
    initiative: 0,
  };
  for (const r of all) counts[r.entityType] += 1;
  return counts;
}
