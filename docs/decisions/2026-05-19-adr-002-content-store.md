# ADR-002: Content store and ORM

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** DTS Portfolio Portal team

## Context

The portal owns its content (§3.2: "Portal store is canonical in v1"). The store must hold parsed entity data (Jurisdictions, Domains, Teams, Products, Initiatives), an append-only audit log of source markdown + AI parse output + approver metadata (§7.6), and the full-text search index that ADR-004 covers. The store must support Microsoft Entra authentication only — no passwords.

The stack-design spec (§4, §10) locks Azure Database for PostgreSQL Flexible Server as the store and Prisma as the ORM. This ADR records that decision.

## Options considered

### Option A — Azure Database for PostgreSQL Flexible Server + Prisma

One relational store for the entity spine, the append-only audit table (raw markdown bytes as `BYTEA`), and the `tsvector` full-text index. Entra-only authentication via `password_auth_enabled = false`. Private endpoint for network isolation. Prisma for schema management and queries — declarative `schema.prisma`, SQL migrations checked in via Prisma Migrate, large maintenance-familiarity advantage over Drizzle in a typical JS/TS team. Selected.

### Option B — Sanity CMS

Vendor-hosted CMS with built-in editorial workflows. Rejected: pricing scales by document; the editorial workflows duplicate the portal's own markdown-upload-then-approve lifecycle (§7.3); vendor lock that the prior attempt at this portal regretted.

### Option C — Filesystem (Git repo) + Postgres index

Round-trippable markdown as the source of truth, with Postgres as a derived index. Captured by the requirements spec (§3.2) as an explicit v2 graduation path (the markdown is already round-trippable). Deferred — not v1.

### Option D — Azure Cosmos DB

Gov-cloud option, schemaless, scales globally. Rejected: less idiomatic for the relational queries the entity model implies; the spec's full-text + entity-join pattern is a strong fit for Postgres, not Cosmos.

### Option E — Drizzle ORM (alternative to Prisma)

Lighter generated client; TypeScript-native schema; closer to SQL. Rejected on maintenance-familiarity grounds — Prisma is the ORM most JS/TS developers have seen.

## Decision

Azure Database for PostgreSQL Flexible Server with Microsoft Entra authentication only (no password auth). Geo-redundant backup. Private endpoint. Prisma + Prisma Migrate for schema and queries; SQL migrations checked into the repo under `prisma/migrations/`.

## Consequences

- Schema migrations are author-time work (`prisma migrate dev`) reviewed in PRs; production runs `prisma migrate deploy` idempotently.
- DB backup / point-in-time-recovery becomes a Phase 5 hardening task; the audit log being append-only sharpens the RPO requirement.
- Prisma client size (~5MB) is acceptable given non-serverless host (App Service is always-on).
- Future move to a Git-as-source pattern (§3.2 v2 graduation) remains possible because the markdown is already round-trippable.
- Entra-only auth means the App Service managed identity (see ADR-008) is granted `azure_pg_admin` (or finer-grained role) at the DB level — no credentials in app config.

## References

- Requirements spec §3.2, §4, §7.6, §7.7
- Stack-design spec §4, §5.1, §10
- ADR-006 (hosting and ACR), ADR-008 (managed identity model)
