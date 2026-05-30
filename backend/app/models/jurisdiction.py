from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Text, text
from sqlalchemy import Computed as SAComputed
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlmodel import Field, SQLModel


class Jurisdiction(SQLModel, table=True):
    __tablename__ = "Jurisdiction"  # type: ignore[assignment]
    __table_args__ = (
        Index("Jurisdiction_slug_key", "slug", unique=True),
        Index("Jurisdiction_searchTsv_idx", "searchTsv", postgresql_using="gin"),
    )

    id: str = Field(sa_column=Column("id", Text, primary_key=True, nullable=False))
    slug: str = Field(sa_column=Column("slug", Text, nullable=False))
    name: str = Field(sa_column=Column("name", Text, nullable=False))
    description: str | None = Field(
        default=None, sa_column=Column("description", Text, nullable=True)
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
