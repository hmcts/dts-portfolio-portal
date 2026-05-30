from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKeyConstraint, Index, Integer, Text, text
from sqlalchemy import Computed as SAComputed
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlmodel import Field, SQLModel


class ProductDomain(SQLModel, table=True):
    __tablename__ = "ProductDomain"  # type: ignore[assignment]
    __table_args__ = (
        Index("ProductDomain_slug_key", "slug", unique=True),
        Index("ProductDomain_jurisdictionId_idx", "jurisdictionId"),
        Index("ProductDomain_searchTsv_idx", "searchTsv", postgresql_using="gin"),
        ForeignKeyConstraint(
            ["jurisdictionId"],
            ["Jurisdiction.id"],
            name="ProductDomain_jurisdictionId_fkey",
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
    jurisdiction_id: str = Field(
        sa_column=Column("jurisdictionId", Text, nullable=False)
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
                "COALESCE(description, ''::text)), 'C'::\"char\"))",
                persisted=True,
            ),
            nullable=True,
        ),
    )


class StrategicTheme(SQLModel, table=True):
    """Corresponds to the 'Theme' table created by the Prisma schema."""

    __tablename__ = "Theme"  # type: ignore[assignment]
    __table_args__ = (
        Index("Theme_domainId_idx", "domainId"),
        ForeignKeyConstraint(
            ["domainId"],
            ["ProductDomain.id"],
            name="Theme_domainId_fkey",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
    )

    id: str = Field(sa_column=Column("id", Text, primary_key=True, nullable=False))
    title: str = Field(sa_column=Column("title", Text, nullable=False))
    description: str | None = Field(
        default=None, sa_column=Column("description", Text, nullable=True)
    )
    domain_id: str = Field(sa_column=Column("domainId", Text, nullable=False))
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
