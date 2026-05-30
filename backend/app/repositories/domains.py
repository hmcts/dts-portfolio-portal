"""Domains repository.

Read-path helpers for ProductDomain and its related entities.
"""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.initiative import Initiative
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team


async def get_domain_by_slug(session: AsyncSession, slug: str) -> ProductDomain | None:
    """Fetch a single ProductDomain by slug, including its strategic themes."""
    result = await session.execute(
        select(ProductDomain)
        .where(ProductDomain.slug == slug)
        .options(selectinload(ProductDomain.strategic_themes)),  # type: ignore[attr-defined]
    )
    return result.scalar_one_or_none()


async def get_products_for_domain(
    session: AsyncSession, domain_slug: str
) -> Sequence[Product]:
    """Return all Products for the given domain slug, ordered by name."""
    result = await session.execute(
        select(Product)
        .join(ProductDomain, ProductDomain.id == Product.domain_id)
        .where(ProductDomain.slug == domain_slug)
        .order_by(Product.name),
    )
    return list(result.scalars())


async def get_teams_for_domain(session: AsyncSession, domain_slug: str) -> Sequence[Team]:
    """Return all Teams whose home domain matches the given slug, ordered by name."""
    result = await session.execute(
        select(Team)
        .join(ProductDomain, ProductDomain.id == Team.domain_id)
        .where(ProductDomain.slug == domain_slug)
        .order_by(Team.name),
    )
    return list(result.scalars())


async def get_initiatives_for_domain(
    session: AsyncSession, domain_slug: str
) -> dict[str, list[Initiative]]:
    """Return all Initiatives for the given domain slug grouped by bucket.

    Returns a dict with keys ``"NOW"``, ``"NEXT"``, ``"LATER"``; each value
    is a list of Initiatives ordered by position.
    """
    result = await session.execute(
        select(Initiative)
        .join(Product, Product.id == Initiative.product_id)
        .join(ProductDomain, ProductDomain.id == Product.domain_id)
        .where(ProductDomain.slug == domain_slug)
        .order_by(Initiative.position),
    )
    initiatives = list(result.scalars())
    grouped: dict[str, list[Initiative]] = {"NOW": [], "NEXT": [], "LATER": []}
    for i in initiatives:
        grouped.setdefault(i.bucket, []).append(i)
    return grouped
