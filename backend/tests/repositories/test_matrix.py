"""Tests for the matrix repository."""

from datetime import datetime

from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team
from app.repositories.matrix import get_matrix


async def _seed_basic(db_session):
    t = Team(
        id="t_test_mock",
        slug="test-mock-team",
        name="Test Mock Team",
        domain_id="d_test_cp",
        updated_at=datetime(2026, 1, 1),
    )
    j = Jurisdiction(
        id="j_test_crime",
        slug="test-crime",
        name="Test Crime",
        updated_at=datetime(2026, 1, 1),
    )
    d = ProductDomain(
        id="d_test_cp",
        slug="test-common-platform",
        name="Test Common Platform Domain",
        jurisdiction_id="j_test_crime",
        updated_at=datetime(2026, 1, 1),
    )
    p = Product(
        id="p_test_sign_in",
        slug="test-sign-in",
        name="Sign In",
        domain_id="d_test_cp",
        stage="live",
        operating_team_id="t_test_mock",
        updated_at=datetime(2026, 1, 1),
    )
    i = Initiative(
        id="i_test_1",
        product_id="p_test_sign_in",
        bucket="NOW",
        title="Sign-in latency reduction",
        position=1,
        updated_at=datetime(2026, 1, 1),
    )
    db_session.add_all([j, t, d, p, i])
    await db_session.flush()


async def test_matrix_returns_one_band_per_jurisdiction(db_session):
    await _seed_basic(db_session)
    bands = await get_matrix(db_session)
    assert len(bands) >= 1
    crime = next(b for b in bands if b.jurisdiction.slug == "test-crime")
    assert crime.domain_count == 1
    assert crime.initiative_count == 1
    assert crime.rows[0].cells["NOW"][0].title == "Sign-in latency reduction"
