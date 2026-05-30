from datetime import datetime

from sqlalchemy import Column, Computed, DateTime, String, text
from sqlmodel import Field, SQLModel


class Team(SQLModel, table=True):
    __tablename__ = "Team"  # type: ignore[assignment]

    id: str = Field(primary_key=True)
    slug: str = Field(sa_column=Column("slug", String, nullable=False, unique=True))
    name: str
    description: str | None = None
    contact: str | None = None
    domain_id: str = Field(
        sa_column=Column("domainId", String, nullable=False, index=True)
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
                "|| setweight(to_tsvector('english'::regconfig, COALESCE(description, '')), 'B') "
                "|| setweight(to_tsvector('english'::regconfig, COALESCE(contact, '')), 'D')",
                persisted=True,
            ),
            nullable=True,
        ),
    )
