"""Integration tests for /api/teams/* endpoints."""

from datetime import datetime

from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team


async def _seed_full(fresh_session) -> None:
    """Seed jurisdiction → domain → team → product chain."""
    async with fresh_session() as s:
        j = Jurisdiction(
            id="j_tm_crime",
            slug="tm-crime",
            name="Teams Crime",
            updated_at=datetime(2026, 1, 1),
        )
        d = ProductDomain(
            id="d_tm_cp",
            slug="tm-common-platform",
            name="Teams Common Platform",
            jurisdiction_id="j_tm_crime",
            updated_at=datetime(2026, 1, 1),
        )
        t = Team(
            id="t_tm_alpha",
            slug="tm-alpha-team",
            name="Teams Alpha Team",
            domain_id="d_tm_cp",
            updated_at=datetime(2026, 1, 1),
        )
        p = Product(
            id="p_tm_sign_in",
            slug="tm-sign-in",
            name="Teams Sign In",
            domain_id="d_tm_cp",
            stage="live",
            operating_team_id="t_tm_alpha",
            updated_at=datetime(2026, 1, 1),
        )
        s.add_all([j, d, t, p])
        await s.commit()


# --- GET /api/teams/{slug} ---

async def test_team_by_slug_returns_team(client, fresh_session):
    await _seed_full(fresh_session)

    resp = await client.get("/api/teams/tm-alpha-team")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "tm-alpha-team"
    assert data["name"] == "Teams Alpha Team"


async def test_team_by_slug_returns_404_for_unknown(client):
    resp = await client.get("/api/teams/no-such-team")
    assert resp.status_code == 404
    assert "no-such-team" in resp.json()["detail"]


# --- GET /api/teams/{slug}/products ---

async def test_team_products_returns_products(client, fresh_session):
    await _seed_full(fresh_session)

    resp = await client.get("/api/teams/tm-alpha-team/products")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["slug"] == "tm-sign-in"


async def test_team_products_returns_empty_for_unknown_team(client):
    resp = await client.get("/api/teams/no-such-team/products")
    assert resp.status_code == 200
    assert resp.json() == []
