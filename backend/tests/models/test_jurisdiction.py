from datetime import UTC, datetime

from sqlalchemy import select

from app.models.jurisdiction import Jurisdiction


async def test_jurisdiction_round_trips(db_session):
    now = datetime.now(UTC).replace(tzinfo=None)
    j = Jurisdiction(id="j_test_d1", slug="test-d1-jurisdiction", name="Test D1", updated_at=now)
    db_session.add(j)
    await db_session.flush()

    result = await db_session.execute(
        select(Jurisdiction).where(Jurisdiction.slug == "test-d1-jurisdiction")
    )
    found = result.scalar_one()
    assert found.name == "Test D1"
