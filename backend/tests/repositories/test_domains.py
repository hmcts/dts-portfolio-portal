"""Tests for the domains repository."""

from datetime import datetime

from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain, StrategicTheme
from app.models.team import Team
from app.repositories.domains import (
    get_domain_by_slug,
    get_initiatives_for_domain,
    get_products_for_domain,
    get_teams_for_domain,
)


async def _seed(db_session):
    j = Jurisdiction(
        id="j_test_dom",
        slug="test-jurisdiction-dom",
        name="Test Jurisdiction Dom",
        updated_at=datetime(2026, 1, 1),
    )
    d = ProductDomain(
        id="d_test_dom",
        slug="test-domain-slug",
        name="Test Domain",
        jurisdiction_id="j_test_dom",
        updated_at=datetime(2026, 1, 1),
    )
    t = Team(
        id="t_test_dom",
        slug="test-team-dom",
        name="Test Team Dom",
        domain_id="d_test_dom",
        updated_at=datetime(2026, 1, 1),
    )
    p = Product(
        id="p_test_dom",
        slug="test-product-dom",
        name="Test Product Dom",
        domain_id="d_test_dom",
        stage="beta",
        operating_team_id="t_test_dom",
        updated_at=datetime(2026, 1, 1),
    )
    i = Initiative(
        id="i_test_dom",
        product_id="p_test_dom",
        bucket="NEXT",
        title="Test initiative",
        position=1,
        updated_at=datetime(2026, 1, 1),
    )
    theme = StrategicTheme(
        id="st_test_dom",
        title="Reduce sprawl",
        domain_id="d_test_dom",
        updated_at=datetime(2026, 1, 1),
    )
    db_session.add_all([j, d, t, p, i, theme])
    await db_session.flush()


async def test_get_domain_by_slug_returns_domain(db_session):
    await _seed(db_session)
    d = await get_domain_by_slug(db_session, "test-domain-slug")
    assert d is not None
    assert d.name == "Test Domain"
    # Verify the selectinload(strategic_themes) eager-load is working — if the
    # eager-load is removed, this will fail with MissingGreenlet (lazy-load
    # after session close) rather than passing silently.
    assert len(d.strategic_themes) == 1  # type: ignore[attr-defined]
    assert d.strategic_themes[0].title == "Reduce sprawl"  # type: ignore[attr-defined]


async def test_get_domain_by_slug_returns_none_for_missing(db_session):
    d = await get_domain_by_slug(db_session, "does-not-exist")
    assert d is None


async def test_get_products_for_domain_returns_products(db_session):
    await _seed(db_session)
    products = await get_products_for_domain(db_session, "test-domain-slug")
    assert len(products) == 1
    assert products[0].slug == "test-product-dom"


async def test_get_teams_for_domain_returns_teams(db_session):
    await _seed(db_session)
    teams = await get_teams_for_domain(db_session, "test-domain-slug")
    assert len(teams) == 1
    assert teams[0].slug == "test-team-dom"


async def test_get_initiatives_for_domain_groups_by_bucket(db_session):
    await _seed(db_session)
    grouped = await get_initiatives_for_domain(db_session, "test-domain-slug")
    assert "NOW" in grouped
    assert "NEXT" in grouped
    assert "LATER" in grouped
    assert len(grouped["NEXT"]) == 1
    assert grouped["NEXT"][0].title == "Test initiative"
    assert grouped["NOW"] == []
