"""Integration tests for /api/products/* endpoints."""

from datetime import datetime

from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team


async def _seed_full(fresh_session) -> None:
    """Seed jurisdiction → domain → team → product → initiative chain."""
    async with fresh_session() as s:
        j = Jurisdiction(
            id="j_pr_crime",
            slug="pr-crime",
            name="Products Crime",
            updated_at=datetime(2026, 1, 1),
        )
        d = ProductDomain(
            id="d_pr_cp",
            slug="pr-common-platform",
            name="Products Common Platform",
            jurisdiction_id="j_pr_crime",
            updated_at=datetime(2026, 1, 1),
        )
        t = Team(
            id="t_pr_mock",
            slug="pr-mock-team",
            name="Products Mock Team",
            domain_id="d_pr_cp",
            updated_at=datetime(2026, 1, 1),
        )
        p = Product(
            id="p_pr_sign_in",
            slug="pr-sign-in",
            name="Products Sign In",
            domain_id="d_pr_cp",
            stage="live",
            operating_team_id="t_pr_mock",
            updated_at=datetime(2026, 1, 1),
        )
        i1 = Initiative(
            id="i_pr_1",
            product_id="p_pr_sign_in",
            bucket="NOW",
            title="Products initiative NOW",
            position=1,
            updated_at=datetime(2026, 1, 1),
        )
        i2 = Initiative(
            id="i_pr_2",
            product_id="p_pr_sign_in",
            bucket="NEXT",
            title="Products initiative NEXT",
            position=2,
            updated_at=datetime(2026, 1, 1),
        )
        s.add_all([j, d, t, p, i1, i2])
        await s.commit()


# --- GET /api/products/{slug} ---

async def test_product_by_slug_returns_product(client, fresh_session):
    await _seed_full(fresh_session)

    resp = await client.get("/api/products/pr-sign-in")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "pr-sign-in"
    assert data["name"] == "Products Sign In"
    assert data["stage"] == "live"


async def test_product_by_slug_returns_404_for_unknown(client):
    resp = await client.get("/api/products/does-not-exist")
    assert resp.status_code == 404
    assert "does-not-exist" in resp.json()["detail"]


# --- GET /api/products/{slug}/initiatives ---

async def test_product_initiatives_returns_ordered_initiatives(client, fresh_session):
    await _seed_full(fresh_session)

    resp = await client.get("/api/products/pr-sign-in/initiatives")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["title"] == "Products initiative NOW"
    assert data[0]["bucket"] == "NOW"
    assert data[1]["title"] == "Products initiative NEXT"
    assert data[1]["bucket"] == "NEXT"


async def test_product_initiatives_returns_404_for_unknown_product(client):
    resp = await client.get("/api/products/no-such-product/initiatives")
    assert resp.status_code == 404
    assert "no-such-product" in resp.json()["detail"]
