from datetime import datetime

from sqlalchemy import Column, Computed, DateTime, Enum, Integer, String, text
from sqlmodel import Field, SQLModel

# TimeBucket enum values as defined in the Postgres schema.
# create_type=False because the type already exists via the baseline migration.
_TIME_BUCKET_ENUM = Enum(
    "NOW",
    "NEXT",
    "LATER",
    name="TimeBucket",
    schema="public",
    create_type=False,
)


class Initiative(SQLModel, table=True):
    __tablename__ = "Initiative"  # type: ignore[assignment]

    id: str = Field(primary_key=True)
    product_id: str = Field(
        sa_column=Column("productId", String, nullable=False)
    )
    bucket: str = Field(
        sa_column=Column("bucket", _TIME_BUCKET_ENUM, nullable=False)
    )
    title: str
    description: str | None = None
    outbound_url: str | None = Field(
        default=None,
        sa_column=Column("outboundUrl", String, nullable=True),
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
    search_tsv: str | None = Field(
        default=None,
        sa_column=Column(
            "searchTsv",
            String,
            Computed(
                "setweight(to_tsvector('english'::regconfig, COALESCE(title, '')), 'A') "
                "|| setweight(to_tsvector('english'::regconfig, COALESCE(description, '')), 'C')",
                persisted=True,
            ),
            nullable=True,
        ),
    )
