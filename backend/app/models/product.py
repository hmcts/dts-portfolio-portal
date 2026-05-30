from datetime import datetime

from sqlalchemy import Column, Computed, DateTime, Enum, Integer, String, text
from sqlmodel import Field, SQLModel

# ProductStage enum values as defined in the Postgres schema.
# Using create_type=False because the type already exists in the database
# (created by the Prisma-managed baseline migration).
_PRODUCT_STAGE_ENUM = Enum(
    "discovery",
    "alpha",
    "beta",
    "live",
    "retiring",
    "retired",
    name="ProductStage",
    schema="public",
    create_type=False,
)


class Product(SQLModel, table=True):
    __tablename__ = "Product"  # type: ignore[assignment]

    id: str = Field(primary_key=True)
    slug: str = Field(sa_column=Column("slug", String, nullable=False, unique=True))
    name: str
    description: str | None = None
    stage: str = Field(
        sa_column=Column(
            "stage",
            _PRODUCT_STAGE_ENUM,
            nullable=False,
            server_default=text("'discovery'::\"ProductStage\""),
        )
    )
    domain_id: str = Field(
        sa_column=Column("domainId", String, nullable=False, index=True)
    )
    operating_team_id: str = Field(
        sa_column=Column("operatingTeamId", String, nullable=False, index=True)
    )
    last_approved_at: datetime | None = Field(
        default=None,
        sa_column=Column("lastApprovedAt", DateTime(timezone=False), nullable=True),
    )
    last_approved_by: str | None = Field(
        default=None,
        sa_column=Column("lastApprovedBy", String, nullable=True),
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
            String,
            Computed(
                "setweight(to_tsvector('english'::regconfig, COALESCE(name, '')), 'A') "
                "|| setweight(to_tsvector('english'::regconfig, COALESCE(description, '')), 'B')",
                persisted=True,
            ),
            nullable=True,
        ),
    )


class OutboundLink(SQLModel, table=True):
    __tablename__ = "OutboundLink"  # type: ignore[assignment]

    id: str = Field(primary_key=True)
    product_id: str = Field(
        sa_column=Column("productId", String, nullable=False, index=True)
    )
    label: str
    url: str
    position: int = Field(
        sa_column=Column("position", Integer, nullable=False, server_default=text("0"))
    )
