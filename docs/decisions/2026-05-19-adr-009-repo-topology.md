# ADR-009: Repository topology

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** DTS Portfolio Portal team

## Context

The portal is built code-in-the-open per HMCTS posture (stack-design constraint C1). Putting Terraform in the same public repo as application code reveals an architecture blueprint that gives reconnaissance value to an attacker — every Azure resource, every config flag, every SKU, every identity, every secret name in Key Vault. HMCTS-DTS practice on IaC publicity is uneven; some `cnp-*` repos are public, many service-specific `*-infra` repos are private. We must decide how to split the application code from the Terraform.

The stack-design spec (§3, §10) locks a two-repo topology with cross-repo deploy orchestration.

## Options considered

### Option A — Two repos: public app + internal infra (intent to publish)

`hmcts/dts-portfolio-portal` is **public** and carries the Next.js app, Dockerfile, CI workflows, and docs. `hmcts/dts-portfolio-portal-infra` is **internal visibility** (intent to publish) and carries Terraform (`infrastructure/` + `platform/` roots) and the deploy workflows. Cross-repo orchestration via `repository_dispatch` on deploy tags. Both repos follow code-in-the-open disciplines from day one — flipping the infra repo to public is a one-line repo-settings change with no remediation lag. Selected.

### Option B — Same repo with CODEOWNERS

App + infra in one public repo, CODEOWNERS gating infra-path changes. Rejected for v1: reveals the architecture blueprint publicly without HMCTS-DTS PlatOps having confirmed an IaC publicity stance.

### Option C — Permanently private infra repo

Two repos, infra repo permanently private. Rejected: closes off the public-visibility option if PlatOps later confirms it's safe; conflicts with the C1 transparency goal.

### Option D — Same repo, plan to split at Phase 5

App + infra in public repo for v1, extract at hardening time. Rejected: migration cost of a public-to-public split after history accumulates is higher than starting with two repos.

## Decision

Two repos. `hmcts/dts-portfolio-portal` is public from day one. `hmcts/dts-portfolio-portal-infra` is internal visibility, follows public-safe disciplines from day one, and graduates to public once HMCTS-DTS PlatOps confirms a position (a Phase 5 review task — stack-design §9 known tech debt).

Cross-repo deploy orchestration: the app repo's `deploy-<env>.yml` workflow fires `repository_dispatch` against the infra repo on the `deploy-<env>` event type, gated by `INFRA_DISPATCH_ENABLED` (default `false`) so the chain is dormant until the Azure estate is ready.

Dispatch authentication: GitHub App installed on both repos with `contents:write` + `actions:write`, preferred over a fine-scoped PAT to avoid rotation overhead. App credentials stored as `INFRA_DISPATCH_APP_ID` + `INFRA_DISPATCH_PRIVATE_KEY` in the app repo.

## Consequences

- Two sets of CODEOWNERS, branch protection rules, READMEs, and SECURITY.md files to maintain.
- Cross-repo PR coordination when app + infra change together — expected to be rare (framework or service migrations only).
- Infra repo visibility flip is captured as known tech debt; Phase 5 task 5.10 audits and decides.
- The two repos share three GitHub secrets (`AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, env-scoped `AZURE_CLIENT_ID_<ENV>`) configured per repo.
- GitHub App credentials require rotation discipline if the App is ever rolled — captured in the deployment runbook.

## References

- Stack-design spec §3, §3.4, §3.5, §9, §10
- ADR-010 (deploy pipeline)
- Phase 5 task 5.10 (re-evaluate infra-repo visibility)
