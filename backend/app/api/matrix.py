"""Roadmap matrix API router."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.matrix import MatrixJurisdictionBand, get_matrix

router = APIRouter(prefix="/api", tags=["matrix"])


@router.get("/matrix", response_model=list[MatrixJurisdictionBand])
async def matrix(session: AsyncSession = Depends(get_db)) -> list[MatrixJurisdictionBand]:
    """Return all jurisdictions with their domain rows and bucketed initiative cells."""
    return list(await get_matrix(session))
