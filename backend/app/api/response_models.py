"""Richer Pydantic response models for API endpoints.

These extend the base SQLModel table classes with relationship fields that the
ORM eager-loads but that are not declared on the table model itself (to avoid
circular-import chains).  They are used as ``response_model=`` in the router
so FastAPI serialises only the declared fields rather than whatever SQLAlchemy
decides to include.
"""

from pydantic import BaseModel


class OutboundLinkOut(BaseModel):
    """Serialisable outbound link — mirrors the OutboundLink table model."""

    id: str
    product_id: str
    label: str
    url: str
    position: int

    model_config = {"from_attributes": True}


class ProductDetail(BaseModel):
    """Richer Product response — includes outbound_links and consumed_by slugs."""

    id: str
    slug: str
    name: str
    description: str | None
    stage: str
    domain_id: str
    operating_team_id: str | None
    outbound_links: list[OutboundLinkOut] = []
    consumed_by: list[str] = []   # Jurisdiction slugs

    model_config = {"from_attributes": True}


class StrategicThemeOut(BaseModel):
    """Serialisable strategic theme — mirrors the StrategicTheme (Theme) table model."""

    id: str
    title: str
    description: str | None
    domain_id: str
    position: int

    model_config = {"from_attributes": True}


class DomainDetail(BaseModel):
    """Richer ProductDomain response — includes strategic_themes."""

    id: str
    slug: str
    name: str
    description: str | None
    jurisdiction_id: str
    strategic_themes: list[StrategicThemeOut] = []

    model_config = {"from_attributes": True}


class ConsumedProduct(BaseModel):
    """Product consumed by a Jurisdiction — enriched with parent domain info."""

    id: str
    slug: str
    name: str
    description: str | None
    stage: str
    domain_slug: str
    domain_name: str

    model_config = {"from_attributes": True}
