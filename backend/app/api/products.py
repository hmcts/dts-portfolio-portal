"""Products API router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.initiative import Initiative
from app.models.product import Product
from app.repositories.products import get_initiatives_for_product, get_product_by_slug

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/{slug}", response_model=Product)
async def by_slug(slug: str, session: AsyncSession = Depends(get_db)) -> Product:
    """Return a single Product by slug; 404 if not found."""
    found = await get_product_by_slug(session, slug)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Product '{slug}' not found")
    return found


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
