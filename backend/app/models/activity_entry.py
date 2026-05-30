"""Activity feed entries.

The current Postgres schema does not have an ActivityEntry table. The
home-page "Latest approved changes" feed is sourced from a hand-curated
seed module (mirrors the frontend's `lib/portal-data-seed.ts` until the
write-path port lands and the audit log can feed it).

When the write-path rewrite ships, this becomes a SQLModel backed by
the audit log; for now it's a pure Pydantic response shape so the
read-path endpoint in Group F has typed data to return.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

ActivityKind = Literal["roadmap-update", "new-chip", "stage-change", "theme-update"]


class ActivityEntry(BaseModel):
    """Single audit-log-shaped entry for the home page activity feed.

    Not a SQLModel because no `ActivityEntry` table exists in the schema
    yet — see module docstring.
    """

    id: str
    subject: str
    subject_href: str
    description: str
    kind: ActivityKind
    approver: str
    approved_at: datetime
