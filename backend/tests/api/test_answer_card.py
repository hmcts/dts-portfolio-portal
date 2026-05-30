"""Integration tests for POST /api/answer-card.

The AI synthesis function is replaced with a single shallow stub per test
(unittest.mock.patch on the function reference in the router module). No
MagicMock chains — just a plain async function returning a canned dict.
"""

from unittest.mock import AsyncMock, patch

VALID_PAYLOAD = {
    "query": "who runs sign in?",
    "results": [
        {
            "entityType": "product",
            "name": "Sign In",
            "description": "Identity flows for Crime services.",
            "href": "/p/sign-in",
        }
    ],
}


async def test_answer_card_returns_synthesised_response(client):
    fake = {
        "source": "azure-openai",
        "answer": "Sign In runs identity flows for Crime services.",
        "citations": [0],
    }
    with patch(
        "app.api.answer_card.synthesise_answer_card",
        new=AsyncMock(return_value=fake),
    ):
        resp = await client.post("/api/answer-card", json=VALID_PAYLOAD)

    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "azure-openai"
    assert body["answer"].startswith("Sign In")
    assert body["citations"] == [0]


async def test_answer_card_returns_503_when_aoai_unconfigured(client):
    async def _boom(*_args, **_kwargs):  # type: ignore[return]
        raise RuntimeError("Azure OpenAI not configured")

    with patch("app.api.answer_card.synthesise_answer_card", new=_boom):
        resp = await client.post("/api/answer-card", json=VALID_PAYLOAD)

    assert resp.status_code == 503
    assert "Azure OpenAI not configured" in resp.json()["detail"]


async def test_answer_card_returns_unavailable_when_model_declines(client):
    fake = {
        "source": "unavailable",
        "answer": None,
        "reason": "Model declined to answer (insufficient grounding)",
    }
    with patch(
        "app.api.answer_card.synthesise_answer_card",
        new=AsyncMock(return_value=fake),
    ):
        resp = await client.post("/api/answer-card", json=VALID_PAYLOAD)

    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "unavailable"
    assert body["answer"] is None
    assert "declined" in body["reason"]


async def test_answer_card_rejects_missing_query(client):
    resp = await client.post("/api/answer-card", json={"results": []})
    assert resp.status_code == 422


async def test_answer_card_rejects_empty_query(client):
    resp = await client.post("/api/answer-card", json={"query": "", "results": []})
    assert resp.status_code == 422


async def test_answer_card_rejects_query_over_500_chars(client):
    resp = await client.post(
        "/api/answer-card",
        json={"query": "a" * 501, "results": []},
    )
    assert resp.status_code == 422


async def test_answer_card_rejects_more_than_20_results(client):
    too_many = [{"entityType": "product", "name": f"Result {i}"} for i in range(21)]
    resp = await client.post(
        "/api/answer-card",
        json={"query": "q", "results": too_many},
    )
    assert resp.status_code == 422
