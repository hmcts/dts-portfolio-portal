"""Ops read helpers.

Aggregations over SearchEvent and AiParseMetric for the /ops dashboards.
These tables are append-only: no UPDATE or DELETE triggers allow
modifications, only INSERTs.
"""

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class ZeroResultQuery(BaseModel):
    query: str
    occurrences: int
    last_seen_at: str  # ISO-8601 datetime string


class UnclickedQuery(BaseModel):
    query: str
    occurrences: int
    last_seen_at: str  # ISO-8601 datetime string
    top_result_count: int


class DailySearchVolume(BaseModel):
    day: str  # YYYY-MM-DD
    queries: int
    clicks: int


class SearchEventsSummary(BaseModel):
    """Aggregate view of search events for the /ops/search dashboard."""

    total_queries: int
    total_clicks: int
    zero_result_queries: list[ZeroResultQuery]
    unclicked_queries: list[UnclickedQuery]
    daily_volume: list[DailySearchVolume]


class DailyParseMetric(BaseModel):
    day: str  # YYYY-MM-DD
    source: str
    parse_count: int
    success_count: int
    failure_count: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    avg_latency_ms: float


class AiParseMetricsSummary(BaseModel):
    """Aggregate view of AI parse metrics for the /ops/ai-cost dashboard."""

    today_tokens: int
    budget_tokens_per_day: int | None
    exceeded: bool
    total_parses: int
    total_successes: int
    total_failures: int
    total_tokens: int
    daily_metrics: list[DailyParseMetric]


_DAYS_BACK = 14
_LIMIT = 50


async def get_search_events_summary(session: AsyncSession) -> SearchEventsSummary:
    """Return aggregated search event data for the trailing 14 days."""

    # Daily volume
    vol_rows = await session.execute(
        text(
            """
            SELECT
              date_trunc('day', "createdAt")::date                     AS day,
              COUNT(*) FILTER (WHERE "kind" = 'query')                 AS queries,
              COUNT(*) FILTER (WHERE "kind" = 'click')                 AS clicks
            FROM "SearchEvent"
            WHERE "createdAt" >= date_trunc('day', NOW())
                  - (:days - 1) * INTERVAL '1 day'
            GROUP BY day
            ORDER BY day DESC
            """
        ),
        {"days": _DAYS_BACK},
    )
    daily_volume = [
        DailySearchVolume(
            day=str(r.day),
            queries=int(r.queries),
            clicks=int(r.clicks),
        )
        for r in vol_rows
    ]

    total_queries = sum(d.queries for d in daily_volume)
    total_clicks = sum(d.clicks for d in daily_volume)

    # Zero-result queries
    zero_rows = await session.execute(
        text(
            """
            SELECT
              "query"           AS query,
              COUNT(*)          AS occurrences,
              MAX("createdAt")  AS last_seen_at
            FROM "SearchEvent"
            WHERE "kind" = 'query'
              AND "resultCount" = 0
              AND "createdAt" >= NOW() - (:days::int * INTERVAL '1 day')
            GROUP BY "query"
            ORDER BY occurrences DESC, last_seen_at DESC
            LIMIT :limit
            """
        ),
        {"days": _DAYS_BACK, "limit": _LIMIT},
    )
    zero_result_queries = [
        ZeroResultQuery(
            query=r.query,
            occurrences=int(r.occurrences),
            last_seen_at=r.last_seen_at.isoformat(),
        )
        for r in zero_rows
    ]

    # Unclicked queries
    unclicked_rows = await session.execute(
        text(
            """
            SELECT
              q."query"             AS query,
              COUNT(*)              AS occurrences,
              MAX(q."createdAt")    AS last_seen_at,
              MAX(q."resultCount")  AS top_result_count
            FROM "SearchEvent" q
            LEFT JOIN "SearchEvent" c
              ON c."kind"    = 'click'
             AND c."query"   = q."query"
             AND c."createdAt" >= q."createdAt"
             AND c."createdAt" <= q."createdAt" + INTERVAL '5 minutes'
            WHERE q."kind" = 'query'
              AND q."resultCount" > 0
              AND q."createdAt" >= NOW() - (:days::int * INTERVAL '1 day')
              AND c."id" IS NULL
            GROUP BY q."query"
            ORDER BY occurrences DESC, last_seen_at DESC
            LIMIT :limit
            """
        ),
        {"days": _DAYS_BACK, "limit": _LIMIT},
    )
    unclicked_queries = [
        UnclickedQuery(
            query=r.query,
            occurrences=int(r.occurrences),
            last_seen_at=r.last_seen_at.isoformat(),
            top_result_count=int(r.top_result_count),
        )
        for r in unclicked_rows
    ]

    return SearchEventsSummary(
        total_queries=total_queries,
        total_clicks=total_clicks,
        zero_result_queries=zero_result_queries,
        unclicked_queries=unclicked_queries,
        daily_volume=daily_volume,
    )


async def get_ai_parse_metrics_summary(
    session: AsyncSession,
    budget_tokens_per_day: int | None,
) -> AiParseMetricsSummary:
    """Return aggregated AI parse metric data for the trailing 14 days."""

    # Today's total tokens
    today_row = await session.execute(
        text(
            """
            SELECT COALESCE(SUM("totalTokens"), 0)::bigint AS total_tokens
            FROM "AiParseMetric"
            WHERE "createdAt" >= date_trunc('day', NOW())
            """
        )
    )
    today_tokens = int(today_row.scalar_one())

    # Daily aggregates per (day, source)
    daily_rows = await session.execute(
        text(
            """
            SELECT
              date_trunc('day', "createdAt")::date               AS day,
              "source"                                            AS source,
              COUNT(*)                                            AS parse_count,
              COUNT(*) FILTER (WHERE "outcome" = 'success')      AS success_count,
              COUNT(*) FILTER (WHERE "outcome" = 'failure')      AS failure_count,
              COALESCE(SUM("promptTokens"), 0)                   AS prompt_tokens,
              COALESCE(SUM("completionTokens"), 0)               AS completion_tokens,
              COALESCE(SUM("totalTokens"), 0)                    AS total_tokens,
              AVG("latencyMs")::float                            AS avg_latency_ms
            FROM "AiParseMetric"
            WHERE "createdAt" >= date_trunc('day', NOW())
                  - (:days - 1) * INTERVAL '1 day'
            GROUP BY day, "source"
            ORDER BY day DESC, source ASC
            """
        ),
        {"days": _DAYS_BACK},
    )
    daily_metrics = [
        DailyParseMetric(
            day=str(r.day),
            source=r.source,
            parse_count=int(r.parse_count),
            success_count=int(r.success_count),
            failure_count=int(r.failure_count),
            prompt_tokens=int(r.prompt_tokens),
            completion_tokens=int(r.completion_tokens),
            total_tokens=int(r.total_tokens),
            avg_latency_ms=float(r.avg_latency_ms or 0),
        )
        for r in daily_rows
    ]

    total_parses = sum(d.parse_count for d in daily_metrics)
    total_successes = sum(d.success_count for d in daily_metrics)
    total_failures = sum(d.failure_count for d in daily_metrics)
    total_tokens = sum(d.total_tokens for d in daily_metrics)

    return AiParseMetricsSummary(
        today_tokens=today_tokens,
        budget_tokens_per_day=budget_tokens_per_day,
        exceeded=(
            budget_tokens_per_day is not None and today_tokens > budget_tokens_per_day
        ),
        total_parses=total_parses,
        total_successes=total_successes,
        total_failures=total_failures,
        total_tokens=total_tokens,
        daily_metrics=daily_metrics,
    )
