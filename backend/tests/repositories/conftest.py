"""Conftest for repository integration tests.

The top-level conftest.py declares ``anyio_backend`` with ``scope="session"``.
For repository tests we use asyncio directly (``asyncio_mode = "auto"`` in
pyproject.toml) and create a fresh engine per test so that each test is
isolated in its own event loop.
"""

import os
from collections.abc import AsyncGenerator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://portal:portal@localhost:5432/portal",
)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Per-test session wrapped in a transaction that rolls back at the end."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.connect() as connection, connection.begin() as transaction:
        async with session_maker(bind=connection) as session:
            yield session
        await transaction.rollback()
    await engine.dispose()
