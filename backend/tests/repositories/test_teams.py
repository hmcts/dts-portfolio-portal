"""Tests for the teams repository."""

from datetime import datetime

from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team
from app.repositories.teams import get_products_for_team, get_team_by_slug


async def _seed(db_session):
    j = Jurisdiction(
        id="j_test_team",
        slug="test-jurisdiction-team",
        name="Test Jurisdiction Team",
        updated_at=datetime(2026, 1, 1),
    )
    d = ProductDomain(
        id="d_test_team",
        slug="test-domain-team",
        name="Test Domain Team",
        jurisdiction_id="j_test_team",
        updated_at=datetime(2026, 1, 1),
    )
    t = Team(
        id="t_test_teams",
        slug="test-hearings-team",
        name="Test Hearings Team",
        domain_id="d_test_team",
        updated_at=datetime(2026, 1, 1),
    )
    p = Product(
        id="p_test_teams",
        slug="test-hearings-product",
        name="Test Hearings Product",
        domain_id="d_test_team",
        stage="live",
        operating_team_id="t_test_teams",
        updated_at=datetime(2026, 1, 1),
    )
    db_session.add_all([j, d, t, p])
    await db_session.flush()


async def test_get_team_by_slug_returns_team(db_session):
    await _seed(db_session)
    team = await get_team_by_slug(db_session, "test-hearings-team")
    assert team is not None
    assert team.name == "Test Hearings Team"


async def test_get_team_by_slug_returns_none_for_missing(db_session):
    team = await get_team_by_slug(db_session, "slug-does-not-exist")
    assert team is None


async def test_get_products_for_team_returns_products(db_session):
    await _seed(db_session)
    products = await get_products_for_team(db_session, "test-hearings-team")
    assert len(products) == 1
    assert products[0].slug == "test-hearings-product"
