---
title: Bootstrap the infrastructure repository
phase: 1
task: 1.1d
status: Pre-deploy checklist
---

# Bootstrap `hmcts/dts-portfolio-portal-infra`

The DTS Portfolio Portal uses a two-repo topology (ADR-009):

- **This repo** (`hmcts/dts-portfolio-portal`, public) — application code, CI, image build.
- **Infra repo** (`hmcts/dts-portfolio-portal-infra`, internal visibility) — Terraform, `terraform apply` workflows triggered via cross-repo `repository_dispatch`.

This runbook is the pre-deploy checklist for the infra repo: what to create, in what order, and which values to copy back into this repo's secrets and variables. Until each step is done, the deploy chain in this repo stays dormant (the `INFRA_DISPATCH_ENABLED` variable controls it — see ADR-010).

The runbook is written so a colleague who hasn't seen either repo can follow it end-to-end.

---

## 0. Prerequisites

You'll need:

- `gh` CLI authenticated to GitHub with `repo`, `admin:org` rights on `hmcts`
- `az` CLI authenticated to the HMCTS Azure tenancy (`az login`)
- `terraform` (matching the version pinned in `.terraform-version` once that file lands in the infra repo — currently track 1.9.x)
- `make`, `docker`

Confirm subscription IDs for each environment up front; you'll paste them as GitHub secrets later.

---

## 1. Create the infra repository

```bash
gh repo create hmcts/dts-portfolio-portal-infra \
  --internal \
  --description "Terraform + deploy pipeline for the DTS Portfolio Portal (sibling of hmcts/dts-portfolio-portal)" \
  --license MIT \
  --clone
```

Why `--internal` (not `--public`) — per ADR-009, infra-as-code starts internal-visibility while HMCTS-DTS PlatOps confirms the IaC publicity stance. Code is written as if public from day one (no secrets, no internal references) so the flip to public is a one-line repo-settings change later.

In the new repo:

```bash
cd dts-portfolio-portal-infra
git checkout -b main
```

Add `.gitignore` covering Terraform state and lock files (`*.tfstate*`, `*.tfvars` except `*.tfvars.example`, `.terraform/`, `.terraform.lock.hcl` — note: lock file IS committed; see ADR-009 §3.3 disciplines).

---

## 2. Configure GitHub repo settings (mirror this repo)

In the infra repo on github.com:

- **Branch protection on `main`**: ≥1 required reviewer, signed commits, no force-push, no deletion. Required status checks: `terraform-fmt`, `terraform-validate`, `tflint`.
- **Tag protection** on `deploy-*` tags: allow `github-actions[bot]` push + delete; deny everyone else.
- **Environments**: `dev`, `stg`, `prod`. Production requires reviewers; dev and stg don't.
- **Advanced Security**: secret scanning + push protection on.
- **`CODEOWNERS`**: scope all of `infrastructure/` and `platform/` to the same team as in this repo (currently the placeholder `@hmcts/dts-portfolio-portal-maintainers` — update once the owning DTS squad is named).

---

## 3. Lay out the Terraform tree

Two Terraform roots per the cnp pattern (see ADR-008):

```
dts-portfolio-portal-infra/
├── infrastructure/        # App resources: RG, App Service, Postgres,
│                          # OpenAI, Key Vault, App Insights, Front Door,
│                          # Log Analytics, ACR pull RBAC
├── platform/              # Managed identities, OIDC federation, RBAC
├── environments/
│   ├── dev/
│   ├── stg/
│   └── prod/
├── Makefile               # plan/apply targets per env
├── .terraform-version
└── README.md
```

Both roots use a **remote backend** in Azure Storage. State containers — one per env:

```
tfstate-dev/  app.tfstate  platform.tfstate
tfstate-stg/  app.tfstate  platform.tfstate
tfstate-prod/ app.tfstate  platform.tfstate
```

Provision the state storage account by hand (or via a separate `bootstrap/` root) before the first `terraform init`. Encrypt at rest; restrict access to the federated CI identity (no human-facing public access).

---

## 4. Bootstrap the platform Terraform per environment

The `platform/` root provisions the user-assigned managed identity that App Service runs as, plus the GitHub OIDC federated credential that the CI workflows authenticate with. **It must apply before `infrastructure/`** — the App Service in `infrastructure/` references the identity.

```bash
# In the infra repo
make setup-platform-dev      # terraform init + plan for the platform root
make apply-platform-dev      # terraform apply after reviewing the plan
```

The platform root **outputs** the federated client ID. Capture it:

```bash
terraform -chdir=platform output -raw federated_client_id_dev
```

Repeat for `stg` and `prod`.

---

## 5. Populate GitHub secrets and variables

In **this repo** (`hmcts/dts-portfolio-portal`):

### Repo-level secrets

- `AZURE_TENANT_ID` — HMCTS tenant
- `AZURE_SUBSCRIPTION_ID` — subscription where the portal lives
- `INFRA_DISPATCH_TOKEN` — fine-scoped PAT or GitHub App credentials with `repo` scope on the infra repo (see ADR-009 §3.5)

### Per-environment secrets (Settings → Environments → dev / stg / prod)

- `AZURE_CLIENT_ID_DEV` / `_STG` / `_PROD` — the federated client IDs you captured in step 4

### Repo-level variables (NOT secrets)

- `INFRA_DISPATCH_TARGET_REPO=hmcts/dts-portfolio-portal-infra`
- `INFRA_DISPATCH_ENABLED=false` (leave at `false` for now — see step 8)

In the **infra repo**:

### Repo-level secrets

- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

### Per-environment secrets

- `AZURE_CLIENT_ID_DEV` / `_STG` / `_PROD` — same federated client IDs (the infra repo's workflows use them to authenticate `terraform apply`)

The org-level secrets `HMCTSPROD_REGISTRY_USERNAME`, `HMCTSPROD_REGISTRY_PASSWORD`, and `GITLEAKS_LICENSE` are already provisioned by HMCTS — no per-repo setup needed.

---

## 6. Apply the application infrastructure per environment

```bash
make setup-dev               # terraform init + plan for infrastructure/
make apply-dev               # terraform apply after reviewing the plan
```

This provisions:

- Resource group
- App Service Plan (Linux) + App Service for Containers
- Azure Database for PostgreSQL Flexible Server (Entra-auth-only)
- Azure OpenAI deployment
- Azure Key Vault with the relevant access policies for the managed identity
- Application Insights + Log Analytics workspace
- Azure Front Door + WAF rule baseline
- ACR pull RBAC for the App Service managed identity (against the pre-provisioned `hmctsprod.azurecr.io`)

Repeat for `stg` and `prod`.

---

## 7. Add the cross-repo deploy workflow to the infra repo

Add `.github/workflows/deploy-dev.yml` (and `deploy-stg.yml`, `deploy-prod.yml`) in the infra repo. Each is triggered by `repository_dispatch` with event-type `deploy-<env>`. The payload from this repo's CI is `{ version, image_tag, run_id }`.

Each workflow:

1. Authenticates to Azure via the federated `AZURE_CLIENT_ID_<env>`
2. Runs `terraform plan` (a precheck — fail fast if state has drifted)
3. Runs `terraform apply`
4. Calls `az webapp config set --linuxFxVersion=hmctsprod.azurecr.io/dts-portfolio-portal:<version>`
5. Calls `az webapp restart`
6. Runs a smoke test against `https://<env>-host>/healthz`

If any step fails, the workflow surfaces it; the App Service stays on its previous image.

---

## 8. Flip `INFRA_DISPATCH_ENABLED` to `true`

Until this step, every `deploy-dev.yml` run in this repo logs a `::notice` that the dispatch is dormant and stops. Once you've verified end-to-end (a manual `terraform apply` in the infra repo succeeded; the federated identity works for both repos; the smoke test passes), set:

- This repo: `Settings → Variables → Actions → INFRA_DISPATCH_ENABLED=true`

After that, the next push to `main` triggers the full chain: build image → push to ACR → push deploy tag → fire `repository_dispatch` → infra repo runs Terraform + App Service update → smoke test.

---

## 9. Smoke-test the chain end-to-end

```bash
# In this repo
gh workflow run deploy-dev.yml
```

Watch the run in this repo's Actions tab. After "Trigger infra deploy" succeeds, switch to the infra repo's Actions tab and watch `deploy-dev.yml` run. After that finishes, hit `https://<dev-host>/healthz` — should return `{"status":"ok"}`.

If anything fails, the runbook breakpoints are:

- **No tag pushed** — check the `tag-and-dispatch` job's git-config step
- **Dispatch step skipped** — `INFRA_DISPATCH_ENABLED` not `true`, or `INFRA_DISPATCH_TARGET_REPO` not set
- **Infra repo doesn't receive the event** — `INFRA_DISPATCH_TOKEN` is missing or lacks `repo` scope on the infra repo
- **Terraform fails on apply** — federated identity isn't granted the right roles; check the platform-root output and the `az role assignment list` on the subscription
- **App Service config set fails** — managed identity doesn't have `AcrPull` on `hmctsprod.azurecr.io`; check the ACR pull RBAC in `infrastructure/`

---

## 10. Repeat for staging and production

`make apply-platform-stg && make apply-stg` — set `INFRA_DISPATCH_ENABLED` once, applies to all envs.

Production has the additional gate of GitHub's environment-protection rule (required reviewers); the workflow stops at the `tag-and-dispatch` step and waits for an approver before pushing the tag.

---

## What this runbook does not cover

- **Custom domain setup** under `justice.gov.uk` — follow the [MoJ DNS repo](https://github.com/ministryofjustice/dns) process. See courttranscribe's `docs/deployment.md` for the closest analogue.
- **Entra app registration for Easy Auth** — see ADR-005; redirect URIs are added per-environment in the App Service Authentication blade.
- **Front Door custom rules** — apply the HMCTS baseline WAF rule set; portal-specific exceptions go in a follow-up ADR if needed.
- **DR / backup runbooks** — Phase 5 work. The Postgres Flexible Server should have geo-redundant backup enabled in `infrastructure/` from day one regardless.

---

## When to revisit

This runbook becomes stale if:

- The cnp standard pipeline shape changes (revisit ADR-010 first)
- HMCTS PlatOps mandates a move to AKS via the shared cnp Helm chart (revisit ADR-006; the container image is portable so the migration is a re-platform, not a rebuild)
- The infra repo flips to public (revisit ADR-009 step §3.3)
