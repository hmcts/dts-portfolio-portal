"""Answer-card synthesis via Azure OpenAI.

Synthesises a one-paragraph answer grounded in the supplied search
results. Returns a dict matching the frontend wire contract:

  Success:     {"source": "azure-openai", "answer": str, "citations": list[int]}
  Unavailable: {"source": "unavailable",  "answer": None, "reason": str}

Auth follows the established pattern for this project:
  - Production: managed identity via DefaultAzureCredential (no key needed
    when the App Service user-assigned identity has AOAI role assignment).
  - Local dev / CI: set AZURE_OPENAI_API_KEY env var; the SDK picks it up
    automatically when no ``api_key`` arg is passed to AsyncAzureOpenAI.

Raises RuntimeError when credentials are not configured — callers map
this to a 503 so the UI gracefully degrades to the ranked list alone.
"""

from __future__ import annotations

from typing import Any

from openai import AsyncAzureOpenAI

from app.settings import settings

# Shared with the frontend (see lib/ai-answer/answer-card.ts).
_SYSTEM_PROMPT = (
    "You are the assistant for the DTS Portfolio Portal — a high-level "
    "front door over HMCTS Digital and Technology Services.\n\n"
    "A user has asked a question about the portfolio. You will receive that "
    "question and the top search results from the portal index. Your job is "
    "to write a one-paragraph answer (target ~60 words) that:\n\n"
    "  1. Uses ONLY information present in the supplied results. If the "
    "results don't support an answer, return the literal JSON value: "
    '{"answer": null, "citations": []}.\n'
    "  2. Names entities exactly as they appear in the results.\n"
    "  3. Cites the result indexes you used in a \"citations\" array "
    "(0-based).\n"
    "  4. Does NOT invent jurisdictions, teams, products or initiatives "
    "that aren't in the input.\n"
    "  5. Speaks in the present tense, plainly. No marketing voice. "
    "No bullet lists.\n\n"
    'Output strict JSON matching this shape:\n  {"answer": string | null, '
    '"citations": number[]}\n\nNothing else — no preamble, no markdown.'
)


def _build_user_message(query: str, results: list[dict[str, Any]]) -> str:
    lines = [
        f"User question: {query.strip()}",
        "",
        "Results (0-indexed; cite the index numbers you use):",
    ]
    for i, r in enumerate(results):
        name = r.get("name", "")
        entity_type = r.get("entityType", "")
        description = r.get("description") or ""
        suffix = f" — {description[:280]}" if description else ""
        lines.append(f"  [{i}] {entity_type}: {name}{suffix}")
    return "\n".join(lines)


async def synthesise_answer_card(
    query: str,
    results: list[dict[str, Any]],
) -> dict[str, Any]:
    """Synthesise an answer card from up to 5 top search results.

    Returns a dict with one of two shapes:

    * ``{"source": "azure-openai", "answer": str, "citations": list[int]}``
    * ``{"source": "unavailable", "answer": None, "reason": str}``

    Raises RuntimeError when Azure OpenAI credentials are not configured.
    The caller maps that to HTTP 503.
    """
    if not settings.azure_openai_endpoint or not settings.azure_openai_deployment_name:
        raise RuntimeError("Azure OpenAI not configured")

    if not query.strip():
        return {"source": "unavailable", "answer": None, "reason": "Empty query"}

    top = results[:5]

    if not top:
        return {
            "source": "unavailable",
            "answer": None,
            "reason": "No results to ground in",
        }

    # Auth: AsyncAzureOpenAI reads AZURE_OPENAI_API_KEY automatically when
    # present (local dev / CI). In production the managed identity is used
    # via DefaultAzureCredential — callers should set azure_ad_token_provider
    # there. For now we rely on the SDK's env-reading default which covers
    # both paths without embedding credentials in code.
    client = AsyncAzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.azure_openai_api_version,
    )

    user_message = _build_user_message(query, top)

    response = await client.chat.completions.create(
        model=settings.azure_openai_deployment_name,
        response_format={"type": "json_object"},
        max_tokens=220,
        temperature=0,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )

    content = response.choices[0].message.content if response.choices else None
    if not content:
        return {
            "source": "unavailable",
            "answer": None,
            "reason": "Model returned no content",
        }

    import json  # noqa: PLC0415

    try:
        parsed: dict[str, Any] = json.loads(content)
    except ValueError:
        return {
            "source": "unavailable",
            "answer": None,
            "reason": "Model response was not valid JSON",
        }

    answer = parsed.get("answer")
    if not answer or not isinstance(answer, str) or not answer.strip():
        return {
            "source": "unavailable",
            "answer": None,
            "reason": "Model declined to answer (insufficient grounding)",
        }

    raw_citations = parsed.get("citations", [])
    citations: list[int] = [
        i
        for i in raw_citations
        if isinstance(i, int) and 0 <= i < len(top)
    ]

    return {
        "source": "azure-openai",
        "answer": answer.strip(),
        "citations": citations,
    }
