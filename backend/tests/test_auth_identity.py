"""Tests for the current_identity dependency.

Uses a minimal ad-hoc FastAPI app rather than the main application, so
these tests have no database dependency and run in isolation.
"""

from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.identity import Identity, current_identity


def _make_app() -> FastAPI:
    app = FastAPI()

    @app.get("/who")
    def who(identity: Identity = Depends(current_identity)) -> dict[str, str | None]:
        return {"email": identity.email, "subject_id": identity.subject_id}

    return app


async def test_identity_falls_back_to_anonymous_when_no_headers():
    transport = ASGITransport(app=_make_app())
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/who")
    assert resp.status_code == 200
    assert resp.json() == {"email": None, "subject_id": None}


async def test_identity_picks_up_forwarded_headers():
    transport = ASGITransport(app=_make_app())
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get(
            "/who",
            headers={
                "X-Forwarded-Email": "duncan.crawford.test@example.com",
                "X-Forwarded-User": "user-abc-123",
            },
        )
    assert resp.status_code == 200
    assert resp.json() == {
        "email": "duncan.crawford.test@example.com",
        "subject_id": "user-abc-123",
    }
