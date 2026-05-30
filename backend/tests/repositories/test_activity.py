"""Tests for the activity repository (seed-backed, no DB needed)."""

from app.repositories.activity import get_activity


async def test_activity_returns_most_recent_first():
    entries = await get_activity(limit=10)
    assert len(entries) >= 1
    # Most recent first
    for i in range(len(entries) - 1):
        assert entries[i].approved_at >= entries[i + 1].approved_at


async def test_activity_respects_limit():
    entries = await get_activity(limit=2)
    assert len(entries) == 2


async def test_activity_entries_have_required_fields():
    entries = await get_activity(limit=1)
    assert len(entries) == 1
    entry = entries[0]
    assert entry.id
    assert entry.subject
    assert entry.subject_href.startswith("/")
    assert entry.description
    assert entry.kind in {"roadmap-update", "new-chip", "stage-change", "theme-update"}
    assert entry.approver
    assert entry.approved_at is not None
