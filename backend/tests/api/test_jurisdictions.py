"""Integration tests for /api/jurisdictions/* endpoints."""

from datetime import datetime

from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team


async def _seed_jurisdiction(fresh_session, jid: str, slug: str, name: str) -> None:
    async with fresh_session() as s:
        s.add(Jurisdiction(id=jid, slug=slug, name=name, updated_at=datetime(2026, 1, 1)))
        await s.commit()


async def _seed_full(fresh_session) -> None:
    """Seed jurisdiction → domain → team → product chain."""
    async with fresh_session() as s:
        j = Jurisdiction(
            id="j_jur_crime",
            slug="jur-crime",
            name="Jurisdictions Crime",
            updated_at=datetime(2026, 1, 1),
        )
        d = ProductDomain(
            id="d_jur_cp",
            slug="jur-common-platform",
            name="Jurisdictions Common Platform",
            jurisdiction_id="j_jur_crime",
            updated_at=datetime(2026, 1, 1),
        )
        t = Team(
            id="t_jur_mock",
            slug="jur-mock-team",
            name="Jurisdictions Mock Team",
            domain_id="d_jur_cp",
            updated_at=datetime(2026, 1, 1),
        )
        p = Product(
            id="p_jur_sign_in",
            slug="jur-sign-in",
            name="Jurisdictions Sign In",
            domain_id="d_jur_cp",
            stage="live",
            operating_team_id="t_jur_mock",
            updated_at=datetime(2026, 1, 1),
        )
        s.add_all([j, d, t, p])
        await s.commit()


# --- GET /api/jurisdictions/{slug} ---

async def test_jurisdiction_by_slug_returns_jurisdiction(client, fresh_session):
    await _seed_jurisdiction(fresh_session, "j_jur_civil", "jur-civil", "Jurisdictions Civil")

    resp = await client.get("/api/jurisdictions/jur-civil")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "jur-civil"
    assert data["name"] == "Jurisdictions Civil"


async def test_jurisdiction_by_slug_returns_404_for_unknown(client):
    resp = await client.get("/api/jurisdictions/does-not-exist")
    assert resp.status_code == 404
    assert "does-not-exist" in resp.json()["detail"]


# --- GET /api/jurisdictions/{slug}/domains ---

async def test_domains_returns_list_for_jurisdiction(client, fresh_session):
    await _seed_full(fresh_session)

    resp = await client.get("/api/jurisdictions/jur-crime/domains")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["slug"] == "jur-common-platform"


async def test_domains_returns_empty_list_for_unknown_jurisdiction(client):
    resp = await client.get("/api/jurisdictions/no-such-jurisdiction/domains")
    assert resp.status_code == 200
    assert resp.json() == []


# --- GET /api/jurisdictions/{slug}/consumed-products ---

async def test_consumed_products_returns_empty_list_when_none(client, fresh_session):
    await _seed_jurisdiction(fresh_session, "j_jur_family", "jur-family", "Jurisdictions Family")

    resp = await client.get("/api/jurisdictions/jur-family/consumed-products")
    assert resp.status_code == 200
    assert resp.json() == []
