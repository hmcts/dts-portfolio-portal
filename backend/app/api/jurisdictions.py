"""Jurisdictions API router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.repositories.jurisdictions import (
    get_domains_by_jurisdiction,
    get_jurisdiction_by_slug,
    get_products_consumed_by,
)

router = APIRouter(prefix="/api/jurisdictions", tags=["jurisdictions"])


@router.get("/{slug}", response_model=Jurisdiction)
async def by_slug(slug: str, session: AsyncSession = Depends(get_db)) -> Jurisdiction:
    """Return a single Jurisdiction by slug; 404 if not found."""
    found = await get_jurisdiction_by_slug(session, slug)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Jurisdiction '{slug}' not found")
    return found


@router.get("/{slug}/domains", response_model=list[ProductDomain])
async def domains(
    slug: str, session: AsyncSession = Depends(get_db)
) -> list[ProductDomain]:
    """Return all ProductDomains for the given jurisdiction slug, ordered by name."""
    return list(await get_domains_by_jurisdiction(session, slug))


@router.get("/{slug}/consumed-products", response_model=list[Product])
async def consumed_products(
    slug: str, session: AsyncSession = Depends(get_db)
) -> list[Product]:
    """Return Products consumed by the given Jurisdiction."""
    return list(await get_products_consumed_by(session, slug))
