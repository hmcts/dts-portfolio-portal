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

Per the implementation plan, Phase 0 ratifies these ten ADRs from the locked decisions captured in [`../superpowers/specs/2026-05-19-azure-stack-design.md`](../superpowers/specs/2026-05-19-azure-stack-design.md):

| ADR | Topic | Locked recommendation |
|---|---|---|
| ADR-001 | Web framework and rendering | Next.js (App Router) + React + TypeScript |
| ADR-002 | Content store and ORM | Azure Database for PostgreSQL Flexible Server; Prisma + Prisma Migrate |
| ADR-003 | AI parser | Azure OpenAI |
| ADR-004 | Search backend | Postgres full-text search |
| ADR-005 | Authentication provider | Easy Auth → Microsoft Entra ID |
| ADR-006 | Hosting and deployment | App Service for Linux (Web App for Containers); image in HMCTS ACR; Front Door in front |
| ADR-007 | Visual language tooling | Tailwind CSS + shadcn/ui + Lucide + Geist |
| ADR-008 | Platform services | Key Vault + App Insights + Log Analytics + Front Door; managed-identity-only RBAC |
| ADR-009 | Repository topology | Two repos: public app, internal-visibility infra; cross-repo dispatch |
| ADR-010 | Deploy pipeline | All-GHA in v1 (courtstranscribe pattern adapted); ADO deferred; gated cross-repo dispatch |

ADR-011 onward will be assigned as later decisions arise.
