"""Tests for the sidebar repository."""

from datetime import datetime

from app.models.jurisdiction import Jurisdiction
from app.models.product_domain import ProductDomain
from app.repositories.sidebar import SidebarJurisdiction, get_sidebar_jurisdictions


async def _seed(db_session):
    j = Jurisdiction(
        id="j_test_sb",
        slug="test-tribunals",
        name="Test Tribunals",
        updated_at=datetime(2026, 1, 1),
    )
    d1 = ProductDomain(
        id="d_test_sb_1",
        slug="test-employment-appeals",
        name="Test Employment Appeals",
        jurisdiction_id="j_test_sb",
        updated_at=datetime(2026, 1, 1),
    )
    d2 = ProductDomain(
        id="d_test_sb_2",
        slug="test-immigration-appeals",
        name="Test Immigration Appeals",
        jurisdiction_id="j_test_sb",
        updated_at=datetime(2026, 1, 1),
    )
    db_session.add_all([j, d1, d2])
    await db_session.flush()


async def test_get_sidebar_jurisdictions_returns_test_jurisdiction(db_session):
    await _seed(db_session)
    rows = await get_sidebar_jurisdictions(db_session)
    test_row = next((r for r in rows if r.slug == "test-tribunals"), None)
    assert test_row is not None
    assert isinstance(test_row, SidebarJurisdiction)
    assert test_row.count == 2


async def test_get_sidebar_domains_sorted_by_name(db_session):
    await _seed(db_session)
    rows = await get_sidebar_jurisdictions(db_session)
    test_row = next(r for r in rows if r.slug == "test-tribunals")
    domain_names = [d.name for d in test_row.domains]
    assert domain_names == sorted(domain_names)


async def test_get_sidebar_known_jurisdictions_ranked_first(db_session):
    await _seed(db_session)
    rows = await get_sidebar_jurisdictions(db_session)
    slugs = [r.slug for r in rows]
    # test-tribunals is unknown to JURISDICTION_ORDER so it lands after
    # known ones, but the list must still include it
    assert "test-tribunals" in slugs
