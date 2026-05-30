"""Integration tests for GET /api/matrix."""

from datetime import datetime

from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team


async def _seed(fresh_session, jurisdiction_id: str, jurisdiction_slug: str, jurisdiction_name: str) -> None:
    """Seed a minimal jurisdiction → domain → product → initiative chain."""
    async with fresh_session() as s:
        team = Team(
            id=f"t_{jurisdiction_id}",
            slug=f"{jurisdiction_slug}-team",
            name=f"{jurisdiction_name} Team",
            domain_id=f"d_{jurisdiction_id}",
            updated_at=datetime(2026, 1, 1),
        )
        j = Jurisdiction(
            id=jurisdiction_id,
            slug=jurisdiction_slug,
            name=jurisdiction_name,
            updated_at=datetime(2026, 1, 1),
        )
        d = ProductDomain(
            id=f"d_{jurisdiction_id}",
            slug=f"{jurisdiction_slug}-domain",
            name=f"{jurisdiction_name} Domain",
            jurisdiction_id=jurisdiction_id,
            updated_at=datetime(2026, 1, 1),
        )
        p = Product(
            id=f"p_{jurisdiction_id}",
            slug=f"{jurisdiction_slug}-product",
            name=f"{jurisdiction_name} Product",
            domain_id=f"d_{jurisdiction_id}",
            stage="live",
            operating_team_id=f"t_{jurisdiction_id}",
            updated_at=datetime(2026, 1, 1),
        )
        i = Initiative(
            id=f"i_{jurisdiction_id}",
            product_id=f"p_{jurisdiction_id}",
            bucket="NOW",
            title=f"{jurisdiction_name} initiative",
            position=1,
            updated_at=datetime(2026, 1, 1),
        )
        s.add_all([j, team, d, p, i])
        await s.commit()


async def test_matrix_returns_empty_list_when_no_data(client):
    resp = await client.get("/api/matrix")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_matrix_returns_jurisdiction_band_with_correct_shape(client, fresh_session):
    await _seed(fresh_session, "j_api_crime", "api-crime", "API Crime")

    resp = await client.get("/api/matrix")
    assert resp.status_code == 200

    bands = resp.json()
    assert len(bands) == 1
    band = bands[0]

    assert band["jurisdiction"]["slug"] == "api-crime"
    assert band["domain_count"] == 1
    assert band["initiative_count"] == 1

    row = band["rows"][0]
    assert row["domain"]["slug"] == "api-crime-domain"
    assert row["product_count"] == 1

    now_cells = row["cells"]["NOW"]
    assert len(now_cells) == 1
    assert now_cells[0]["title"] == "API Crime initiative"
    assert now_cells[0]["bucket"] == "NOW"
