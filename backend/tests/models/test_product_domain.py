from datetime import UTC, datetime

from sqlalchemy import select

from app.models.product_domain import ProductDomain, StrategicTheme


async def test_product_domain_round_trips(db_session):
    now = datetime.now(UTC).replace(tzinfo=None)
    j_id = "j_d2_jur"
    from app.models.jurisdiction import Jurisdiction

    j = Jurisdiction(id=j_id, slug="test-d2-jur", name="D2 Jurisdiction", updated_at=now)
    db_session.add(j)
    await db_session.flush()

    pd = ProductDomain(
        id="pd_d2_test",
        slug="test-d2-domain",
        name="D2 Domain",
        jurisdiction_id=j_id,
        updated_at=now,
    )
    db_session.add(pd)
    await db_session.flush()

    result = await db_session.execute(
        select(ProductDomain).where(ProductDomain.slug == "test-d2-domain")
    )
    found = result.scalar_one()
    assert found.name == "D2 Domain"


async def test_strategic_theme_round_trips(db_session):
    now = datetime.now(UTC).replace(tzinfo=None)
    from app.models.jurisdiction import Jurisdiction

    j = Jurisdiction(id="j_d2b_jur", slug="test-d2b-jur", name="D2b Jur", updated_at=now)
    db_session.add(j)
    await db_session.flush()

    pd = ProductDomain(
        id="pd_d2b_test",
        slug="test-d2b-domain",
        name="D2b Domain",
        jurisdiction_id="j_d2b_jur",
        updated_at=now,
    )
    db_session.add(pd)
    await db_session.flush()

    theme = StrategicTheme(
        id="theme_d2_test",
        title="Test Theme",
        domain_id="pd_d2b_test",
        updated_at=now,
    )
    db_session.add(theme)
    await db_session.flush()

    result = await db_session.execute(
        select(StrategicTheme).where(StrategicTheme.id == "theme_d2_test")
    )
    found = result.scalar_one()
    assert found.title == "Test Theme"
