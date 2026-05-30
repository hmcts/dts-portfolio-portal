"""Integration tests for GET /api/sidebar/jurisdictions."""

from datetime import datetime

from app.models.jurisdiction import Jurisdiction
from app.models.product_domain import ProductDomain


async def test_sidebar_returns_empty_list_when_no_data(client):
    resp = await client.get("/api/sidebar/jurisdictions")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_sidebar_returns_jurisdiction_with_domains(client, fresh_session):
    async with fresh_session() as s:
        j = Jurisdiction(
            id="j_sb_crime",
            slug="sb-crime",
            name="Sidebar Crime",
            updated_at=datetime(2026, 1, 1),
        )
        d1 = ProductDomain(
            id="d_sb_cp",
            slug="sb-common-platform",
            name="Sidebar Common Platform",
            jurisdiction_id="j_sb_crime",
            updated_at=datetime(2026, 1, 1),
        )
        d2 = ProductDomain(
            id="d_sb_hm",
            slug="sb-hearings",
            name="Sidebar Hearings",
            jurisdiction_id="j_sb_crime",
            updated_at=datetime(2026, 1, 1),
        )
        s.add_all([j, d1, d2])
        await s.commit()

    resp = await client.get("/api/sidebar/jurisdictions")
    assert resp.status_code == 200

    data = resp.json()
    assert len(data) == 1
    item = data[0]
    assert item["slug"] == "sb-crime"
    assert item["name"] == "Sidebar Crime"
    assert item["count"] == 2
    assert len(item["domains"]) == 2
    # Domains should be sorted alphabetically by name
    domain_names = [d["name"] for d in item["domains"]]
    assert domain_names == sorted(domain_names)
