"""baseline

Revision ID: 20260521_0000_baseline
Revises:
Create Date: 2026-05-21 12:00:00.000000

The baseline revision is the canonical schema at the cutover from Prisma to
Alembic. It is generated once from a ``pg_dump --schema-only`` of a Prisma-
migrated database and never modified. Future schema changes are new
revisions on top of this one.
"""

import re
from pathlib import Path

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260521_0000_baseline"
down_revision = None
branch_labels = None
depends_on = None

BASELINE_SQL = Path(__file__).parent.parent / "baseline_dump.sql"

# Matches an opening dollar-quote tag: $$ or $tag$
_DOLLAR_TAG_RE = re.compile(r"\$([^$]*)\$")


def _split_statements(sql: str) -> list[str]:
    """Split a pg_dump DDL script into individual statements.

    A naive split(";") is wrong because plpgsql function bodies delimited by
    $$ … $$ contain semicolons inside the body.  This function tracks whether
    the parser is currently inside a dollar-quoted block and only treats ";"
    as a statement separator when outside one.
    """
    statements: list[str] = []
    current: list[str] = []
    dollar_tag: str | None = None  # None = not inside a dollar-quote block
    i = 0

    while i < len(sql):
        ch = sql[i]

        if dollar_tag is None:
            # Not inside a dollar-quote: look for an opening $tag$.
            m = _DOLLAR_TAG_RE.match(sql, i)
            if m:
                dollar_tag = m.group(0)  # e.g. "$$" or "$body$"
                current.append(dollar_tag)
                i += len(dollar_tag)
                continue
            if ch == ";":
                stmt = "".join(current).strip()
                if stmt:
                    statements.append(stmt)
                current = []
                i += 1
                continue
        else:
            # Inside a dollar-quote: scan for the matching closing tag.
            if sql[i : i + len(dollar_tag)] == dollar_tag:
                current.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
                continue

        current.append(ch)
        i += 1

    # Flush any trailing content (e.g. a final statement without ";").
    trailing = "".join(current).strip()
    if trailing:
        statements.append(trailing)

    return statements


def upgrade() -> None:
    sql = BASELINE_SQL.read_text(encoding="utf-8")
    # Strip lines that are pg_dump preamble noise or psql meta-commands
    # not valid as SQL statements sent via asyncpg:
    #   SET …                  — session-level GUC settings (not needed)
    #   SELECT pg_catalog.…   — search_path reset (env.py owns this)
    #   --                     — SQL comment lines
    #   \…                    — psql backslash meta-commands (e.g. the
    #                            Supabase-injected \restrict / \unrestrict)
    cleaned = "\n".join(
        line
        for line in sql.splitlines()
        if not line.startswith(("SET ", "SELECT pg_catalog.set_config", "--", "\\"))
    )

    # asyncpg does not accept multiple SQL commands in a single prepared
    # statement (raises "cannot insert multiple commands into a prepared
    # statement").  We therefore split the cleaned DDL into individual
    # statements using a dollar-quote-aware splitter so that plpgsql function
    # bodies (which contain semicolons inside $$ … $$ blocks) are kept intact.
    for stmt in _split_statements(cleaned):
        op.execute(stmt)  # type: ignore[arg-type]


def downgrade() -> None:
    # Baseline revisions don't downgrade — there is no prior state to return
    # to.  Recreating a fresh database from scratch is the correct approach.
    raise NotImplementedError("baseline revision cannot be downgraded")
