"""Tests for the products repository."""

from datetime import datetime

from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import OutboundLink, Product
from app.models.product_domain import ProductDomain
from app.models.team import Team
from app.repositories.products import get_initiatives_for_product, get_product_by_slug


async def _seed(db_session):
    j = Jurisdiction(
        id="j_test_prod",
        slug="test-jurisdiction-prod",
        name="Test Jurisdiction Prod",
        updated_at=datetime(2026, 1, 1),
    )
    d = ProductDomain(
        id="d_test_prod",
        slug="test-domain-prod",
        name="Test Domain Prod",
        jurisdiction_id="j_test_prod",
        updated_at=datetime(2026, 1, 1),
    )
    t = Team(
        id="t_test_prod",
        slug="test-team-prod",
        name="Test Team Prod",
        domain_id="d_test_prod",
        updated_at=datetime(2026, 1, 1),
    )
    p = Product(
        id="p_test_prod",
        slug="test-resulting-assistant",
        name="Test Resulting Assistant",
        domain_id="d_test_prod",
        stage="alpha",
        operating_team_id="t_test_prod",
        updated_at=datetime(2026, 1, 1),
    )
    link = OutboundLink(
        id="ol_test_prod",
        product_id="p_test_prod",
        label="Confluence",
        url="https://example.com/confluence",
        position=1,
    )
    i1 = Initiative(
        id="i_test_prod_1",
        product_id="p_test_prod",
        bucket="NOW",
        title="Sentence-type picker rewrite",
        position=1,
        updated_at=datetime(2026, 1, 1),
    )
    i2 = Initiative(
        id="i_test_prod_2",
        product_id="p_test_prod",
        bucket="NEXT",
        title="Welsh-language support",
        position=2,
        updated_at=datetime(2026, 1, 1),
    )
    db_session.add_all([j, d, t, p, link, i1, i2])
    await db_session.flush()


async def test_get_product_by_slug_returns_product(db_session):
    await _seed(db_session)
    p = await get_product_by_slug(db_session, "test-resulting-assistant")
    assert p is not None
    assert p.name == "Test Resulting Assistant"


async def test_get_product_by_slug_returns_none_for_missing(db_session):
    p = await get_product_by_slug(db_session, "does-not-exist")
    assert p is None


async def test_get_product_by_slug_eager_loads_outbound_links(db_session):
    await _seed(db_session)
    p = await get_product_by_slug(db_session, "test-resulting-assistant")
    assert p is not None
    links = p.outbound_links  # type: ignore[attr-defined]
    assert len(links) == 1
    assert links[0].label == "Confluence"


async def test_get_initiatives_for_product_returns_ordered_initiatives(db_session):
    await _seed(db_session)
    initiatives = await get_initiatives_for_product(db_session, "p_test_prod")
    assert len(initiatives) == 2
    assert initiatives[0].bucket == "NOW"
    assert initiatives[1].bucket == "NEXT"
