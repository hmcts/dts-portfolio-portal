"""Conftest for API integration tests.

# DB isolation strategy: TRUNCATE-before-test

API tests hit the real FastAPI app via ASGITransport + httpx. The app's
request handlers open their own SQLAlchemy sessions via the ``get_db``
dependency, which is a separate session from the ``db_session`` transactional
fixture in the top-level conftest. That means rows seeded inside the
transactional test-session are invisible to the app's own session — the
savepoint rollback trick doesn't cross that boundary.

The chosen solution (option A from the design doc) is a TRUNCATE-before-each-
test fixture that runs as autouse. This resets the tables to a known-empty
state before every API test, then the test seeds what it needs via a freshly
opened session (committed, visible to the app).

Note on engines: The module-level engine in ``app.db`` is bound to whichever
asyncio event loop was current when it first connected. Tests run in per-test
event loops (asyncio_mode=auto), so reusing the app's module-level engine
inside a fixture causes a "Future attached to a different loop" error. We
create a fresh engine per fixture instead — matching the pattern used in
``tests/repositories/conftest.py``.

Trade-off: TRUNCATE is destructive on the shared dev DB. That's acceptable
because:
  - All test runs against the dev DB are ephemeral by design.
  - The Prisma seed data can be re-applied with ``npx prisma db seed`` if
    needed between manual testing sessions.
  - CI uses an isolated Postgres service container.
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://portal:portal@localhost:5432/portal",
)


@asynccontextmanager
async def _fresh_session() -> AsyncGenerator[AsyncSession, None]:
    """Open a new engine + session bound to the current event loop.

    The module-level engine in ``app.db`` is bound to whichever event loop
    was current on first connect. Tests each get their own loop
    (asyncio_mode=auto), so reusing it causes a 'Future attached to a
    different loop' error. Creating a fresh engine per call avoids this.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_maker() as session:
            yield session
    finally:
        await engine.dispose()


@pytest.fixture
def fresh_session():
    """Expose the _fresh_session context manager to tests as a fixture."""
    return _fresh_session


@pytest.fixture(autouse=True)
async def reset_api_db():
    """Truncate all entity tables before each API test for isolation."""
    async with _fresh_session() as session:
        await session.execute(
            text(
                'TRUNCATE TABLE '
                '"Initiative", "OutboundLink", "Product", "Team", '
                '"Theme", "ProductDomain", "Jurisdiction", '
                '"SearchEvent", "AiParseMetric" '
                'RESTART IDENTITY CASCADE'
            )
        )
        await session.commit()
    yield
