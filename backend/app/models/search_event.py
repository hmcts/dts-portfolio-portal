from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, Text, text
from sqlmodel import Field, SQLModel


class SearchEvent(SQLModel, table=True):
    """Append-only search event log. Rows are written server-side on every
    /api/search request and client-side on result clicks. Read by the ops
    dashboard at /ops/search."""

    __tablename__ = "SearchEvent"  # type: ignore[assignment]
    __table_args__ = (
        Index("SearchEvent_createdAt_idx", "createdAt"),
        Index("SearchEvent_kind_createdAt_idx", "kind", "createdAt"),
        Index("SearchEvent_query_idx", "query"),
    )

    id: str = Field(sa_column=Column("id", Text, primary_key=True, nullable=False))
    created_at: datetime = Field(
        sa_column=Column(
            "createdAt",
            DateTime(timezone=False),
            nullable=False,
            server_default=text("CURRENT_TIMESTAMP"),
        )
    )
    kind: str = Field(sa_column=Column("kind", Text, nullable=False))
    query: str = Field(sa_column=Column("query", Text, nullable=False))
    result_count: int | None = Field(
        default=None,
        sa_column=Column("resultCount", Integer, nullable=True),
    )
    clicked_entity_type: str | None = Field(
        default=None,
        sa_column=Column("clickedEntityType", Text, nullable=True),
    )
    clicked_entity_id: str | None = Field(
        default=None,
        sa_column=Column("clickedEntityId", Text, nullable=True),
    )
    clicked_position: int | None = Field(
        default=None,
        sa_column=Column("clickedPosition", Integer, nullable=True),
    )
    subject_hash: str | None = Field(
        default=None,
        sa_column=Column("subjectHash", Text, nullable=True),
    )
