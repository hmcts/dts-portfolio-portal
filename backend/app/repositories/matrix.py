"""Roadmap matrix repository.

Builds the Jurisdiction → Domain → NOW/NEXT/LATER cells structure used
by the roadmap matrix page.
"""

from collections import defaultdict
from collections.abc import Sequence

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain

JURISDICTION_ORDER: tuple[str, ...] = ("crime", "civil", "family", "tribunals", "administrative")


class MatrixInitiative(BaseModel):
    id: str
    product_id: str
    product_name: str
    product_href: str
    bucket: str
    title: str
    description: str | None = None
    outbound_url: str | None = None


class MatrixDomainRow(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    domain: ProductDomain
    product_count: int
    cells: dict[str, list[MatrixInitiative]]


class MatrixJurisdictionBand(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    jurisdiction: Jurisdiction
    domain_count: int
    initiative_count: int
    rows: list[MatrixDomainRow]


def _jurisdiction_rank(slug: str) -> int:
    return JURISDICTION_ORDER.index(slug) if slug in JURISDICTION_ORDER else len(JURISDICTION_ORDER)


async def get_matrix(session: AsyncSession) -> Sequence[MatrixJurisdictionBand]:
    """Return all jurisdictions with their domain rows and bucketed initiative cells."""
    result = await session.execute(
        select(Jurisdiction).options(
            selectinload(Jurisdiction.domains).options(  # type: ignore[attr-defined]
                selectinload(ProductDomain.products).options(  # type: ignore[attr-defined]
                    selectinload(Product.initiatives),  # type: ignore[attr-defined]
                ),
            ),
        ),
    )
    jurisdictions = list(result.scalars().unique())
    jurisdictions.sort(key=lambda j: _jurisdiction_rank(j.slug))

    bands: list[MatrixJurisdictionBand] = []
    for j in jurisdictions:
        ordered_domains = sorted(j.domains, key=lambda d: (-len(d.products), d.name))  # type: ignore[attr-defined]
        rows: list[MatrixDomainRow] = []
        for d in ordered_domains:
            cells: dict[str, list[MatrixInitiative]] = defaultdict(list)
            for p in d.products:  # type: ignore[attr-defined]
                for i in p.initiatives:  # type: ignore[attr-defined]
                    cells[i.bucket].append(
                        MatrixInitiative(
                            id=i.id,
                            product_id=p.id,
                            product_name=p.name,
                            product_href=f"/p/{p.slug}",
                            bucket=i.bucket,
                            title=i.title,
                            description=i.description,
                            outbound_url=i.outbound_url,
                        ),
                    )
            for bucket in ("NOW", "NEXT", "LATER"):
                cells.setdefault(bucket, [])
            rows.append(
                MatrixDomainRow(domain=d, product_count=len(d.products), cells=dict(cells))  # type: ignore[attr-defined]
            )

        bands.append(
            MatrixJurisdictionBand(
                jurisdiction=j,
                domain_count=len(rows),
                initiative_count=sum(len(c) for r in rows for c in r.cells.values()),
                rows=rows,
            ),
        )
    return bands
