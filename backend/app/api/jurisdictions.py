"""Jurisdictions API router."""

from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.response_models import ConsumedProduct
from app.db import get_db
from app.models.jurisdiction import Jurisdiction
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


@router.get("/{slug}/consumed-products", response_model=list[ConsumedProduct])
async def consumed_products(
    slug: str, session: AsyncSession = Depends(get_db)
) -> list[ConsumedProduct]:
    """Return Products consumed by the given Jurisdiction, enriched with domain info."""
    products = list(await get_products_consumed_by(session, slug))
    if not products:
        return []
    domain_ids = list({p.domain_id for p in products})
    domain_rows = await session.execute(
        select(ProductDomain).where(ProductDomain.id.in_(domain_ids))
    )
    domains_by_id = {d.id: d for d in domain_rows.scalars()}
    return [
        ConsumedProduct(
            id=p.id,
            slug=p.slug,
            name=p.name,
            description=p.description,
            stage=p.stage,
            domain_slug=domains_by_id[p.domain_id].slug,
            domain_name=domains_by_id[p.domain_id].name,
        )
        for p in products
    ]
