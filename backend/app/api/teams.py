"""Teams API router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.product import Product
from app.models.team import Team
from app.repositories.teams import get_products_for_team, get_team_by_slug

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/{slug}", response_model=Team)
async def by_slug(slug: str, session: AsyncSession = Depends(get_db)) -> Team:
    """Return a single Team by slug; 404 if not found."""
    found = await get_team_by_slug(session, slug)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Team '{slug}' not found")
    return found


@router.get("/{slug}/products", response_model=list[Product])
async def products(
    slug: str, session: AsyncSession = Depends(get_db)
) -> list[Product]:
    """Return all Products operated by the given team slug, ordered by name."""
    return list(await get_products_for_team(session, slug))
