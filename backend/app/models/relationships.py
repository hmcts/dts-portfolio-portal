"""SQLModel relationship declarations for eager-loaded reads.

Declared here (rather than inline in each model module) to break the
circular-import chains that arise when e.g. Jurisdiction → ProductDomain →
Product → Initiative all reference each other.

This module must be imported *after* all model classes are defined.  The
``app/models/__init__.py`` does that import as its final statement.

Relationship approach: Approach A — single relationships module using
``back_populates`` string references so that each model file stays
import-free of sibling models.
"""

from __future__ import annotations

from sqlalchemy.orm import relationship

from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import OutboundLink, Product
from app.models.product_domain import ProductDomain, StrategicTheme
from app.models.team import Team

# ---------------------------------------------------------------------------
# Jurisdiction ↔ ProductDomain
# ---------------------------------------------------------------------------
Jurisdiction.domains = relationship(  # type: ignore[attr-defined]
    "ProductDomain",
    back_populates="jurisdiction",
    foreign_keys="[ProductDomain.jurisdiction_id]",
    lazy="noload",
)

ProductDomain.jurisdiction = relationship(  # type: ignore[attr-defined]
    "Jurisdiction",
    back_populates="domains",
    foreign_keys="[ProductDomain.jurisdiction_id]",
    lazy="noload",
)

# ---------------------------------------------------------------------------
# ProductDomain ↔ Product
# ---------------------------------------------------------------------------
ProductDomain.products = relationship(  # type: ignore[attr-defined]
    "Product",
    back_populates="domain",
    foreign_keys="[Product.domain_id]",
    lazy="noload",
)

Product.domain = relationship(  # type: ignore[attr-defined]
    "ProductDomain",
    back_populates="products",
    foreign_keys="[Product.domain_id]",
    lazy="noload",
)

# ---------------------------------------------------------------------------
# ProductDomain ↔ StrategicTheme
# ---------------------------------------------------------------------------
ProductDomain.strategic_themes = relationship(  # type: ignore[attr-defined]
    "StrategicTheme",
    back_populates="domain",
    foreign_keys="[StrategicTheme.domain_id]",
    lazy="noload",
)

StrategicTheme.domain = relationship(  # type: ignore[attr-defined]
    "ProductDomain",
    back_populates="strategic_themes",
    foreign_keys="[StrategicTheme.domain_id]",
    lazy="noload",
)

# ---------------------------------------------------------------------------
# Product ↔ Initiative
# ---------------------------------------------------------------------------
Product.initiatives = relationship(  # type: ignore[attr-defined]
    "Initiative",
    back_populates="product",
    foreign_keys="[Initiative.product_id]",
    lazy="noload",
)

Initiative.product = relationship(  # type: ignore[attr-defined]
    "Product",
    back_populates="initiatives",
    foreign_keys="[Initiative.product_id]",
    lazy="noload",
)

# ---------------------------------------------------------------------------
# Product ↔ OutboundLink
# ---------------------------------------------------------------------------
Product.outbound_links = relationship(  # type: ignore[attr-defined]
    "OutboundLink",
    back_populates="product",
    foreign_keys="[OutboundLink.product_id]",
    lazy="noload",
)

OutboundLink.product = relationship(  # type: ignore[attr-defined]
    "Product",
    back_populates="outbound_links",
    foreign_keys="[OutboundLink.product_id]",
    lazy="noload",
)

# ---------------------------------------------------------------------------
# Team ↔ Product  (operating team)
# ---------------------------------------------------------------------------
Team.products = relationship(  # type: ignore[attr-defined]
    "Product",
    back_populates="operating_team",
    foreign_keys="[Product.operating_team_id]",
    lazy="noload",
)

Product.operating_team = relationship(  # type: ignore[attr-defined]
    "Team",
    back_populates="products",
    foreign_keys="[Product.operating_team_id]",
    lazy="noload",
)

# ---------------------------------------------------------------------------
# Team ↔ ProductDomain  (team's home domain)
# ---------------------------------------------------------------------------
ProductDomain.teams = relationship(  # type: ignore[attr-defined]
    "Team",
    back_populates="domain",
    foreign_keys="[Team.domain_id]",
    lazy="noload",
)

Team.domain = relationship(  # type: ignore[attr-defined]
    "ProductDomain",
    back_populates="teams",
    foreign_keys="[Team.domain_id]",
    lazy="noload",
)
