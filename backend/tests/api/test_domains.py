"""Integration tests for /api/domains/* endpoints."""

from datetime import datetime

from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team


async def _seed_full(fresh_session) -> None:
    """Seed jurisdiction → domain → team + product → initiative chain."""
    async with fresh_session() as s:
        j = Jurisdiction(
            id="j_dom_crime",
            slug="dom-crime",
            name="Domains Crime",
            updated_at=datetime(2026, 1, 1),
        )
        d = ProductDomain(
            id="d_dom_cp",
            slug="dom-common-platform",
            name="Domains Common Platform",
            jurisdiction_id="j_dom_crime",
            updated_at=datetime(2026, 1, 1),
        )
        t = Team(
            id="t_dom_mock",
            slug="dom-mock-team",
            name="Domains Mock Team",
            domain_id="d_dom_cp",
            updated_at=datetime(2026, 1, 1),
        )
        p = Product(
            id="p_dom_sign_in",
            slug="dom-sign-in",
            name="Domains Sign In",
            domain_id="d_dom_cp",
            stage="live",
            operating_team_id="t_dom_mock",
            updated_at=datetime(2026, 1, 1),
        )
        i = Initiative(
            id="i_dom_1",
            product_id="p_dom_sign_in",
            bucket="NOW",
            title="Domains initiative",
            position=1,
            updated_at=datetime(2026, 1, 1),
        )
        s.add_all([j, d, t, p, i])
        await s.commit()


# --- GET /api/domains/{slug} ---

async def test_domain_by_slug_returns_domain(client, fresh_session):
    await _seed_full(fresh_session)

    resp = await client.get("/api/domains/dom-common-platform")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "dom-common-platform"
    assert data["name"] == "Domains Common Platform"


async def test_domain_by_slug_returns_404_for_unknown(client):
    resp = await client.get("/api/domains/does-not-exist")
    assert resp.status_code == 404
    assert "does-not-exist" in resp.json()["detail"]


# --- GET /api/domains/{slug}/products ---

async def test_domain_products_returns_products(client, fresh_session):
    await _seed_full(fresh_session)

    resp = await client.get("/api/domains/dom-common-platform/products")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["slug"] == "dom-sign-in"


async def test_domain_products_returns_empty_for_unknown_domain(client):
    resp = await client.get("/api/domains/no-such-domain/products")
    assert resp.status_code == 200
    assert resp.json() == []


# --- GET /api/domains/{slug}/teams ---

async def test_domain_teams_returns_teams(client, fresh_session):
    await _seed_full(fresh_session)

    resp = await client.get("/api/domains/dom-common-platform/teams")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["slug"] == "dom-mock-team"


async def test_domain_teams_returns_empty_for_unknown_domain(client):
    resp = await client.get("/api/domains/no-such-domain/teams")
    assert resp.status_code == 200
    assert resp.json() == []


# --- GET /api/domains/{slug}/initiatives ---

async def test_domain_initiatives_returns_grouped_by_bucket(client, fresh_session):
    await _seed_full(fresh_session)

    resp = await client.get("/api/domains/dom-common-platform/initiatives")
    assert resp.status_code == 200
    data = resp.json()
    assert "NOW" in data
    assert "NEXT" in data
    assert "LATER" in data
    assert len(data["NOW"]) == 1
    assert data["NOW"][0]["title"] == "Domains initiative"
