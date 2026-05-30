from datetime import UTC, datetime

from sqlalchemy import select

from app.models.search_event import SearchEvent


async def test_search_event_round_trips(db_session):
    """ActivityEntry does not exist in the baseline schema.

    D.6 is fulfilled by SearchEvent, which is in the baseline and serves
    the ops/search dashboard on the read path.
    """
    now = datetime.now(UTC).replace(tzinfo=None)
    event = SearchEvent(
        id="se_d6_test",
        created_at=now,
        kind="query",
        query="test search",
    )
    db_session.add(event)
    await db_session.flush()

    result = await db_session.execute(
        select(SearchEvent).where(SearchEvent.id == "se_d6_test")
    )
    found = result.scalar_one()
    assert found.query == "test search"
