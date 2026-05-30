"""Answer-card POST endpoint — forwards to the AI synthesis module.

Wire contract (shared with the frontend search overlay):

  Request body:
    { "query": str, "results": list[ResultInput] }

  ResultInput:
    { "entityType": str, "name": str, "description"?: str|null, "href"?: str|null }

  Response (always HTTP 200 when AOAI is configured):
    Success:     { "source": "azure-openai", "answer": str, "citations": list[int] }
    Unavailable: { "source": "unavailable",  "answer": null, "reason": str }

  HTTP 503 when Azure OpenAI credentials are not configured.
  HTTP 400 when the request body is invalid.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ai.answer_card import synthesise_answer_card

router = APIRouter(prefix="/api", tags=["answer-card"])


class ResultInput(BaseModel):
    entityType: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=280)
    description: str | None = Field(default=None, max_length=2_000)
    href: str | None = Field(default=None, max_length=500)


class AnswerCardRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    # Hard cap — the card summarises the top results, not the whole corpus.
    results: list[ResultInput] = Field(max_length=20)


class AnswerCardResponse(BaseModel):
    source: str
    answer: str | None
    reason: str | None = None
    citations: list[int] | None = None


@router.post("/answer-card", response_model=AnswerCardResponse)
async def answer_card(payload: AnswerCardRequest) -> AnswerCardResponse:
    raw_results: list[dict[str, Any]] = [r.model_dump() for r in payload.results]
    try:
        result = await synthesise_answer_card(payload.query, raw_results)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return AnswerCardResponse(**result)
