"""Products API router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.response_models import ProductDetail
from app.db import get_db
from app.models.initiative import Initiative
from app.repositories.products import (
    get_consumed_by_slugs_for_product,
    get_initiatives_for_product,
    get_product_by_slug,
)

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/{slug}", response_model=ProductDetail)
async def by_slug(slug: str, session: AsyncSession = Depends(get_db)) -> ProductDetail:
    """Return a single Product by slug with outbound links and consumed-by slugs; 404 if not found."""
    found = await get_product_by_slug(session, slug)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Product '{slug}' not found")
    consumed_by = await get_consumed_by_slugs_for_product(session, found.id)
    return ProductDetail(
        id=found.id,
        slug=found.slug,
        name=found.name,
        description=found.description,
        stage=found.stage,
        domain_id=found.domain_id,
        operating_team_id=found.operating_team_id,
        outbound_links=list(found.outbound_links),  # type: ignore[attr-defined]
        consumed_by=consumed_by,
    )


@router.get("/{slug}/initiatives", response_model=list[Initiative])
async def initiatives(
    slug: str, session: AsyncSession = Depends(get_db)
) -> list[Initiative]:
    """Return all Initiatives for the given product slug, ordered by position.

    Returns 404 if the product does not exist — the caller should not need to
    infer absence of initiatives from an empty list when the product itself is
    missing.
    """
    product = await get_product_by_slug(session, slug)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product '{slug}' not found")
    return list(await get_initiatives_for_product(session, product.id))
