"""Ops dashboards API router.

Read-only aggregation endpoints for the /ops/search and /ops/ai-cost
dashboards. These endpoints query append-only analytics tables
(SearchEvent, AiParseMetric) that the frontend write-path populates.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.ops import (
    AiParseMetricsSummary,
    SearchEventsSummary,
    get_ai_parse_metrics_summary,
    get_search_events_summary,
)
from app.settings import settings

router = APIRouter(prefix="/api/ops", tags=["ops"])


@router.get("/search-events", response_model=SearchEventsSummary)
async def search_events(
    session: AsyncSession = Depends(get_db),
) -> SearchEventsSummary:
    """Return aggregated search event data for the ops/search dashboard."""
    return await get_search_events_summary(session)


@router.get("/ai-parse-metrics", response_model=AiParseMetricsSummary)
async def ai_parse_metrics(
    session: AsyncSession = Depends(get_db),
) -> AiParseMetricsSummary:
    """Return aggregated AI parse metrics for the ops/ai-cost dashboard."""
    return await get_ai_parse_metrics_summary(
        session,
        budget_tokens_per_day=settings.ai_parse_budget_tokens_per_day,
    )
