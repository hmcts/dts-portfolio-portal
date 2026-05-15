# Architecture Decision Records

One markdown file per architectural decision, capturing the options considered and the rationale.

## Filename

`YYYY-MM-DD-adr-NNN-short-slug.md` (numbered from 001).

## Template

```markdown
# ADR-NNN: [Decision title]

- **Status:** Proposed | Accepted | Superseded by ADR-NNN
- **Date:** YYYY-MM-DD
- **Deciders:** Names / roles

## Context

What problem are we solving? What constraints apply? Reference relevant spec sections (§N.N) and the implementation plan phase.

## Options considered

### Option A — Name

One paragraph: pros, cons, cost, risk.

### Option B — Name

Same shape.

### Option C — Name

Same shape.

## Decision

Which option we chose and why.

## Consequences

What follows from this decision — capability gained, debt taken on, dependencies introduced.

## References

Spec sections, prior art, related ADRs.
```

## Status values

- **Proposed** — under discussion
- **Accepted** — signed off by the deciders
- **Superseded by ADR-NNN** — replaced by a later decision

## Phase 0 backlog

Per the implementation plan, Phase 0 produces these seven ADRs:

| ADR | Topic |
|---|---|
| ADR-001 | Web framework and rendering |
| ADR-002 | Content store |
| ADR-003 | AI parser |
| ADR-004 | Search backend |
| ADR-005 | Authentication provider |
| ADR-006 | Hosting and deployment |
| ADR-007 | Visual language tooling |

ADR-008 onward will be assigned as later decisions arise.
