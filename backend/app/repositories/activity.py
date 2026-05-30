"""Activity feed read helpers.

Returns a hand-curated seed list. The Prisma schema has no ActivityEntry
table; the audit-log-backed equivalent lands when the write-path port
ships. Mirrors the frontend's ``lib/portal-data-seed.ts`` pattern.

Names used below match the plausible fictional HMCTS-flavoured names
already present in the frontend seed data (public-repo discipline: no
real PII, no internal stakeholder names).
"""

from collections.abc import Sequence
from datetime import datetime, timezone

from app.models.activity_entry import ActivityEntry

_SEED: tuple[ActivityEntry, ...] = (
    ActivityEntry(
        id="a-1",
        subject="Common Platform",
        subject_href="/p/common-platform",
        description="Added Java 21 upgrade chip to NOW.",
        kind="roadmap-update",
        approver="Priya Shah",
        approved_at=datetime(2026, 5, 17, 9, 14, tzinfo=timezone.utc),
    ),
    ActivityEntry(
        id="a-2",
        subject="Hearings Management",
        subject_href="/p/hearings-management",
        description="Welsh-interpreter logic fix added to NEXT.",
        kind="new-chip",
        approver="Sam Wright",
        approved_at=datetime(2026, 5, 16, 15, 20, tzinfo=timezone.utc),
    ),
    ActivityEntry(
        id="a-3",
        subject="Resulting Assistant",
        subject_href="/p/resulting-assistant",
        description="Sentence-type picker rewrite moved into NOW.",
        kind="stage-change",
        approver="Tom Frye",
        approved_at=datetime(2026, 5, 14, 11, 2, tzinfo=timezone.utc),
    ),
    ActivityEntry(
        id="a-4",
        subject="Money Claims",
        subject_href="/p/money-claims",
        description="Postgres 17 upgrade added to NOW.",
        kind="roadmap-update",
        approver="Mo Khan",
        approved_at=datetime(2026, 5, 10, 8, 0, tzinfo=timezone.utc),
    ),
    ActivityEntry(
        id="a-5",
        subject="Common Platform Domain",
        subject_href="/d/common-platform",
        description="Edited 'Reduce platform sprawl'.",
        kind="theme-update",
        approver="Priya Shah",
        approved_at=datetime(2026, 5, 9, 13, 30, tzinfo=timezone.utc),
    ),
)


async def get_activity(limit: int = 10) -> Sequence[ActivityEntry]:
    """Return seed-backed activity entries, most-recent-first."""
    return sorted(_SEED, key=lambda e: e.approved_at, reverse=True)[:limit]
