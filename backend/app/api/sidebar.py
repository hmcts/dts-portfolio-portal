"""Sidebar navigation API router."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.sidebar import SidebarJurisdiction, get_sidebar_jurisdictions

router = APIRouter(prefix="/api/sidebar", tags=["sidebar"])


@router.get("/jurisdictions", response_model=list[SidebarJurisdiction])
async def sidebar_jurisdictions(
    session: AsyncSession = Depends(get_db),
) -> list[SidebarJurisdiction]:
    """Return all Jurisdictions with their domains, in canonical order."""
    return list(await get_sidebar_jurisdictions(session))
