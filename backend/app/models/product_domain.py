from datetime import datetime

from sqlalchemy import Column, Computed, DateTime, Integer, String, text
from sqlmodel import Field, SQLModel


class ProductDomain(SQLModel, table=True):
    __tablename__ = "ProductDomain"  # type: ignore[assignment]

    id: str = Field(primary_key=True)
    slug: str = Field(sa_column=Column("slug", String, nullable=False, unique=True))
    name: str
    description: str | None = None
    jurisdiction_id: str = Field(
        sa_column=Column("jurisdictionId", String, nullable=False, index=True)
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
                "|| setweight(to_tsvector('english'::regconfig, COALESCE(description, '')), 'C')",
                persisted=True,
            ),
            nullable=True,
        ),
    )


class StrategicTheme(SQLModel, table=True):
    """Corresponds to the 'Theme' table created by the Prisma schema."""

    __tablename__ = "Theme"  # type: ignore[assignment]

    id: str = Field(primary_key=True)
    title: str
    description: str | None = None
    domain_id: str = Field(
        sa_column=Column("domainId", String, nullable=False, index=True)
    )
    position: int = Field(
        sa_column=Column("position", Integer, nullable=False, server_default=text("0"))
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
