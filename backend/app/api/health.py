from fastapi import APIRouter

from app.settings import settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/version")
async def health_version() -> dict[str, str]:
    return {"status": "ok", "version": settings.app_version}
