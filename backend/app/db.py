from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.settings import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@asynccontextmanager
async def async_session_factory() -> AsyncGenerator[AsyncSession, None]:
    """Context-managed session for ad-hoc use (scripts, tests)."""
    async with async_session_maker() as session:
        yield session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for per-request sessions."""
    async with async_session_maker() as session:
        yield session
