from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, Text, text
from sqlmodel import Field, SQLModel


class AiParseMetric(SQLModel, table=True):
    """Append-only per-parse metric record. One row per AI parser invocation.
    Guarded by a DB trigger that rejects UPDATE and DELETE."""

    __tablename__ = "AiParseMetric"  # type: ignore[assignment]
    __table_args__ = (
        Index("AiParseMetric_createdAt_idx", "createdAt"),
        Index("AiParseMetric_source_outcome_idx", "source", "outcome"),
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
    source: str = Field(sa_column=Column("source", Text, nullable=False))
    model: str | None = Field(
        default=None, sa_column=Column("model", Text, nullable=True)
    )
    outcome: str = Field(sa_column=Column("outcome", Text, nullable=False))
    prompt_tokens: int | None = Field(
        default=None,
        sa_column=Column("promptTokens", Integer, nullable=True),
    )
    completion_tokens: int | None = Field(
        default=None,
        sa_column=Column("completionTokens", Integer, nullable=True),
    )
    total_tokens: int | None = Field(
        default=None,
        sa_column=Column("totalTokens", Integer, nullable=True),
    )
    latency_ms: int = Field(
        sa_column=Column("latencyMs", Integer, nullable=False)
    )
    failure_reason: str | None = Field(
        default=None,
        sa_column=Column("failureReason", Text, nullable=True),
    )
    submission_id: str | None = Field(
        default=None,
        sa_column=Column("submissionId", Text, nullable=True),
    )
