# ADR-010: Deploy pipeline

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** DTS Portfolio Portal team

## Context

The portal needs continuous delivery to dev and a guarded promotion path to staging and production. The hosting model (ADR-006) and repo topology (ADR-009) imply a deploy pipeline that builds a container image, pushes it to ACR, and runs Terraform + an App Service config update on the matching environment. The HMCTS-DTS reference repo `hmcts/courtstranscribe` already implements this shape on Azure DevOps via the cnp pipeline templates.

The stack-design spec (§6, §10) locks all-GHA CI/CD in v1 (no ADO), adapting the courtstranscribe pattern.

## Options considered

### Option A — All-GHA in v1; ADO deferred

GitHub Actions handles CI (build image, push to ACR, push deploy tag, fire cross-repo dispatch) and the infra repo's GHA handles CD (terraform apply, App Service config update, smoke test). Deploy tags retained for audit even without ADO consuming them. Simpler for v1 — one CI system. Selected.

### Option B — courtstranscribe pattern verbatim (GHA + ADO + cnp pipelines)

GHA builds + tags; ADO triggers on the tag and runs the cnp `Precheck<Env>` + `Deploy<Env>` stages. Standard HMCTS-DTS pattern. Rejected for v1: adds ADO setup cost (service connections, library secrets, pipeline definitions in this repo); loses all-GHA simplicity. Captured as known tech debt — revisit when DTS PlatOps standardisation triggers it.

### Option C — GHA monolith in app repo (single workflow does build + apply + swap)

Build, terraform apply, and App Service config update in one workflow run in the app repo. Rejected: mixes the image-push identity with the terraform-apply identity in a single workflow run, weakening the privilege separation. Cross-repo dispatch (per ADR-009) keeps the separation clean.

## Decision

All-GHA in v1. App repo workflows (adapted from courtstranscribe):
- `ci-build-images.yml` — version via `hmcts/artefact-version-action@v1`; CHANGELOG via `orhun/git-cliff-action@v4`; build Docker image; push to `hmctsprod.azurecr.io` via `hmcts/cnp-githubactions-library/container-build-push@main`.
- `deploy-dev.yml` / `deploy-stg.yml` / `deploy-prod.yml` — push `deploy-<env>-<version>-<runid>` tag and fire `repository_dispatch` against the infra repo (gated by `INFRA_DISPATCH_ENABLED`, default `false`).
- `prune-deploy-tags.yml` — weekly housekeeping per the courtstranscribe rules.

Infra repo workflows:
- `deploy-<env>.yml` — triggered by `repository_dispatch`. Runs `terraform plan` (precheck), `terraform apply`, `az webapp config set --linuxFxVersion`, `az webapp restart`, smoke test.

Workload identity federation: GHA → Azure via federated `AZURE_CLIENT_ID_<ENV>` secrets, provisioned by `make apply-platform-<env>` in the infra repo.

## Consequences

- Federated identity setup is a Phase 1 task (per environment, per repo); the federated identities are output by the platform Terraform.
- Tag protection ruleset must allow `github-actions[bot]` to push and delete `deploy-*` tags; humans cannot push deploy tags.
- ADO migration is a future change (revisit trigger: DTS PlatOps standardisation, or a need to share secrets/SPs with other DTS services that already live in ADO).
- Deploy tags retained as audit trail of every deploy event — readable by humans and surface-able in compliance reviews.
- Rollback in v1 is "re-run the prod deploy workflow against the previous version"; the manifest check in `deploy-prod.yml` guards against typos.

## References

- Stack-design spec §3.4, §6, §9, §10
- `hmcts/courtstranscribe` `.github/workflows/` (reference patterns)
- ADR-006 (hosting), ADR-009 (repo topology)
