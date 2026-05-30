"""Canonical Jurisdiction ordering (requirements spec §3.2).

The DB doesn't enforce this order; queries that present Jurisdictions to
the UI project this fixed sequence over their results.
"""

JURISDICTION_ORDER: tuple[str, ...] = ("crime", "civil", "family", "tribunals", "administrative")


def jurisdiction_rank(slug: str) -> int:
    """Index of ``slug`` in ``JURISDICTION_ORDER``, or ``len(...)`` for unknowns (sorts last)."""
    return JURISDICTION_ORDER.index(slug) if slug in JURISDICTION_ORDER else len(JURISDICTION_ORDER)
