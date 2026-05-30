"""Domains API router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.response_models import DomainDetail
from app.db import get_db
from app.models.initiative import Initiative
from app.models.product import Product
from app.models.team import Team
from app.repositories.domains import (
    get_domain_by_slug,
    get_initiatives_for_domain,
    get_products_for_domain,
    get_teams_for_domain,
)

router = APIRouter(prefix="/api/domains", tags=["domains"])


@router.get("/{slug}", response_model=DomainDetail)
async def by_slug(slug: str, session: AsyncSession = Depends(get_db)) -> DomainDetail:
    """Return a single ProductDomain by slug with strategic themes; 404 if not found."""
    found = await get_domain_by_slug(session, slug)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Domain '{slug}' not found")
    return DomainDetail(
        id=found.id,
        slug=found.slug,
        name=found.name,
        description=found.description,
        jurisdiction_id=found.jurisdiction_id,
        strategic_themes=list(found.strategic_themes),  # type: ignore[attr-defined]
    )


@router.get("/{slug}/products", response_model=list[Product])
async def products(
    slug: str, session: AsyncSession = Depends(get_db)
) -> list[Product]:
    """Return all Products for the given domain slug, ordered by name."""
    return list(await get_products_for_domain(session, slug))


@router.get("/{slug}/teams", response_model=list[Team])
async def teams(
    slug: str, session: AsyncSession = Depends(get_db)
) -> list[Team]:
    """Return all Teams whose home domain matches the given slug, ordered by name."""
    return list(await get_teams_for_domain(session, slug))


@router.get("/{slug}/initiatives", response_model=dict[str, list[Initiative]])
async def initiatives(
    slug: str, session: AsyncSession = Depends(get_db)
) -> dict[str, list[Initiative]]:
    """Return all Initiatives for the given domain slug, grouped by bucket."""
    return await get_initiatives_for_domain(session, slug)
