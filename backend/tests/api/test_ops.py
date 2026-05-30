"""Integration tests for /api/ops/* endpoints."""

import pytest

# --- GET /api/ops/search-events ---


async def test_search_events_returns_200_on_empty_db(client):
    """Empty tables → 200 with zero totals and empty lists."""
    resp = await client.get("/api/ops/search-events")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_queries"] == 0
    assert data["total_clicks"] == 0
    assert data["zero_result_queries"] == []
    assert data["unclicked_queries"] == []
    assert data["daily_volume"] == []


async def test_search_events_response_has_required_fields(client):
    resp = await client.get("/api/ops/search-events")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_queries" in data
    assert "total_clicks" in data
    assert "zero_result_queries" in data
    assert "unclicked_queries" in data
    assert "daily_volume" in data


async def test_search_events_with_seeded_data(client, fresh_session):
    """Seed one zero-result query and verify it surfaces in the summary."""
    async with fresh_session() as s:
        from sqlalchemy import text

        await s.execute(
            text(
                """
                INSERT INTO "SearchEvent"
                  (id, "createdAt", kind, query, "resultCount")
                VALUES
                  ('se-zr-1', NOW(), 'query', 'missing term', 0)
                """
            )
        )
        await s.commit()

    resp = await client.get("/api/ops/search-events")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_queries"] == 1
    assert data["total_clicks"] == 0
    assert len(data["zero_result_queries"]) == 1
    assert data["zero_result_queries"][0]["query"] == "missing term"
    assert data["zero_result_queries"][0]["occurrences"] == 1


# --- GET /api/ops/ai-parse-metrics ---


async def test_ai_parse_metrics_returns_200_on_empty_db(client):
    """Empty tables → 200 with zero totals and empty daily list."""
    resp = await client.get("/api/ops/ai-parse-metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["today_tokens"] == 0
    assert data["exceeded"] is False
    assert data["total_parses"] == 0
    assert data["total_tokens"] == 0
    assert data["daily_metrics"] == []


async def test_ai_parse_metrics_response_has_required_fields(client):
    resp = await client.get("/api/ops/ai-parse-metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "today_tokens" in data
    assert "budget_tokens_per_day" in data
    assert "exceeded" in data
    assert "total_parses" in data
    assert "total_successes" in data
    assert "total_failures" in data
    assert "total_tokens" in data
    assert "daily_metrics" in data


async def test_ai_parse_metrics_with_seeded_data(client, fresh_session):
    """Seed two parse rows and verify aggregates surface correctly."""
    async with fresh_session() as s:
        from sqlalchemy import text

        await s.execute(
            text(
                """
                INSERT INTO "AiParseMetric"
                  (id, source, outcome, "totalTokens", "latencyMs")
                VALUES
                  ('apm-1', 'azure-openai', 'success', 500, 100),
                  ('apm-2', 'azure-openai', 'failure', 0,   50)
                """
            )
        )
        await s.commit()

    resp = await client.get("/api/ops/ai-parse-metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_parses"] == 2
    assert data["total_successes"] == 1
    assert data["total_failures"] == 1
    assert data["total_tokens"] == 500
    assert data["today_tokens"] == 500
    assert len(data["daily_metrics"]) == 1
    row = data["daily_metrics"][0]
    assert row["source"] == "azure-openai"
    assert row["parse_count"] == 2
    assert row["success_count"] == 1
    assert row["failure_count"] == 1
    assert row["total_tokens"] == 500
