from collections.abc import Sequence

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class SearchResult(BaseModel):
    entityType: str  # "jurisdiction" | "domain" | "team" | "product" | "initiative"
    id: str
    slug: str | None
    name: str
    description: str | None
    rank: float
    href: str | None


def _build_href(entity_type: str, slug: str | None) -> str | None:
    if slug is None:
        return None
    match entity_type:
        case "jurisdiction":
            return f"/j/{slug}"
        case "domain":
            return f"/d/{slug}"
        case "team":
            return f"/t/{slug}"
        case "product":
            return f"/p/{slug}"
        case _:
            # Initiatives don't have their own page (spec §3.2)
            return None


# All entity types the portal indexes.
_ALL_TYPES = ("jurisdiction", "domain", "team", "product", "initiative")


def _union_sql(types: Sequence[str]) -> str:
    """Build a UNION ALL query across the requested entity tables."""
    parts: list[str] = []
    type_set = set(types)

    if "jurisdiction" in type_set:
        parts.append(
            """SELECT 'jurisdiction'::text AS "entityType",
                      id,
                      slug,
                      name,
                      description,
                      ts_rank("searchTsv", q.query) AS rank
                 FROM "Jurisdiction", q
                WHERE "searchTsv" @@ q.query"""
        )
    if "domain" in type_set:
        parts.append(
            """SELECT 'domain'::text AS "entityType",
                      id,
                      slug,
                      name,
                      description,
                      ts_rank("searchTsv", q.query) AS rank
                 FROM "ProductDomain", q
                WHERE "searchTsv" @@ q.query"""
        )
    if "team" in type_set:
        parts.append(
            """SELECT 'team'::text AS "entityType",
                      id,
                      slug,
                      name,
                      description,
                      ts_rank("searchTsv", q.query) AS rank
                 FROM "Team", q
                WHERE "searchTsv" @@ q.query"""
        )
    if "product" in type_set:
        parts.append(
            """SELECT 'product'::text AS "entityType",
                      id,
                      slug,
                      name,
                      description,
                      ts_rank("searchTsv", q.query) AS rank
                 FROM "Product", q
                WHERE "searchTsv" @@ q.query"""
        )
    if "initiative" in type_set:
        parts.append(
            """SELECT 'initiative'::text AS "entityType",
                      id,
                      NULL::text AS slug,
                      title AS name,
                      description,
                      ts_rank("searchTsv", q.query) AS rank
                 FROM "Initiative", q
                WHERE "searchTsv" @@ q.query"""
        )

    if not parts:
        return ""

    union = "\nUNION ALL\n".join(parts)
    # S608: parts contain only hardcoded table/column literals — no user input.
    # All user-supplied values are passed as bound parameters (:query, :limit).
    return f"""
        WITH q AS (SELECT websearch_to_tsquery('english', :query) AS query)
        SELECT * FROM (
            {union}
        ) hits
        ORDER BY rank DESC, name ASC
        LIMIT :limit
    """  # noqa: S608


async def fts_search(
    session: AsyncSession,
    query: str,
    limit: int = 25,
    types: Sequence[str] | None = None,
) -> list[SearchResult]:
    """Full-text search across entity tables using the ``searchTsv`` generated column.

    Returns results ranked by ``ts_rank``, highest first.
    An empty query always returns an empty list.
    """
    if not query.strip():
        return []

    effective_types = list(types) if types is not None else list(_ALL_TYPES)
    sql_str = _union_sql(effective_types)
    if not sql_str:
        return []

    rows = await session.execute(
        text(sql_str),
        {"query": query, "limit": limit},
    )

    results: list[SearchResult] = []
    for entity_type, row_id, slug, name, description, rank in rows.all():
        results.append(
            SearchResult(
                entityType=entity_type,
                id=row_id,
                slug=slug,
                name=name,
                description=description,
                rank=float(rank),
                href=_build_href(entity_type, slug),
            )
        )
    return results
