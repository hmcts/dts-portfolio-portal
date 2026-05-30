from datetime import UTC, datetime

from sqlalchemy import select

from app.models.initiative import Initiative


async def test_initiative_round_trips(db_session):
    now = datetime.now(UTC).replace(tzinfo=None)
    from app.models.jurisdiction import Jurisdiction
    from app.models.product import Product
    from app.models.product_domain import ProductDomain
    from app.models.team import Team

    j = Jurisdiction(id="j_d5_jur", slug="test-d5-jur", name="D5 Jur", updated_at=now)
    db_session.add(j)
    await db_session.flush()

    pd = ProductDomain(
        id="pd_d5_test",
        slug="test-d5-domain",
        name="D5 Domain",
        jurisdiction_id="j_d5_jur",
        updated_at=now,
    )
    db_session.add(pd)
    await db_session.flush()

    team = Team(
        id="team_d5_test",
        slug="test-d5-team",
        name="D5 Team",
        domain_id="pd_d5_test",
        updated_at=now,
    )
    db_session.add(team)
    await db_session.flush()

    product = Product(
        id="prod_d5_test",
        slug="test-d5-product",
        name="D5 Product",
        domain_id="pd_d5_test",
        operating_team_id="team_d5_test",
        updated_at=now,
    )
    db_session.add(product)
    await db_session.flush()

    initiative = Initiative(
        id="init_d5_test",
        product_id="prod_d5_test",
        bucket="NOW",
        title="D5 Initiative",
        updated_at=now,
    )
    db_session.add(initiative)
    await db_session.flush()

    result = await db_session.execute(
        select(Initiative).where(Initiative.id == "init_d5_test")
    )
    found = result.scalar_one()
    assert found.title == "D5 Initiative"
    assert found.bucket == "NOW"
