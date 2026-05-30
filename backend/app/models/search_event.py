from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, text
from sqlmodel import Field, SQLModel


class SearchEvent(SQLModel, table=True):
    """Append-only search event log. Rows are written server-side on every
    /api/search request and client-side on result clicks. Read by the ops
    dashboard at /ops/search."""

    __tablename__ = "SearchEvent"  # type: ignore[assignment]

    id: str = Field(primary_key=True)
    created_at: datetime = Field(
        sa_column=Column(
            "createdAt",
            DateTime(timezone=False),
            nullable=False,
            server_default=text("CURRENT_TIMESTAMP"),
        )
    )
    kind: str
    query: str
    result_count: int | None = Field(
        default=None,
        sa_column=Column("resultCount", Integer, nullable=True),
    )
    clicked_entity_type: str | None = Field(
        default=None,
        sa_column=Column("clickedEntityType", String, nullable=True),
    )
    clicked_entity_id: str | None = Field(
        default=None,
        sa_column=Column("clickedEntityId", String, nullable=True),
    )
    clicked_position: int | None = Field(
        default=None,
        sa_column=Column("clickedPosition", Integer, nullable=True),
    )
    subject_hash: str | None = Field(
        default=None,
        sa_column=Column("subjectHash", String, nullable=True),
    )
