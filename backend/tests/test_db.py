import pytest
from sqlalchemy import text

from app.db import async_session_factory


@pytest.mark.skipif(
    "DATABASE_URL" not in __import__("os").environ,
    reason="Requires a live Postgres",
)
async def test_session_connects_to_postgres():
    async with async_session_factory() as session:
        result = await session.execute(text("SELECT 1"))
        assert result.scalar_one() == 1
