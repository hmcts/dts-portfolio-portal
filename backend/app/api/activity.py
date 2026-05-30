"""Activity feed API router."""

from fastapi import APIRouter, Query

from app.models.activity_entry import ActivityEntry
from app.repositories.activity import get_activity

router = APIRouter(prefix="/api", tags=["activity"])


@router.get("/activity", response_model=list[ActivityEntry])
async def activity(limit: int = Query(default=10, ge=1, le=100)) -> list[ActivityEntry]:
    """Return seed-backed activity entries, most-recent-first."""
    return list(await get_activity(limit=limit))
