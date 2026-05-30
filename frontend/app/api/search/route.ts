import { NextResponse } from "next/server";
import { search, searchCounts, type SearchEntityType } from "@/lib/search/search";

// GET /api/search?q=...&type=team,product&limit=10
//
// Phase 3 task 3.2. Pure-data endpoint consumed by:
//   - The instant overlay under the top-bar search input (task 3.4)
//   - The deep results page at /search?q=... (task 3.5)
//
// LLM answer-card synthesis is a separate endpoint (task 3.3) — it
// takes the same query and the top hits returned here.

export const dynamic = "force-dynamic";

const VALID_TYPES: ReadonlyArray<SearchEntityType> = [
  "jurisdiction",
  "domain",
  "team",
  "product",
  "initiative",
];

function parseTypes(raw: string | null): SearchEntityType[] | undefined {
  if (!raw) return undefined;
  const wanted = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const allowed = wanted.filter((t): t is SearchEntityType =>
    (VALID_TYPES as ReadonlyArray<string>).includes(t),
  );
  return allowed.length > 0 ? allowed : undefined;
}

function parseLimit(raw: string | null): number {
  if (!raw) return 10;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return 10;
  return Math.min(n, 50);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const types = parseTypes(url.searchParams.get("type"));
  const limit = parseLimit(url.searchParams.get("limit"));
  const wantCounts = url.searchParams.get("counts") === "1";

  if (!q.trim()) {
    return NextResponse.json({
      query: q,
      results: [],
      ...(wantCounts
        ? { counts: { jurisdiction: 0, domain: 0, team: 0, product: 0, initiative: 0 } }
        : {}),
    });
  }

  const [results, counts] = await Promise.all([
    search(q, { limit, ...(types ? { types } : {}) }),
    wantCounts ? searchCounts(q) : Promise.resolve(undefined),
  ]);

  return NextResponse.json({
    query: q,
    results,
    ...(counts ? { counts } : {}),
  });
}
