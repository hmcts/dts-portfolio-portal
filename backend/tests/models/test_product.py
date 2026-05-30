from datetime import UTC, datetime

from sqlalchemy import select

from app.models.product import OutboundLink, Product


async def test_product_round_trips(db_session):
    now = datetime.now(UTC).replace(tzinfo=None)
    from app.models.jurisdiction import Jurisdiction
    from app.models.product_domain import ProductDomain
    from app.models.team import Team

    j = Jurisdiction(id="j_d4_jur", slug="test-d4-jur", name="D4 Jur", updated_at=now)
    db_session.add(j)
    await db_session.flush()

    pd = ProductDomain(
        id="pd_d4_test",
        slug="test-d4-domain",
        name="D4 Domain",
        jurisdiction_id="j_d4_jur",
        updated_at=now,
    )
    db_session.add(pd)
    await db_session.flush()

    team = Team(
        id="team_d4_test",
        slug="test-d4-team",
        name="D4 Team",
        domain_id="pd_d4_test",
        updated_at=now,
    )
    db_session.add(team)
    await db_session.flush()

    product = Product(
        id="prod_d4_test",
        slug="test-d4-product",
        name="D4 Product",
        domain_id="pd_d4_test",
        operating_team_id="team_d4_test",
        updated_at=now,
    )
    db_session.add(product)
    await db_session.flush()

    result = await db_session.execute(
        select(Product).where(Product.slug == "test-d4-product")
    )
    found = result.scalar_one()
    assert found.name == "D4 Product"
    assert found.stage == "discovery"


async def test_outbound_link_round_trips(db_session):
    now = datetime.now(UTC).replace(tzinfo=None)
    from app.models.jurisdiction import Jurisdiction
    from app.models.product_domain import ProductDomain
    from app.models.team import Team

    j = Jurisdiction(id="j_d4c_jur", slug="test-d4c-jur", name="D4c Jur", updated_at=now)
    db_session.add(j)
    await db_session.flush()

    pd = ProductDomain(
        id="pd_d4c_test",
        slug="test-d4c-domain",
        name="D4c Domain",
        jurisdiction_id="j_d4c_jur",
        updated_at=now,
    )
    db_session.add(pd)
    await db_session.flush()

    team = Team(
        id="team_d4c_test",
        slug="test-d4c-team",
        name="D4c Team",
        domain_id="pd_d4c_test",
        updated_at=now,
    )
    db_session.add(team)
    await db_session.flush()

    product = Product(
        id="prod_d4c_test",
        slug="test-d4c-product",
        name="D4c Product",
        domain_id="pd_d4c_test",
        operating_team_id="team_d4c_test",
        updated_at=now,
    )
    db_session.add(product)
    await db_session.flush()

    link = OutboundLink(
        id="link_d4_test",
        product_id="prod_d4c_test",
        label="GitHub",
        url="https://github.com/example/repo",
    )
    db_session.add(link)
    await db_session.flush()

    result = await db_session.execute(
        select(OutboundLink).where(OutboundLink.id == "link_d4_test")
    )
    found = result.scalar_one()
    assert found.label == "GitHub"
