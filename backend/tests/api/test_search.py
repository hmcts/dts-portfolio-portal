"""Integration tests for GET /api/search."""

from datetime import datetime

from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team


async def _seed_search_fixtures(fresh_session) -> None:
    """Seed a minimal jurisdiction → domain → team → product chain for FTS tests."""
    async with fresh_session() as s:
        j = Jurisdiction(
            id="j_srch_crime",
            slug="srch-crime",
            name="Search Crime",
            updated_at=datetime(2026, 1, 1),
        )
        d = ProductDomain(
            id="d_srch_cp",
            slug="srch-common-platform",
            name="Search Common Platform Domain",
            jurisdiction_id="j_srch_crime",
            updated_at=datetime(2026, 1, 1),
        )
        t = Team(
            id="t_srch_mock",
            slug="srch-mock-team",
            name="Search Mock Team",
            domain_id="d_srch_cp",
            updated_at=datetime(2026, 1, 1),
        )
        p = Product(
            id="p_srch_sign",
            slug="srch-sign-in",
            name="Sign In",
            description="Identity service for Crime services",
            domain_id="d_srch_cp",
            stage="live",
            operating_team_id="t_srch_mock",
            updated_at=datetime(2026, 1, 1),
        )
        s.add_all([j, d, t, p])
        await s.commit()


async def test_search_returns_matches_for_obvious_query(client, fresh_session):
    await _seed_search_fixtures(fresh_session)

    resp = await client.get("/api/search?q=sign")
    assert resp.status_code == 200
    body = resp.json()
    assert body["query"] == "sign"
    slugs = [r["slug"] for r in body["results"]]
    assert "srch-sign-in" in slugs


async def test_search_empty_query_returns_empty_results(client):
    resp = await client.get("/api/search?q=")
    assert resp.status_code == 200
    body = resp.json()
    assert body["results"] == []
    assert body["query"] == ""


async def test_search_result_includes_href(client, fresh_session):
    await _seed_search_fixtures(fresh_session)

    resp = await client.get("/api/search?q=sign")
    assert resp.status_code == 200
    results = resp.json()["results"]
    product_hit = next((r for r in results if r["slug"] == "srch-sign-in"), None)
    assert product_hit is not None
    assert product_hit["href"] == "/p/srch-sign-in"
    assert product_hit["entityType"] == "product"


async def test_search_type_filter_restricts_results(client, fresh_session):
    await _seed_search_fixtures(fresh_session)

    # Querying for 'search' matches the team and domain seeds but not the product
    # (product name is 'Sign In'). Restrict to product only → empty.
    resp = await client.get("/api/search?q=search&type=product")
    assert resp.status_code == 200
    body = resp.json()
    # The 'Sign In' product won't match 'search'; team/domain would but are filtered out
    for r in body["results"]:
        assert r["entityType"] == "product"


async def test_search_limit_respected(client, fresh_session):
    await _seed_search_fixtures(fresh_session)

    resp = await client.get("/api/search?q=search&limit=1")
    assert resp.status_code == 200
    assert len(resp.json()["results"]) <= 1


async def test_search_limit_above_50_rejected(client):
    resp = await client.get("/api/search?q=foo&limit=51")
    assert resp.status_code == 422


async def test_search_limit_below_1_rejected(client):
    resp = await client.get("/api/search?q=foo&limit=0")
    assert resp.status_code == 422
