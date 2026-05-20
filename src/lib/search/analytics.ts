import { createHash } from "node:crypto";
import { db } from "@/lib/db";

// Search analytics writers + readers per Phase 3 task 3.7.
//
// The /api/search route (PR #25) is expected to call
// recordSearchQuery in a follow-up wire-up commit; the overlay
// (PR #27) records clicks via the /api/search-events POST handler
// in this PR. Both kinds land in the same SearchEvent table; the
// ops dashboard at /ops/search reads aggregates from it.
//
// Identity: we never store the auth subject (email / OID). The
// `subjectHash` column is a SHA-256 of the subject so we can
// distinguish unique searchers without retaining PII per spec §8.4.

export type SearchEventKind = "query" | "click";

export interface RecordQueryInput {
  query: string;
  resultCount: number;
  subject?: string | null;
}

export interface RecordClickInput {
  query: string;
  clickedEntityType: string;
  clickedEntityId: string;
  clickedPosition: number;
  subject?: string | null;
}

// Records the user's submitted query. Caller passes the result
// count so we can later surface zero-result queries.
export async function recordSearchQuery(
  input: RecordQueryInput,
): Promise<void> {
  await db.searchEvent.create({
    data: {
      kind: "query",
      query: normaliseQuery(input.query),
      resultCount: input.resultCount,
      subjectHash: hashSubject(input.subject),
    },
  });
}

// Records that the user clicked a result for a given query. Lets us
// later derive "queries with answers but zero clicks" — the relevance
// triage signal called out in the plan.
export async function recordSearchClick(
  input: RecordClickInput,
): Promise<void> {
  await db.searchEvent.create({
    data: {
      kind: "click",
      query: normaliseQuery(input.query),
      clickedEntityType: input.clickedEntityType,
      clickedEntityId: input.clickedEntityId,
      clickedPosition: input.clickedPosition,
      subjectHash: hashSubject(input.subject),
    },
  });
}

export interface ZeroResultQuery {
  query: string;
  occurrences: number;
  lastSeenAt: Date;
}

// Distinct queries with resultCount = 0 in the trailing `days` UTC
// days. Sorted by occurrence count desc, then most-recent first.
export async function getZeroResultQueries(
  days: number,
  limit = 50,
): Promise<ZeroResultQuery[]> {
  const rows = await db.$queryRawUnsafe<
    Array<{ query: string; occurrences: bigint; last_seen_at: Date }>
  >(
    `
    SELECT
      "query"                       AS query,
      COUNT(*)                      AS occurrences,
      MAX("createdAt")              AS last_seen_at
    FROM "SearchEvent"
    WHERE "kind" = 'query'
      AND "resultCount" = 0
      AND "createdAt" >= NOW() - ($1::int * INTERVAL '1 day')
    GROUP BY "query"
    ORDER BY occurrences DESC, last_seen_at DESC
    LIMIT $2::int
  `,
    days,
    limit,
  );
  return rows.map((r) => ({
    query: r.query,
    occurrences: Number(r.occurrences),
    lastSeenAt: r.last_seen_at,
  }));
}

export interface UnclickedQuery {
  query: string;
  occurrences: number;
  lastSeenAt: Date;
  topResultCount: number;
}

// Queries that had at least one result but received zero clicks. These
// are the relevance-triage signal — answers are there but users
// aren't taking them. Excludes queries where the user later refined,
// since we can't tell that apart from "they got what they wanted".
export async function getUnclickedQueries(
  days: number,
  limit = 50,
): Promise<UnclickedQuery[]> {
  const rows = await db.$queryRawUnsafe<
    Array<{
      query: string;
      occurrences: bigint;
      last_seen_at: Date;
      top_result_count: number;
    }>
  >(
    `
    SELECT
      q."query"                              AS query,
      COUNT(*)                               AS occurrences,
      MAX(q."createdAt")                     AS last_seen_at,
      MAX(q."resultCount")                   AS top_result_count
    FROM "SearchEvent" q
    LEFT JOIN "SearchEvent" c
      ON c."kind"  = 'click'
     AND c."query" = q."query"
     AND c."createdAt" >= q."createdAt"
     AND c."createdAt" <= q."createdAt" + INTERVAL '5 minutes'
    WHERE q."kind" = 'query'
      AND q."resultCount" > 0
      AND q."createdAt" >= NOW() - ($1::int * INTERVAL '1 day')
      AND c."id" IS NULL
    GROUP BY q."query"
    ORDER BY occurrences DESC, last_seen_at DESC
    LIMIT $2::int
  `,
    days,
    limit,
  );
  return rows.map((r) => ({
    query: r.query,
    occurrences: Number(r.occurrences),
    lastSeenAt: r.last_seen_at,
    topResultCount: r.top_result_count,
  }));
}

export interface DailySearchVolume {
  day: string;
  queries: number;
  clicks: number;
}

export async function getDailySearchVolume(
  days: number,
): Promise<DailySearchVolume[]> {
  const rows = await db.$queryRawUnsafe<
    Array<{ day: Date; queries: bigint; clicks: bigint }>
  >(
    `
    SELECT
      date_trunc('day', "createdAt")::date         AS day,
      COUNT(*) FILTER (WHERE "kind" = 'query')     AS queries,
      COUNT(*) FILTER (WHERE "kind" = 'click')     AS clicks
    FROM "SearchEvent"
    WHERE "createdAt" >= date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day'
    GROUP BY day
    ORDER BY day DESC
  `,
    days,
  );
  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    queries: Number(r.queries),
    clicks: Number(r.clicks),
  }));
}

// Lowercase + collapse whitespace. We don't strip punctuation —
// "Common Platform?" and "Common Platform" are distinct intent
// signals worth keeping apart in the dashboard.
function normaliseQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ").toLowerCase();
}

function hashSubject(subject: string | null | undefined): string | null {
  if (!subject) return null;
  return createHash("sha256").update(subject).digest("hex");
}
