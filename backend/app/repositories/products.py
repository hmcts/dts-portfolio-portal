"""Products repository.

Read-path helpers for Product and its related entities.
"""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.initiative import Initiative
from app.models.product import Product


async def get_product_by_slug(session: AsyncSession, slug: str) -> Product | None:
    """Fetch a single Product by slug, including its outbound links."""
    result = await session.execute(
        select(Product)
        .where(Product.slug == slug)
        .options(selectinload(Product.outbound_links)),  # type: ignore[attr-defined]
    )
    return result.scalar_one_or_none()


async def get_initiatives_for_product(
    session: AsyncSession, product_id: str
) -> Sequence[Initiative]:
    """Return all Initiatives for the given product_id, ordered by position."""
    result = await session.execute(
        select(Initiative)
        .where(Initiative.product_id == product_id)
        .order_by(Initiative.position),
    )
    return list(result.scalars())
