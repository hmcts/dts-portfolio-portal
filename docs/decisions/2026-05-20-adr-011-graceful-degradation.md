# ADR-011: Graceful degradation strategy

- **Status:** Proposed
- **Date:** 2026-05-20
- **Deciders:** DTS Portfolio Portal team

## Context

The portal depends on several external services — Azure Database for PostgreSQL Flexible Server (ADR-002), Azure OpenAI (ADR-003), Azure Entra ID via Easy Auth (ADR-005), Azure Key Vault and managed identity (ADR-008). Any one of these can be partially or fully unavailable for minutes-to-hours at a time (maintenance windows, regional incidents, quota limits, transient network issues).

Spec §7.5 already mandates a strict-template fallback when Azure OpenAI is unavailable. Phase 2 task 2.14 (PR #26) added a visible per-submission indicator (`aiParseSource` pill) so reviewers can tell when they're looking at a degraded parse. That pattern — **observable degradation** — is a good principle but it has only been applied to one dependency.

Without a written policy, future contributors will make ad-hoc choices on each new dependency. Some will silently fall back (the worst outcome — operators don't know they're degraded). Some will hard-fail when they could have served a useful response. A consistent policy is needed.

## Options considered

### Option A — Hard fail visibly on every dependency outage

Any external-service error renders a clear error page that names the unavailable dependency. Simple to reason about; operators always know what's wrong. Rejected as a blanket policy: it fails the portal's purpose ("front door") for outages it could otherwise survive. A read-only browse session does not require a working AI parser.

### Option B — Soft-degrade silently and recover when the dependency returns

Cache last-known content; quietly serve it when the dependency is unavailable; reconnect automatically. Maximises uptime but **hides** degradation from operators and users. Rejected: spec §7.4 / §7.5 already require visible attribution of AI parses; silent fallback violates that principle and would breed trust issues.

### Option C — Criticality ladder with visible degradation (selected)

Classify each capability by how it should behave when a dependency fails. Make degradation visible to the affected user every time. Synthesise the two earlier options: critical reads stay up, authoring degrades visibly, ops surfaces fail loudly.

## Decision

Adopt a five-tier **criticality ladder**. Every external-dependency call site must be classified before merge.

| Tier | Capability | Outage behaviour |
|---|---|---|
| 1 | **Viewing content** (Home, entity pages) | Must never hard-fail. Read from DB; if DB is unavailable, render a `<SystemBanner />` explaining the outage and surface the static seed data where possible. Stale content is acceptable so long as it is labelled stale. |
| 2 | **Search** | Must degrade to a usable form. FTS unavailable → fall back to a lightweight `ILIKE` query against entity name and label the results as "approximate". AOAI answer card unavailable → omit the card (already opt-out) and surface "Answer card unavailable" rather than an empty space. |
| 3 | **Authoring — AI parse** | Must degrade to the strict-template fallback (spec §7.5). Per-submission `aiParseSource` pill is the load-bearing visible marker. Global `<SystemBanner />` notifies all approvers when AOAI has been kill-switched (`AI_PARSER_FORCE_FALLBACK=true`). |
| 4 | **Authoring — write to DB** | May hard-fail with a clear, operator-actionable message ("Database is unavailable — submission not saved. Try again or contact ops."). Never accept the submission silently into a queue without persistence. |
| 5 | **Ops dashboards** (`/ops/*`) | May hard-fail. Operators have other tools; the dashboards are read-only diagnostics layered over the same DB. |

### Three operational rules apply across all tiers

1. **Visible degradation always.** Every degraded mode must be observable by the affected user. The `aiParseSource` pill is the reference implementation. Components that conditionally hide content because of a dependency outage must replace it with an explicit "X is unavailable — Y is missing" message rather than an empty container.
2. **Failure modes documented at the call site.** Every external-service client (the Prisma client, the Azure OpenAI parser, the Easy Auth subject reader) must own a single module that wraps its calls and documents its outage behaviour in a header comment. Co-locating the policy with the call site prevents drift.
3. **Health probes are first-class.** `src/lib/health/` exposes one boolean per dependency (`isAiHealthy()`, `isFtsHealthy()`, etc.). The system banner reads from there. A `/healthz` endpoint already exists for the App Service liveness probe; a `/readyz` endpoint added in Phase 5 (task 5.6) will aggregate the same checks for operators.

## Consequences

- **New module**: `src/lib/health/` — health probes per dependency. Read by the system banner and the `/readyz` endpoint.
- **New component**: `<SystemBanner />` in the top-bar shell, conditionally rendered when any tier-1, tier-2 or tier-3 capability is degraded.
- **New PR-review checklist item**: "Which tier does this change touch? What does the user see when the dependency it depends on is unavailable?" Failing to answer blocks merge.
- **Tests must cover the degraded path.** Phase 2 task 2.14 (`tests/e2e/ai-down-fallback.spec.ts`) is the reference. Every future dependency-using feature needs an analogous test that forces the outage and asserts the visible degradation.
- **Spec update**: a new §8.6 ("Degradation strategy") in the requirements spec referencing this ADR is added alongside this commit so the spec stays authoritative for product behaviour and this ADR stays authoritative for the design rationale.
- **Existing gaps to close as follow-on work** — none of these block this ADR's acceptance, but each is a tracked debt:
  - Tier 1: DB-unavailable banner + stale-content labelling.
  - Tier 2: `ILIKE` fallback in `src/lib/search/search.ts`; "Answer card unavailable" string in the overlay when the AOAI answer-card synthesiser returns null.
  - Tier 3: global system banner when `AI_PARSER_FORCE_FALLBACK=true`.

## References

- Requirements spec §7.4, §7.5, §8.6 (added alongside this ADR)
- ADR-002 (Postgres), ADR-003 (Azure OpenAI), ADR-005 (Easy Auth), ADR-008 (managed identity)
- PR #26 (`feat/phase-2-ai-down-fallback-indicator`) — reference implementation of tier 3 visible degradation
- Phase 5 task 5.6 (Observability) — natural home for the health probes and `/readyz`
