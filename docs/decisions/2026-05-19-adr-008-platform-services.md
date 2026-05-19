# ADR-008: Platform services

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** DTS Portfolio Portal team

## Context

The application services (Postgres, OpenAI, hosting) need supporting platform pieces: a place to store secrets, an identity model that avoids embedded credentials, observability, and a CDN + WAF in front of the app. The stack-design spec (§4, §10) locks Azure Key Vault, Application Insights + Log Analytics, Azure Front Door, and a managed-identity-only RBAC model. This ADR records those decisions as a single bundle because they all share the same identity model.

## Options considered

### Option A — Azure Key Vault + App Insights + Log Analytics + Front Door, managed-identity-only

Centralised secret storage with audit (Key Vault). Auto-instrumented telemetry from Next.js + structured logging via `pino` shipped to App Insights backed by a Log Analytics workspace. Front Door for CDN + WAF per HMCTS baseline. All service-to-service connections via App Service user-assigned managed identity — no API keys, no connection strings with passwords. Selected.

### Option B — Environment variables for secrets, Sentry for observability, Cloudflare for CDN

Common cross-cloud pattern. Rejected: env-vars-as-secrets leak in logs and error reports; Sentry is excellent but external to Azure; Cloudflare adds a vendor outside the Azure tenancy. Inconsistent identity model.

### Option C — Azure Front Door + Application Gateway

Two CDN/WAF layers. Rejected as overkill for v1; Front Door covers CDN + WAF + global anycast in one resource.

## Decision

- **Azure Key Vault** — single secret store. Secrets referenced from Terraform by name (`data "azurerm_key_vault_secret"`); runtime resolution via App Service user-assigned managed identity with `get` permission on relevant secrets.
- **Application Insights + Log Analytics workspace** — `pino` logs ship to App Insights; auto-instrumentation captures route entry/exit, AI calls, DB query timings, auth events.
- **Azure Front Door** — global CDN + WAF in front of App Service; WAF rules per HMCTS baseline (link from infra repo).
- **Managed identity model** — every service-to-service connection uses a user-assigned managed identity. Terraform `platform/` root provisions the identities + RBAC; `infrastructure/` root provisions the services that consume them.

## Consequences

- No connection strings with passwords appear in code or Terraform. Discipline is non-negotiable — the `DefaultAzureCredential` pattern in code, `data "azurerm_key_vault_secret"` in Terraform.
- WAF rule baseline owned by HMCTS — apply the baseline set; portal-specific exceptions justified in this ADR or a follow-up.
- Two Terraform roots (`infrastructure/` + `platform/`) matches the cnp pattern (see ADR-009 + ADR-010).
- App Insights ingestion uses the same managed identity — no instrumentation key in app config.
- Key Vault access policies are explicit per-secret; the audit trail is queryable in the Log Analytics workspace.

## References

- Requirements spec §8.5
- Stack-design spec §3, §4, §8.4, §10
- ADR-002 (Postgres + Entra auth), ADR-003 (Azure OpenAI access), ADR-006 (App Service hosting), ADR-009 (repo topology)
