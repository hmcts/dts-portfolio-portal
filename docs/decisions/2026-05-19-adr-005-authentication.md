# ADR-005: Authentication provider

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** DTS Portfolio Portal team

## Context

The portal is authenticated DTS staff only — no anonymous or public access (§8.5). The auth layer must surface a signed-in user identity (email at minimum), with optional team-membership claims feeding the "Your team" shortcut (§5.2). The submitter and approver fields in the audit log (§7.6) are populated from this identity.

The stack-design spec (§4, §10) locks Easy Auth → Microsoft Entra ID. This ADR records that decision.

## Options considered

### Option A — Easy Auth → Microsoft Entra ID

App Service platform sidecar that handles the full OIDC dance with Entra ID. The signed-in identity is surfaced to the Next.js app as `X-MS-CLIENT-PRINCIPAL` header on every request — no auth library in the application code. Group claims from Entra map to team membership via a naming convention. Zero code for v1. Selected.

### Option B — NextAuth.js / Auth.js in-app

OIDC client implemented in Next.js itself. Familiar to JS developers; rich middleware patterns. Rejected: adds an auth library, session management, callback routes, and a refresh-token strategy — all of which Easy Auth handles at the platform edge with no code. The cost of the library exceeds the value for our requirements.

### Option C — Header-trusted proxy (preview-only)

Lightweight pattern where a proxy injects a trusted `X-User-Email` header. Adequate for non-prod environments. Rejected as a production posture — production rejects header-trusted auth entirely. Retained as a local-dev shim only.

### Option D — Self-hosted Keycloak

Full OIDC provider under our control. Rejected: operational burden incompatible with v1 timeline; Entra ID is the HMCTS default and already in tenancy.

## Decision

Microsoft Entra ID via App Service Easy Auth. The platform sidecar handles authentication at the edge; the Next.js application consumes the `X-MS-CLIENT-PRINCIPAL` header and exposes a typed `getCurrentUser()` helper to the app code. A local-dev shim injects a fake principal from `.env.local` for development; the shim is gated by `NODE_ENV !== 'production'` and is unreachable in production builds. Group-to-team mapping follows the convention `team-<slug>` for Entra groups, surfaced as `groups` claim and parsed in `getCurrentUser()`.

## Consequences

- Entra app registration + group provisioning becomes an ops dependency captured in the deployment runbook.
- Local dev does not see Easy Auth — the dev shim is required and must be carefully fenced to avoid production exposure (Phase 4 task 4.2).
- Sign-out via the platform endpoint `/.auth/logout` — no app code needed.
- Future capability checks (§7.7) are simple — `getCurrentUser()` returns groups; capability matrix is evaluated in pure code that is easy to test.
- The header-trusted preview pattern survives only at local-dev altitude; non-prod environments use Easy Auth identical to production for parity.

## References

- Requirements spec §5.2, §7.6, §7.7, §8.5
- Stack-design spec §4, §10
- ADR-006 (App Service hosting model), ADR-008 (managed identity model)
