"""Jurisdictions repository.

Read-path helpers for Jurisdiction and its related entities.
"""

from collections.abc import Sequence

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain


async def get_jurisdiction_counts(session: AsyncSession) -> dict[str, int]:
    """Return a mapping of jurisdiction slug → domain count."""
    result = await session.execute(
        select(Jurisdiction.slug, func.count(ProductDomain.id))
        .outerjoin(ProductDomain, ProductDomain.jurisdiction_id == Jurisdiction.id)
        .group_by(Jurisdiction.slug),
    )
    return dict(result.all())


async def get_jurisdiction_by_slug(session: AsyncSession, slug: str) -> Jurisdiction | None:
    """Fetch a single Jurisdiction by slug, or None if not found."""
    result = await session.execute(select(Jurisdiction).where(Jurisdiction.slug == slug))
    return result.scalar_one_or_none()


async def get_domains_by_jurisdiction(
    session: AsyncSession, slug: str
) -> Sequence[ProductDomain]:
    """Return all ProductDomains for the given jurisdiction slug, ordered by name."""
    result = await session.execute(
        select(ProductDomain)
        .join(Jurisdiction, Jurisdiction.id == ProductDomain.jurisdiction_id)
        .where(Jurisdiction.slug == slug)
        .order_by(ProductDomain.name),
    )
    return list(result.scalars())


async def get_products_consumed_by(
    session: AsyncSession, jurisdiction_slug: str
) -> Sequence[Product]:
    """Return Products consumed by the given Jurisdiction.

    ``_ConsumedByJurisdiction`` is a Prisma-implicit M2M join table with
    columns ``"A"`` (Jurisdiction.id) and ``"B"`` (Product.id), following
    Prisma's alphabetical ordering (J before P).
    """
    rows = await session.execute(
        text("""
            SELECT p.*
              FROM "Product" p
              JOIN "_ConsumedByJurisdiction" cj ON cj."B" = p.id
              JOIN "Jurisdiction" j ON j.id = cj."A"
             WHERE j.slug = :slug
        """),
        {"slug": jurisdiction_slug},
    )
    return [Product(**row._mapping) for row in rows]
