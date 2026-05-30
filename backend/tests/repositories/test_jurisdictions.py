"""Tests for the jurisdictions repository."""

from datetime import datetime

from sqlalchemy import text

from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team
from app.repositories.jurisdictions import (
    get_domains_by_jurisdiction,
    get_jurisdiction_by_slug,
    get_jurisdiction_counts,
    get_products_consumed_by,
)


async def _seed(db_session):
    """Insert a jurisdiction with one domain and one product consumed by it."""
    j = Jurisdiction(
        id="j_test_civil",
        slug="test-civil",
        name="Test Civil",
        updated_at=datetime(2026, 1, 1),
    )
    j2 = Jurisdiction(
        id="j_test_family",
        slug="test-family",
        name="Test Family",
        updated_at=datetime(2026, 1, 1),
    )
    t = Team(
        id="t_test_j",
        slug="test-team-j",
        name="Test Team J",
        domain_id="d_test_civil",
        updated_at=datetime(2026, 1, 1),
    )
    d = ProductDomain(
        id="d_test_civil",
        slug="test-civil-domain",
        name="Test Civil Domain",
        jurisdiction_id="j_test_civil",
        updated_at=datetime(2026, 1, 1),
    )
    p = Product(
        id="p_test_civil_prod",
        slug="test-civil-product",
        name="Test Civil Product",
        domain_id="d_test_civil",
        stage="live",
        operating_team_id="t_test_j",
        updated_at=datetime(2026, 1, 1),
    )
    db_session.add_all([j, j2, t, d, p])
    await db_session.flush()
    # Insert into the M2M join table: A = Jurisdiction.id, B = Product.id
    await db_session.execute(
        text('INSERT INTO "_ConsumedByJurisdiction" ("A", "B") VALUES (:a, :b)'),
        {"a": "j_test_family", "b": "p_test_civil_prod"},
    )
    await db_session.flush()


async def test_get_jurisdiction_counts_includes_test_jurisdiction(db_session):
    await _seed(db_session)
    counts = await get_jurisdiction_counts(db_session)
    assert counts.get("test-civil", 0) == 1


async def test_get_jurisdiction_by_slug_returns_correct_row(db_session):
    await _seed(db_session)
    j = await get_jurisdiction_by_slug(db_session, "test-civil")
    assert j is not None
    assert j.name == "Test Civil"


async def test_get_jurisdiction_by_slug_returns_none_for_missing(db_session):
    j = await get_jurisdiction_by_slug(db_session, "slug-does-not-exist")
    assert j is None


async def test_get_domains_by_jurisdiction_returns_domains(db_session):
    await _seed(db_session)
    domains = await get_domains_by_jurisdiction(db_session, "test-civil")
    assert len(domains) == 1
    assert domains[0].slug == "test-civil-domain"


async def test_get_products_consumed_by_returns_products(db_session):
    await _seed(db_session)
    products = await get_products_consumed_by(db_session, "test-family")
    assert len(products) == 1
    assert products[0].slug == "test-civil-product"
    # Verify camelCase DB columns are correctly mapped — these were silently
    # None when the function used raw SQL with Product(**row._mapping).
    assert products[0].domain_id == "d_test_civil"
    assert products[0].operating_team_id == "t_test_j"


async def test_get_products_consumed_by_returns_empty_for_no_match(db_session):
    await _seed(db_session)
    products = await get_products_consumed_by(db_session, "test-civil")
    assert products == []
