// Write-path search module — unavailable during the write-path re-platform.
//
// The read path (Domains, Teams, Products, the roadmap matrix, full-text
// search) is served by the Python backend at /api/search. This frontend
// search module was a direct Postgres client; it is stubbed out here because
// the Prisma client has been removed in the Group K cutover.

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

export interface SearchOptions {
  /** Maximum total results across all entity types. */
  limit?: number;
  /** Restrict to a subset of entity types (default: all). */
  types?: SearchEntityType[];
}

export async function search(
  _rawQuery: string,
  _options: SearchOptions = {},
): Promise<SearchResult[]> {
  throw new Error(
    "Frontend search module unavailable: use the /api/search backend endpoint instead.",
  );
}

export async function searchCounts(
  _rawQuery: string,
): Promise<Record<SearchEntityType, number>> {
  throw new Error(
    "Frontend search module unavailable: use the /api/search backend endpoint instead.",
  );
}
