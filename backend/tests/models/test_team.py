from datetime import UTC, datetime

from sqlalchemy import select

from app.models.team import Team


async def test_team_round_trips(db_session):
    now = datetime.now(UTC).replace(tzinfo=None)
    from app.models.jurisdiction import Jurisdiction
    from app.models.product_domain import ProductDomain

    j = Jurisdiction(id="j_d3_jur", slug="test-d3-jur", name="D3 Jur", updated_at=now)
    db_session.add(j)
    await db_session.flush()

    pd = ProductDomain(
        id="pd_d3_test",
        slug="test-d3-domain",
        name="D3 Domain",
        jurisdiction_id="j_d3_jur",
        updated_at=now,
    )
    db_session.add(pd)
    await db_session.flush()

    team = Team(
        id="team_d3_test",
        slug="test-d3-team",
        name="D3 Team",
        domain_id="pd_d3_test",
        updated_at=now,
    )
    db_session.add(team)
    await db_session.flush()

    result = await db_session.execute(
        select(Team).where(Team.slug == "test-d3-team")
    )
    found = result.scalar_one()
    assert found.name == "D3 Team"
