"""Teams repository.

Read-path helpers for Team and the Products it operates.
"""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.team import Team


async def get_team_by_slug(session: AsyncSession, slug: str) -> Team | None:
    """Fetch a single Team by slug, or None if not found."""
    result = await session.execute(select(Team).where(Team.slug == slug))
    return result.scalar_one_or_none()


async def get_products_for_team(session: AsyncSession, team_slug: str) -> Sequence[Product]:
    """Return all Products operated by the given team slug, ordered by name."""
    result = await session.execute(
        select(Product)
        .join(Team, Team.id == Product.operating_team_id)
        .where(Team.slug == team_slug)
        .order_by(Product.name),
    )
    return list(result.scalars())
