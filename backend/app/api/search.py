from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.search import SearchResult, fts_search

router = APIRouter(prefix="/api", tags=["search"])

_VALID_TYPES = frozenset(
    {"jurisdiction", "domain", "team", "product", "initiative"}
)


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]


def _parse_types(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    wanted = [t.strip().lower() for t in raw.split(",") if t.strip()]
    allowed = [t for t in wanted if t in _VALID_TYPES]
    return allowed if allowed else None


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(default="", description="Free-text search query"),
    limit: int = Query(default=10, ge=1, le=50),
    entity_type: str | None = Query(
        default=None,
        alias="type",
        description=(
            "Comma-separated entity types to filter: "
            "jurisdiction,domain,team,product,initiative"
        ),
    ),
    session: AsyncSession = Depends(get_db),
) -> SearchResponse:
    types = _parse_types(entity_type)
    results = await fts_search(session, q, limit=limit, types=types)
    return SearchResponse(query=q, results=results)
