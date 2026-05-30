from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, text
from sqlmodel import Field, SQLModel


class AiParseMetric(SQLModel, table=True):
    """Append-only per-parse metric record. One row per AI parser invocation.
    Guarded by a DB trigger that rejects UPDATE and DELETE."""

    __tablename__ = "AiParseMetric"  # type: ignore[assignment]

    id: str = Field(primary_key=True)
    created_at: datetime = Field(
        sa_column=Column(
            "createdAt",
            DateTime(timezone=False),
            nullable=False,
            server_default=text("CURRENT_TIMESTAMP"),
        )
    )
    source: str
    model: str | None = None
    outcome: str
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
        sa_column=Column("failureReason", String, nullable=True),
    )
    submission_id: str | None = Field(
        default=None,
        sa_column=Column("submissionId", String, nullable=True),
    )
