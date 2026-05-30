from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKeyConstraint, Index, Integer, Text, text
from sqlalchemy import Computed as SAComputed
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlmodel import Field, SQLModel

# TimeBucket enum values. create_type=False: the type already exists via
# the baseline migration.
_TIME_BUCKET_ENUM = Enum(
    "NOW",
    "NEXT",
    "LATER",
    name="TimeBucket",
    create_type=False,
)


class Initiative(SQLModel, table=True):
    __tablename__ = "Initiative"  # type: ignore[assignment]
    __table_args__ = (
        Index("Initiative_productId_bucket_idx", "productId", "bucket"),
        Index("Initiative_searchTsv_idx", "searchTsv", postgresql_using="gin"),
        ForeignKeyConstraint(
            ["productId"],
            ["Product.id"],
            name="Initiative_productId_fkey",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
    )

    id: str = Field(sa_column=Column("id", Text, primary_key=True, nullable=False))
    product_id: str = Field(sa_column=Column("productId", Text, nullable=False))
    bucket: str = Field(
        sa_column=Column("bucket", _TIME_BUCKET_ENUM, nullable=False)
    )
    title: str = Field(sa_column=Column("title", Text, nullable=False))
    description: str | None = Field(
        default=None, sa_column=Column("description", Text, nullable=True)
    )
    outbound_url: str | None = Field(
        default=None,
        sa_column=Column("outboundUrl", Text, nullable=True),
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
            TSVECTOR,
            SAComputed(
                "(setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), "
                "'A'::\"char\") || setweight(to_tsvector('english'::regconfig, "
                "COALESCE(description, ''::text)), 'C'::\"char\"))",
                persisted=True,
            ),
            nullable=True,
        ),
    )
