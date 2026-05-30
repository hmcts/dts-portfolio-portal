"""Integration tests for GET /api/activity."""


async def test_activity_returns_list(client):
    resp = await client.get("/api/activity")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0


async def test_activity_entries_have_required_fields(client):
    resp = await client.get("/api/activity")
    assert resp.status_code == 200
    entry = resp.json()[0]
    assert "id" in entry
    assert "subject" in entry
    assert "subject_href" in entry
    assert "description" in entry
    assert "kind" in entry
    assert "approver" in entry
    assert "approved_at" in entry


async def test_activity_default_limit_is_ten(client):
    resp = await client.get("/api/activity")
    assert resp.status_code == 200
    # Seed has 5 entries; default limit of 10 returns all of them
    data = resp.json()
    assert len(data) == 5


async def test_activity_respects_limit_param(client):
    resp = await client.get("/api/activity?limit=2")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_activity_entries_sorted_most_recent_first(client):
    resp = await client.get("/api/activity")
    assert resp.status_code == 200
    entries = resp.json()
    dates = [e["approved_at"] for e in entries]
    assert dates == sorted(dates, reverse=True)


async def test_activity_limit_below_one_is_rejected(client):
    resp = await client.get("/api/activity?limit=0")
    assert resp.status_code == 422


async def test_activity_limit_above_100_is_rejected(client):
    resp = await client.get("/api/activity?limit=101")
    assert resp.status_code == 422
