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

Per the implementation plan, Phase 0 ratifies these ten ADRs from the locked decisions captured in [`../superpowers/specs/2026-05-19-azure-stack-design.md`](../superpowers/specs/2026-05-19-azure-stack-design.md). All ten were authored and signed off on 2026-05-19.

| ADR | Topic | Status | File |
|---|---|---|---|
| ADR-001 | Web framework and rendering | Accepted | [`2026-05-19-adr-001-web-framework.md`](2026-05-19-adr-001-web-framework.md) |
| ADR-002 | Content store and ORM | Accepted | [`2026-05-19-adr-002-content-store.md`](2026-05-19-adr-002-content-store.md) |
| ADR-003 | AI parser | Accepted | [`2026-05-19-adr-003-ai-parser.md`](2026-05-19-adr-003-ai-parser.md) |
| ADR-004 | Search backend | Accepted | [`2026-05-19-adr-004-search-backend.md`](2026-05-19-adr-004-search-backend.md) |
| ADR-005 | Authentication provider | Accepted | [`2026-05-19-adr-005-authentication.md`](2026-05-19-adr-005-authentication.md) |
| ADR-006 | Hosting and deployment | Accepted | [`2026-05-19-adr-006-hosting.md`](2026-05-19-adr-006-hosting.md) |
| ADR-007 | Visual language tooling | Accepted | [`2026-05-19-adr-007-visual-language.md`](2026-05-19-adr-007-visual-language.md) |
| ADR-008 | Platform services | Accepted | [`2026-05-19-adr-008-platform-services.md`](2026-05-19-adr-008-platform-services.md) |
| ADR-009 | Repository topology | Accepted | [`2026-05-19-adr-009-repo-topology.md`](2026-05-19-adr-009-repo-topology.md) |
| ADR-010 | Deploy pipeline | Accepted | [`2026-05-19-adr-010-deploy-pipeline.md`](2026-05-19-adr-010-deploy-pipeline.md) |

## Post-Phase-0 decisions

| ADR | Topic | Status | File |
|---|---|---|---|
| ADR-011 | Graceful degradation strategy | Proposed | [`2026-05-20-adr-011-graceful-degradation.md`](2026-05-20-adr-011-graceful-degradation.md) |

ADR-012 onward will be assigned as later decisions arise.

## Phase 0 sign-off

Recorded here for traceability. Names and roles of the people who reviewed each ADR before Phase 1 begins.

- ADR-001 — _name, role, date_
- ADR-002 — _name, role, date_
- ADR-003 — _name, role, date_
- ADR-004 — _name, role, date_
- ADR-005 — _name, role, date_
- ADR-006 — _name, role, date_
- ADR-007 — _name, role, date_
- ADR-008 — _name, role, date_
- ADR-009 — _name, role, date_
- ADR-010 — _name, role, date_
