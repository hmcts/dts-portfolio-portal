from datetime import datetime

from sqlalchemy import Column, Computed, DateTime, String, text
from sqlmodel import Field, SQLModel


class Jurisdiction(SQLModel, table=True):
    __tablename__ = "Jurisdiction"  # type: ignore[assignment]

    id: str = Field(primary_key=True)
    slug: str = Field(sa_column=Column("slug", String, nullable=False, unique=True))
    name: str
    description: str | None = None
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
