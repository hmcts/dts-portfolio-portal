from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKeyConstraint, Index, Integer, Text, text
from sqlalchemy import Computed as SAComputed
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlmodel import Field, SQLModel

# ProductStage enum values. create_type=False: the type already exists via
# the baseline migration.
_PRODUCT_STAGE_ENUM = Enum(
    "discovery",
    "alpha",
    "beta",
    "live",
    "retiring",
    "retired",
    name="ProductStage",
    create_type=False,
)


class Product(SQLModel, table=True):
    __tablename__ = "Product"  # type: ignore[assignment]
    __table_args__ = (
        Index("Product_slug_key", "slug", unique=True),
        Index("Product_domainId_idx", "domainId"),
        Index("Product_operatingTeamId_idx", "operatingTeamId"),
        Index("Product_searchTsv_idx", "searchTsv", postgresql_using="gin"),
        ForeignKeyConstraint(
            ["domainId"],
            ["ProductDomain.id"],
            name="Product_domainId_fkey",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["operatingTeamId"],
            ["Team.id"],
            name="Product_operatingTeamId_fkey",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
    )

    id: str = Field(sa_column=Column("id", Text, primary_key=True, nullable=False))
    slug: str = Field(sa_column=Column("slug", Text, nullable=False))
    name: str = Field(sa_column=Column("name", Text, nullable=False))
    description: str | None = Field(
        default=None, sa_column=Column("description", Text, nullable=True)
    )
    stage: str = Field(
        sa_column=Column(
            "stage",
            _PRODUCT_STAGE_ENUM,
            nullable=False,
            server_default=text("'discovery'::\"ProductStage\""),
        )
    )
    domain_id: str = Field(sa_column=Column("domainId", Text, nullable=False))
    operating_team_id: str = Field(
        sa_column=Column("operatingTeamId", Text, nullable=False)
    )
    last_approved_at: datetime | None = Field(
        default=None,
        sa_column=Column("lastApprovedAt", DateTime(timezone=False), nullable=True),
    )
    last_approved_by: str | None = Field(
        default=None,
        sa_column=Column("lastApprovedBy", Text, nullable=True),
    )
    version_number: int = Field(
        sa_column=Column(
            "versionNumber",
            Integer,
            nullable=False,
            server_default=text("1"),
        )
    )
    created_at: datetime = Field(
        sa_column=Column(
            "createdAt",
            DateTime(timezone=False),
            nullable=False,
            server_default=text("CURRENT_TIMESTAMP"),
        )
    )
    updated_at: datetime = Field(
        sa_column=Column("updatedAt", DateTime(timezone=False), nullable=False)
    )
    search_tsv: str | None = Field(
        default=None,
        sa_column=Column(
            "searchTsv",
            TSVECTOR,
            SAComputed(
                "(setweight(to_tsvector('english'::regconfig, COALESCE(name, ''::text)), "
                "'A'::\"char\") || setweight(to_tsvector('english'::regconfig, "
                "COALESCE(description, ''::text)), 'B'::\"char\"))",
                persisted=True,
            ),
            nullable=True,
        ),
    )


class OutboundLink(SQLModel, table=True):
    __tablename__ = "OutboundLink"  # type: ignore[assignment]
    __table_args__ = (
        Index("OutboundLink_productId_idx", "productId"),
        ForeignKeyConstraint(
            ["productId"],
            ["Product.id"],
            name="OutboundLink_productId_fkey",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
    )

    id: str = Field(sa_column=Column("id", Text, primary_key=True, nullable=False))
    product_id: str = Field(sa_column=Column("productId", Text, nullable=False))
    label: str = Field(sa_column=Column("label", Text, nullable=False))
    url: str = Field(sa_column=Column("url", Text, nullable=False))
    position: int = Field(
        sa_column=Column("position", Integer, nullable=False, server_default=text("0"))
    )
