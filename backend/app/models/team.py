from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKeyConstraint, Index, Text, text
from sqlalchemy import Computed as SAComputed
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlmodel import Field, SQLModel


class Team(SQLModel, table=True):
    __tablename__ = "Team"  # type: ignore[assignment]
    __table_args__ = (
        Index("Team_slug_key", "slug", unique=True),
        Index("Team_domainId_idx", "domainId"),
        Index("Team_searchTsv_idx", "searchTsv", postgresql_using="gin"),
        ForeignKeyConstraint(
            ["domainId"],
            ["ProductDomain.id"],
            name="Team_domainId_fkey",
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
    contact: str | None = Field(
        default=None, sa_column=Column("contact", Text, nullable=True)
    )
    domain_id: str = Field(sa_column=Column("domainId", Text, nullable=False))
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
                "((setweight(to_tsvector('english'::regconfig, COALESCE(name, ''::text)), "
                "'A'::\"char\") || setweight(to_tsvector('english'::regconfig, "
                "COALESCE(description, ''::text)), 'B'::\"char\")) || "
                "setweight(to_tsvector('english'::regconfig, COALESCE(contact, ''::text)), "
                "'D'::\"char\"))",
                persisted=True,
            ),
            nullable=True,
        ),
    )
