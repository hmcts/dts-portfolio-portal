"""Sidebar repository.

Builds the lightweight Jurisdiction + nested Domain list used by the
navigation sidebar.
"""

from collections.abc import Sequence

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.jurisdiction import Jurisdiction

JURISDICTION_ORDER: tuple[str, ...] = ("crime", "civil", "family", "tribunals", "administrative")


class SidebarDomain(BaseModel):
    slug: str
    name: str


class SidebarJurisdiction(BaseModel):
    slug: str
    name: str
    count: int
    domains: list[SidebarDomain]


def _rank(slug: str) -> int:
    return JURISDICTION_ORDER.index(slug) if slug in JURISDICTION_ORDER else len(JURISDICTION_ORDER)


async def get_sidebar_jurisdictions(session: AsyncSession) -> Sequence[SidebarJurisdiction]:
    """Return all Jurisdictions with their domains, in canonical order."""
    result = await session.execute(
        select(Jurisdiction).options(selectinload(Jurisdiction.domains)),  # type: ignore[attr-defined]
    )
    rows = sorted(result.scalars().unique(), key=lambda j: _rank(j.slug))
    return [
        SidebarJurisdiction(
            slug=j.slug,
            name=j.name,
            count=len(j.domains),  # type: ignore[attr-defined]
            domains=[
                SidebarDomain(slug=d.slug, name=d.name)
                for d in sorted(j.domains, key=lambda d: d.name)  # type: ignore[attr-defined]
            ],
        )
        for j in rows
    ]
