# ADR-004: Search backend

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** DTS Portfolio Portal team

## Context

The portal's search (§5.7, §6.1) returns a ranked list of entity matches plus an LLM-synthesised one-sentence answer card. The corpus is small (hundreds of entities at v1 scale). Overlay results must be visible within 500ms perceived (§8.2); the answer card is permitted to stream after.

The stack-design spec (§4, §10) locks Postgres full-text search as the v1 backend, with Azure AI Search captured as known tech debt (stack-design §9) for revisit if relevance proves poor or scale grows.

## Options considered

### Option A — Postgres full-text + Azure OpenAI rerank/answer

`tsvector` columns + GIN indexes on entity content; top-N retrieved by FTS, passed to Azure OpenAI for the answer card synthesis (per ADR-003). Adequate at v1 scale (hundreds of entities); one fewer service to operate; keeps state in the same store as the entity spine (per ADR-002). Selected.

### Option B — Azure AI Search

Purpose-built search service with hybrid keyword + vector retrieval and direct "On Your Data" integration with Azure OpenAI. ~£200/month for Basic tier (the lowest tier with SLA). Stronger relevance ceiling than Postgres FTS. Rejected for v1 on cost/value at our scale; captured as known tech debt for revisit.

### Option C — Elasticsearch / OpenSearch

Richer query DSL, mature stack. Rejected: heavier ops footprint; overkill for v1 corpus size; off the HMCTS-DTS standard path.

### Option D — pgvector + embedding model

Semantic similarity via embeddings stored in Postgres. Adds an embedding pipeline + embedding-model dependency. Rejected for v1 — solves a problem (fuzzy phrase matching) we don't yet know we have. Revisit if Postgres FTS relevance proves poor.

## Decision

Postgres full-text search via `tsvector` + GIN. Top-K retrieval ranked by FTS score, optionally re-ranked by Azure OpenAI for the answer-card pathway. Re-index on approve-and-publish (Phase 2). Search analytics (zero-result queries, click-through) logged from day one to feed future relevance work and the AI Search graduation decision.

## Consequences

- Relevance ceiling is bound by Postgres FTS quality; LLM rerank can sharpen but cannot fully compensate for poor candidate retrieval.
- Reindex happens inline with the approve-and-publish flow — must complete within a few seconds to keep the approval UX responsive.
- Zero-result query logging becomes a Phase 3 task; the resulting dashboard feeds the AI Search graduation trigger.
- If entity count grows past ~5k or relevance complaints accumulate, graduate to Azure AI Search; the search API surface is the abstraction point that contains the migration.

## References

- Requirements spec §5.7, §6.1, §8.2
- Stack-design spec §4, §9, §10
- ADR-002 (Postgres store), ADR-003 (Azure OpenAI for answer card)
