---
title: DTS Portfolio Portal — Infra Phase 1 Implementation Plan
date: 2026-05-21
status: Draft
purpose: First reviewable cut of `hmcts/dts-portfolio-portal-infra` — repo scaffolding, Terraform two-roots layout, platform root (OIDC + UAMI), and infrastructure-root foundations (RG, KV, Log Analytics, App Insights). Runtime resources (App Service, Postgres Flexible Server, Front Door, Azure OpenAI link) land in Phase 2.
related:
  - docs/superpowers/specs/2026-05-19-azure-stack-design.md
  - docs/decisions/2026-05-19-adr-006-hosting.md
  - docs/decisions/2026-05-19-adr-008-platform-services.md
  - docs/decisions/2026-05-19-adr-009-repo-topology.md
  - docs/decisions/2026-05-19-adr-010-deploy-pipeline.md
---

# DTS Portfolio Portal — Infra Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> All Terraform code lives in `hmcts/dts-portfolio-portal-infra` (internal, clone at `~/development/workspace/hmcts/dts/dts-portfolio-portal-infra`). This plan file lives in the **public** app repo alongside the spec it implements. Each task names which repo it operates on.

**Goal:** Stand up the infra repo to "foundations ready, runtime deferred" — Terraform two-roots scaffolding, OIDC federation, identity/RBAC, RG/KV/Log Analytics/App Insights — without provisioning any Azure resource that could host a request yet. End state: a developer can `make plan-platform-dev` and see a green Terraform plan; CI runs `terraform validate` + `tflint` + `tfsec` on PRs; `INFRA_DISPATCH_ENABLED` stays `false`, so nothing applies until a separate manual flip.

**Architecture:** Two Terraform roots in the infra repo — `platform/` (identity, OIDC federation, RBAC roles, GitHub federated credentials) and `infrastructure/` (App-Service-shaped foundations: resource group, Key Vault, Log Analytics workspace, Application Insights, user-assigned managed identity bindings). Remote state in Azure Storage, per-env containers. All Azure auth uses workload identity federation from GitHub OIDC — zero secrets stored in GitHub for Azure access. Cross-repo dispatch shape stubbed but disabled.

**Tech Stack:** Terraform 1.10+ · `azurerm` provider v4+ · `azuread` provider v3+ · Makefile (per courtstranscribe precedent) · tflint · tfsec · `terraform fmt` · `terraform validate` · GitHub Actions (gitleaks, secrets-scanner, codeql, terraform CI) · pre-commit hooks · Azure Storage backend for state.

---

## YAGNI register — what we explicitly do NOT add

Recorded so reviewers see the deliberate omissions. Anything in this list that turns out to be needed gets a documented reason in a follow-up ADR or plan; nothing here lands "because courtstranscribe has it".

| Omitted | Why |
|---|---|
| **Storage account for app data** | Portal has no blob/file storage need. Markdown source files live in Postgres (`source_markdown` audit table). |
| **Service Bus / Storage Queues** | No async workers. AI parse is request-scoped; failures bubble back to the approval screen. |
| **Function Apps** | No serverless workloads — Next.js handles everything inline. |
| **Azure AI Search** | Postgres FTS adequate at v1 scale per stack-design §7. Revisit at >5k entities. |
| **ACR resource** | Using shared `hmctsprod.azurecr.io` — only need `AcrPull` RBAC on the App Service identity, no ACR provisioning. |
| **Azure DevOps pipelines** | All-GHA per ADR-010. ADO is recorded tech debt in stack-design §9. |
| **Static Web Apps** | App Service for Linux per ADR-006; SWA is the wrong shape for SSR + RSC. |
| **Speech / Cognitive Services (non-OpenAI)** | No audio/voice/vision workloads. |
| **API Management** | Front Door + App Service is sufficient at v1 scale. APIM is overkill until cross-service APIs need governance. |
| **Container Apps / AKS** | App Service per ADR-006; AKS deferred until PlatOps mandates it (C4 makes the image migratable). |
| **Bastion / jumphost** | Private-endpoint Postgres is reachable from App Service via VNet integration. No human SSH path needed. |

## Out of Phase 1 (lands in Phase 2)

These are needed for the portal to actually serve requests, but they bring meaningful design choices (SKUs, networking, private endpoints, backup retention) that deserve their own review cycle:

- App Service for Linux (Web App for Containers) + staging slot
- Front Door + WAF policy
- Postgres Flexible Server + private endpoint + VNet
- Azure OpenAI resource + content-filter policy
- App-Service-to-Postgres Entra grants
- Deploy workflows that actually fire `terraform apply` (Phase 1 leaves these as `if: false` skeletons)

---

## Repository layout (end state of Phase 1)

```
hmcts/dts-portfolio-portal-infra/
├── .github/
│   ├── workflows/
│   │   ├── secrets-scanner.yml        # courtstranscribe copy
│   │   ├── codeql.yml                  # courtstranscribe copy
│   │   ├── terraform-ci.yml            # fmt-check, validate, tflint, tfsec on PR
│   │   ├── deploy-dev.yml              # repository_dispatch handler; gated, no-op in P1
│   │   ├── deploy-stg.yml              # ditto
│   │   └── deploy-prod.yml             # ditto
│   └── CODEOWNERS
├── platform/
│   ├── main.tf                         # provider, backend, locals
│   ├── variables.tf                    # env, location, app_name, github_org/repo
│   ├── identity.tf                     # user-assigned managed identities per env
│   ├── federation.tf                   # GitHub OIDC federated credentials
│   ├── rbac.tf                         # role assignments on subscription/RG scope
│   ├── outputs.tf                      # client_ids for AZURE_CLIENT_ID_<ENV>
│   ├── versions.tf                     # required_providers, required_version
│   └── env/
│       ├── dev.tfvars.example
│       ├── stg.tfvars.example
│       └── prod.tfvars.example
├── infrastructure/
│   ├── main.tf                         # provider, backend, locals
│   ├── variables.tf
│   ├── rg.tf                           # resource group per env
│   ├── kv.tf                           # Key Vault, no secrets defined here (Phase 2)
│   ├── observability.tf                # Log Analytics workspace + App Insights
│   ├── outputs.tf                      # kv name, law id, app_insights connection string name
│   ├── versions.tf
│   └── env/
│       ├── dev.tfvars.example
│       ├── stg.tfvars.example
│       └── prod.tfvars.example
├── scripts/
│   └── bootstrap-tfstate.sh            # one-time per-env Azure Storage creation
├── .gitignore                          # *.tfstate*, *.tfvars (except *.tfvars.example), .terraform/, .env*
├── .pre-commit-config.yaml             # terraform_fmt, terraform_validate, tflint, gitleaks
├── .tflint.hcl
├── .tfsec.yml                          # any project-specific ignores, documented
├── CODEOWNERS
├── Makefile                            # plan-<root>-<env>, apply-<root>-<env>, validate, lint
├── README.md
├── SECURITY.md
└── LICENSE                             # MIT, already present
```

Files NOT listed are intentionally absent in Phase 1. No App Service module, no Postgres module, no Front Door module — those are Phase 2 work.

---

## Phase A — Repo scaffolding

### Task A.1: README, SECURITY, CODEOWNERS, .gitignore

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `README.md`
- Create: `SECURITY.md`
- Create: `CODEOWNERS`
- Create: `.gitignore`

- [ ] **Step 1: Write `.gitignore`**

```
# Terraform
*.tfstate
*.tfstate.*
*.tfstate.backup
.terraform/
.terraform.lock.hcl
crash.log
crash.*.log

# tfvars — only examples are committed
*.tfvars
!*.tfvars.example

# Local env
.env
.env.*
!.env.example

# macOS / editor
.DS_Store
.idea/
.vscode/

# tflint / tfsec caches
.tflint.d/
```

- [ ] **Step 2: Write `CODEOWNERS`**

```
* @hmcts/dts-portfolio-portal
```

- [ ] **Step 3: Write `SECURITY.md`** — copy the body from `hmcts/courtstranscribe/SECURITY.md`; replace product name and disclosure-contact email per HMCTS standard.

- [ ] **Step 4: Write `README.md`** — sections: purpose, two-roots layout, prerequisites (Terraform, Azure CLI, gh), local workflow (`make plan-platform-dev`), CI shape, `INFRA_DISPATCH_ENABLED` flag and why it's `false`, link to the stack-design spec in the app repo by URL (not by relative path — the infra repo is a different repo).

- [ ] **Step 5: Commit**

```bash
git add README.md SECURITY.md CODEOWNERS .gitignore
git commit -m "chore: scaffold README, security, codeowners, gitignore"
```

### Task A.2: Makefile

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `Makefile`

**Rationale:** Keeping the Makefile per spec §5.3 and ADR-010, but thin. Each target is a single composed `terraform` invocation; the value is documented entrypoints (`make plan-infrastructure-dev`) instead of memorised init/backend-config strings. Documented as such in a leading comment.

- [ ] **Step 1: Write the Makefile** — targets: `fmt`, `fmt-check`, `validate`, `lint` (tflint), `sec` (tfsec), `plan-<root>-<env>`, `apply-<root>-<env>` for `root in {platform, infrastructure}` and `env in {dev, stg, prod}`. `apply-*` targets `@echo "Refusing to apply: INFRA_DISPATCH_ENABLED must be true"; exit 1` if the env var is unset/false.

Example skeleton (full Makefile in actual file):

```make
.PHONY: fmt fmt-check validate lint sec
ENV ?= dev
ROOTS := platform infrastructure
ENVS := dev stg prod

fmt:
	terraform -chdir=platform fmt -recursive
	terraform -chdir=infrastructure fmt -recursive

fmt-check:
	terraform -chdir=platform fmt -recursive -check
	terraform -chdir=infrastructure fmt -recursive -check

validate:
	cd platform && terraform init -backend=false && terraform validate
	cd infrastructure && terraform init -backend=false && terraform validate

# Generated targets: plan-platform-dev, plan-infrastructure-stg, etc.
$(foreach r,$(ROOTS),$(foreach e,$(ENVS),plan-$(r)-$(e))):
	@root=$$(echo $@ | cut -d- -f2); env=$$(echo $@ | cut -d- -f3); \
	  cd $$root && terraform init -backend-config="env/$$env.backend.hcl" \
	            && terraform plan -var-file="env/$$env.tfvars"
```

- [ ] **Step 2: Test the Makefile by running `make fmt-check` and `make validate`** in the empty roots (they exist as Task B onwards; for now expect "no .tf files yet"). Update README to reference these targets.

- [ ] **Step 3: Commit** — `chore: add Makefile with plan/apply/validate/lint targets`

### Task A.3: Pre-commit hooks

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `.pre-commit-config.yaml`
- Create: `.tflint.hcl`
- Create: `.tfsec.yml`

- [ ] **Step 1: Write `.pre-commit-config.yaml`**

```yaml
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.96.1
    hooks:
      - id: terraform_fmt
      - id: terraform_validate
        args: [--hook-config=--retry-once-with-cleanup=true]
      - id: terraform_tflint
      - id: terraform_tfsec
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-merge-conflict
      - id: detect-private-key
```

- [ ] **Step 2: Write `.tflint.hcl`** — enable `terraform_deprecated_interpolation`, `terraform_unused_declarations`, `terraform_naming_convention`, `azurerm` ruleset.

- [ ] **Step 3: Write `.tfsec.yml`** — empty placeholder (`exclude: []`) with a comment that any project-specific exclusion needs a justification line.

- [ ] **Step 4: Install hooks locally and run `pre-commit run --all-files`** — expect pass on the empty repo.

- [ ] **Step 5: Commit** — `chore: pre-commit hooks for terraform fmt/validate/tflint/tfsec + gitleaks`

---

## Phase B — Remote state bootstrap

### Task B.1: tfstate bootstrap script

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `scripts/bootstrap-tfstate.sh`

**Rationale:** Remote state is the chicken-and-egg problem. The bootstrap script is the one-time human-run path that creates the Storage Account + Container that Terraform uses. It is **not** part of CI and never runs from `terraform apply`; it's `az` CLI only, idempotent, and is run by a human with `Owner` on the subscription once per environment.

- [ ] **Step 1: Write `bootstrap-tfstate.sh`** — Bash with `set -euo pipefail`, takes `ENV` (`dev|stg|prod`) as the only positional arg. Creates: RG `rg-dts-portfolio-portal-tfstate-<env>`, SA `sadtsportfolioportaltfstate<env>` (with deterministic suffix), containers `platform` and `infrastructure`. Sets `allow_blob_public_access=false`, enables soft-delete on blobs, applies `azurerm-state-lock` lease tooling note in README.

- [ ] **Step 2: README addendum** — under "Bootstrapping a new environment", document that `bootstrap-tfstate.sh <env>` must be run **once** per environment, by a human, before any `terraform init`. Document the required `az login` scope and the resulting Storage account/container names.

- [ ] **Step 3: Test by running with `--dry-run`** flag — script prints the `az` commands it would run, exits 0. (Real run blocked by CLAUDE.md "no destructive estate actions overnight"; user runs the real bootstrap manually when ready.)

- [ ] **Step 4: Commit** — `feat(scripts): tfstate bootstrap, idempotent, --dry-run supported`

### Task B.2: Per-env backend config files

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `platform/env/{dev,stg,prod}.backend.hcl`
- Create: `infrastructure/env/{dev,stg,prod}.backend.hcl`

- [ ] **Step 1: Write each backend.hcl** referencing the SA/container/key name that the bootstrap script will create. No secrets; just resource names and the state key (`platform.tfstate` vs `infrastructure.tfstate`).

```hcl
# platform/env/dev.backend.hcl
resource_group_name  = "rg-dts-portfolio-portal-tfstate-dev"
storage_account_name = "sadtsportfolioportaltfstatedev"
container_name       = "platform"
key                  = "platform.tfstate"
```

- [ ] **Step 2: Commit** — `feat: per-env Terraform backend configs (state in Azure Storage)`

---

## Phase C — Platform root

Defines the identity model. Provisions user-assigned managed identities per environment and federates them with GitHub OIDC, so deploy workflows authenticate to Azure without storing client secrets in GitHub. **This is the root that gates everything else** — every other Terraform action authenticates as one of these identities.

### Task C.1: Platform root scaffolding

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `platform/main.tf`
- Create: `platform/versions.tf`
- Create: `platform/variables.tf`
- Create: `platform/outputs.tf`

- [ ] **Step 1: Write `versions.tf`** — pin `required_version = "~> 1.10"`, providers `azurerm ~> 4.10`, `azuread ~> 3.0`, `github ~> 6.4`. Provider blocks with `features {}` only — no hardcoded subscription IDs.

- [ ] **Step 2: Write `main.tf`** — backend = `azurerm` (config supplied via `-backend-config=env/<env>.backend.hcl`), `provider "azurerm"` with `features {}`. Locals for `app_name = "dts-portfolio-portal"`, `env = var.env`, `tags = { product = "DTS Portfolio Portal", env = var.env, owner = "DTS", repo = "hmcts/dts-portfolio-portal-infra" }`.

- [ ] **Step 3: Write `variables.tf`** — `env` (string, `dev|stg|prod`), `location` (default `uksouth`), `github_org` (default `hmcts`), `app_repo` (default `dts-portfolio-portal`), `infra_repo` (default `dts-portfolio-portal-infra`), `app_environments` (list — `["dev", "stg", "prod"]` but actually just the matching env).

- [ ] **Step 4: Run `terraform -chdir=platform fmt && terraform -chdir=platform validate`** — expect clean (no resources yet; just provider boilerplate).

- [ ] **Step 5: Commit** — `feat(platform): scaffold root, providers, locals, variables`

### Task C.2: User-assigned managed identities (CI + runtime)

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `platform/identity.tf`
- Modify: `platform/outputs.tf`

**Rationale:** Two UAMIs per env:
1. `uami-dts-portfolio-portal-ci-<env>` — used by GHA via OIDC to run `terraform apply` against the matching env. Has narrowly scoped RBAC (see Task C.4).
2. `uami-dts-portfolio-portal-app-<env>` — assigned to the App Service in Phase 2; consumes KV / ACR / AOAI / Postgres via managed identity. Created here so its client_id is known to the platform root.

- [ ] **Step 1: Write `identity.tf`** — `azurerm_user_assigned_identity` × 2 with the names above, in a platform RG (`rg-dts-portfolio-portal-platform-<env>`) created at the top of the file.

- [ ] **Step 2: Add outputs** — `ci_uami_client_id`, `app_uami_client_id`, `ci_uami_principal_id`, `app_uami_principal_id`. These feed into the env-scoped GitHub Secret `AZURE_CLIENT_ID_<ENV>` (set manually after first apply, or via `gh secret set`).

- [ ] **Step 3: `terraform validate` + `tflint`** — both clean.

- [ ] **Step 4: Commit** — `feat(platform): user-assigned managed identities for CI + runtime per env`

### Task C.3: GitHub OIDC federation

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `platform/federation.tf`

- [ ] **Step 1: Write `federation.tf`** — `azurerm_federated_identity_credential` × 3 per CI UAMI:
  1. Subject `repo:hmcts/dts-portfolio-portal-infra:environment:<env>` — for infra repo deploy workflows running against this env
  2. Subject `repo:hmcts/dts-portfolio-portal-infra:ref:refs/heads/main` — for plan-on-PR / drift-check workflows on main
  3. Subject `repo:hmcts/dts-portfolio-portal-infra:pull_request` — for plan-on-PR from branches

  Issuer fixed to `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`.

- [ ] **Step 2: `terraform validate` + `tflint`** — clean.

- [ ] **Step 3: Commit** — `feat(platform): federate GitHub OIDC subjects to CI UAMI per env`

### Task C.4: RBAC role assignments (least privilege)

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `platform/rbac.tf`

**Rationale:** Per stack-design §3.3 "No hardcoded subscription IDs" — role assignments scoped via `data` lookups, not literal IDs. CI identity gets the minimum needed to manage the `infrastructure/` root's resources for its env (and nothing else). App identity gets nothing here in Phase 1 — its grants on KV/ACR/AOAI/Postgres are wired up alongside those resources in Phase 2.

- [ ] **Step 1: Write `rbac.tf`** — for the CI UAMI per env:
  - `Contributor` on the env RG (`rg-dts-portfolio-portal-<env>`) once created; until then on the subscription with `condition_version = "2.0"` and a condition that limits scope to RGs tagged `product = "DTS Portfolio Portal"` + `env = <env>`. Document the condition string in a comment.
  - `Role Based Access Control Administrator` on the env RG (needed so `terraform apply` of the infrastructure root can assign roles to the app UAMI when Phase 2 lands).
  - Explicitly no `Owner`.

- [ ] **Step 2: `terraform validate` + `tflint` + `tfsec`** — all clean.

- [ ] **Step 3: Commit** — `feat(platform): least-privilege RBAC for CI UAMI per env`

### Task C.5: Platform root happy-path plan check

**Repo:** `hmcts/dts-portfolio-portal-infra`

- [ ] **Step 1: Locally, against a real Azure subscription with a freshly-bootstrapped tfstate SA (one user-run setup), run `make plan-platform-dev`.** Expect a plan that creates: 1 platform RG, 2 UAMIs, 3 federated credentials per UAMI, ~4 role assignments. Zero destroys.

- [ ] **Step 2: Save plan output to a sanitised `docs/platform-dev-plan.example.txt`** with subscription/tenant IDs masked. Add to repo as the canonical example. **Do not run `apply`.**

- [ ] **Step 3: Commit** — `docs(platform): record sanitised dev plan as canonical example`

---

## Phase D — Infrastructure root foundations

The "infrastructure" root holds the per-env product resources. Phase 1 lands only what doesn't carry runtime risk: RG, Key Vault (no secret values yet — Phase 2 wires them up), Log Analytics workspace, Application Insights. These four are safe to provision now because nothing in the app depends on them yet — they sit idle until App Service / Postgres / AOAI arrive in Phase 2.

### Task D.1: Infrastructure root scaffolding

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `infrastructure/main.tf`
- Create: `infrastructure/versions.tf`
- Create: `infrastructure/variables.tf`
- Create: `infrastructure/outputs.tf`

- [ ] **Step 1: Write `versions.tf`** — same pins as platform root.

- [ ] **Step 2: Write `main.tf`** — backend, provider, locals (same naming convention as platform).

- [ ] **Step 3: Write `variables.tf`** — `env`, `location`, plus `app_uami_principal_id` (output of platform root, supplied via `terraform_remote_state` data source — define that here).

- [ ] **Step 4: `terraform validate`** — clean.

- [ ] **Step 5: Commit** — `feat(infrastructure): scaffold root, providers, locals, variables`

### Task D.2: Resource group

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `infrastructure/rg.tf`

- [ ] **Step 1: Write `rg.tf`** — single `azurerm_resource_group "main"` with name `rg-dts-portfolio-portal-<env>`, tags from `local.tags`.

- [ ] **Step 2: `terraform validate` + `tflint`** — clean.

- [ ] **Step 3: Commit** — `feat(infrastructure): env resource group`

### Task D.3: Key Vault (resource only — secrets land in Phase 2)

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `infrastructure/kv.tf`

**Rationale:** KV provisioned without any `azurerm_key_vault_secret` resources. Phase 2 adds the secrets (DATABASE_URL placeholder for Postgres Entra-token rotation pattern, AOAI key if needed). Setting up access policies / RBAC for the app UAMI now keeps Phase 2 clean.

- [ ] **Step 1: Write `kv.tf`** — `azurerm_key_vault` with:
  - `sku_name = "standard"`
  - `enable_rbac_authorization = true` (no access policies; clean RBAC model)
  - `purge_protection_enabled = true`
  - `soft_delete_retention_days = 90`
  - `public_network_access_enabled = false` (private endpoint added in Phase 2 alongside VNet)
  - Network ACLs default-deny; CI UAMI added to bypass

  Plus a `azurerm_role_assignment` granting the **app UAMI** (looked up from platform-root remote state) the `Key Vault Secrets User` role. The CI UAMI gets `Key Vault Administrator` so it can manage secrets when Phase 2 lands.

- [ ] **Step 2: `terraform validate` + `tflint` + `tfsec`** — all clean. tfsec may flag the lack of a private endpoint; suppress with a comment referencing this plan (Phase 2 adds the endpoint; provisioning a stub KV without one is acceptable for Phase 1 because no secrets exist in it yet).

- [ ] **Step 3: Commit** — `feat(infrastructure): Key Vault (RBAC mode, public network disabled, no secrets defined)`

### Task D.4: Log Analytics + Application Insights

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `infrastructure/observability.tf`

- [ ] **Step 1: Write `observability.tf`** — `azurerm_log_analytics_workspace` (PerGB2018, 30-day retention for dev/stg, 90-day for prod via `var.env == "prod" ? 90 : 30`), `azurerm_application_insights` (workspace-based, linked to the LAW).

- [ ] **Step 2: Add outputs** — `application_insights_connection_string_secret_name` (placeholder; the actual KV secret writing waits until Phase 2). Note: the connection string itself should NOT be in Terraform output as a value — only the KV secret *name* that Phase 2 will write into.

- [ ] **Step 3: `terraform validate` + `tflint` + `tfsec`** — all clean.

- [ ] **Step 4: Commit** — `feat(infrastructure): Log Analytics workspace + workspace-based App Insights`

### Task D.5: Infrastructure root happy-path plan check

**Repo:** `hmcts/dts-portfolio-portal-infra`

- [ ] **Step 1: Locally (assuming platform-dev applied first), run `make plan-infrastructure-dev`.** Expect a plan that creates: 1 RG, 1 KV with 2 role assignments, 1 LAW, 1 App Insights. Zero destroys.

- [ ] **Step 2: Save sanitised plan to `docs/infrastructure-dev-plan.example.txt`**, masked.

- [ ] **Step 3: Commit** — `docs(infrastructure): record sanitised dev plan as canonical example`

---

## Phase E — CI workflows

### Task E.1: secrets-scanner + codeql (verbatim from courtstranscribe)

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `.github/workflows/secrets-scanner.yml`
- Create: `.github/workflows/codeql.yml`

- [ ] **Step 1: Copy `secrets-scanner.yml` from `hmcts/courtstranscribe`** verbatim. Verify no Python-specific paths in the include list.

- [ ] **Step 2: Copy `codeql.yml`** — adapt language matrix (`actions` only; Terraform isn't a CodeQL language).

- [ ] **Step 3: Commit** — `ci: secrets-scanner + codeql workflows (courtstranscribe pattern)`

### Task E.2: terraform-ci.yml

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `.github/workflows/terraform-ci.yml`

**Triggers:** PR to `main`, push to `main`.

**Jobs:**
1. `fmt-check` — `terraform fmt -recursive -check` on both roots
2. `validate` — `terraform init -backend=false && terraform validate` on both roots
3. `tflint` — `tflint --recursive` on both roots
4. `tfsec` — `tfsec .` on both roots

- [ ] **Step 1: Write the workflow** — matrix on `root: [platform, infrastructure]`. No Azure auth (validate doesn't need it; tfsec/tflint are static).

- [ ] **Step 2: Push as a draft PR** and confirm all four checks go green on the empty roots, then on the populated ones.

- [ ] **Step 3: Commit** — `ci: terraform fmt-check + validate + tflint + tfsec on PR`

### Task E.3: Deploy workflows (skeletons, disabled)

**Repo:** `hmcts/dts-portfolio-portal-infra`

**Files:**
- Create: `.github/workflows/deploy-dev.yml`
- Create: `.github/workflows/deploy-stg.yml`
- Create: `.github/workflows/deploy-prod.yml`

**Rationale:** Stack-design §3.4 specifies `repository_dispatch` from the app repo as the trigger. The handler exists as a skeleton in Phase 1 — listens for the dispatch, gates the actual work behind the repo variable `INFRA_DISPATCH_ENABLED` per CLAUDE.md. Default is `false`; nothing applies overnight.

- [ ] **Step 1: Write `deploy-dev.yml`** — trigger on `repository_dispatch` with type `deploy-dev`. First step: `if: vars.INFRA_DISPATCH_ENABLED != 'true'` → `echo "INFRA_DISPATCH_ENABLED is false, skipping" && exit 0`. Subsequent steps: `terraform plan` only in Phase 1 (no apply). Apply step is `if: false` with a comment "enabled in Phase 2 once App Service module lands".

- [ ] **Step 2: Repeat for stg and prod** — prod additionally requires the `prod` GitHub Environment with reviewers.

- [ ] **Step 3: Commit** — `ci: deploy-<env> workflows as gated skeletons (INFRA_DISPATCH_ENABLED defaults false)`

### Task E.4: Documentation — `INFRA_DISPATCH_ENABLED` lifecycle

**Repo:** `hmcts/dts-portfolio-portal-infra`

- [ ] **Step 1: Add a `docs/dispatch-flag-lifecycle.md`** explaining: what the flag does, who flips it, the manual checklist (bootstrap tfstate ✅, platform applied ✅, AZURE_CLIENT_ID_<ENV> secrets set ✅, smoke run of plan-only deploy ✅) before flipping.

- [ ] **Step 2: Link from `README.md`** under "Going live".

- [ ] **Step 3: Commit** — `docs: INFRA_DISPATCH_ENABLED lifecycle and pre-flip checklist`

---

## Phase F — App-repo wiring (small change in this repo)

### Task F.1: Document the app-repo side of cross-repo dispatch

**Repo:** `hmcts/dts-portfolio-portal` (this repo)

**Files:**
- Modify: `docs/decisions/2026-05-19-adr-010-deploy-pipeline.md` — append a "Status: implemented through Phase F of infra plan" note if accurate.
- Create: `.github/workflows/dispatch-infra-deploy.yml.stub` (named `.stub` so it doesn't activate; real activation in Phase 2)

- [ ] **Step 1: Create the stub** — show the intended `repository_dispatch` POST shape, the `INFRA_DISPATCH_TOKEN` / GitHub App lookup, the payload (env, version, run_id).

- [ ] **Step 2: Add a one-paragraph addendum to ADR-010** linking to this plan.

- [ ] **Step 3: Commit on a branch in this repo** — `docs(adr-010): note Phase 1 infra plan; stub the dispatch workflow`

---

## Out of scope for this plan (Phase 2 candidates)

Listed so reviewers can confirm the scope split is sensible:

- `infrastructure/network.tf` — VNet + subnets for App Service + Postgres private endpoints
- `infrastructure/app_service.tf` — App Service plan + Web App for Containers + staging slot + custom domain
- `infrastructure/postgres.tf` — Postgres Flexible Server + private endpoint + databases + Entra admin
- `infrastructure/front_door.tf` — Front Door + WAF policy
- `infrastructure/aoai.tf` — Azure OpenAI account + deployment + content-filter policy
- `infrastructure/kv_secrets.tf` — populate Key Vault with the secrets the app needs to read
- `infrastructure/app_rbac.tf` — App UAMI → ACR Pull, KV Secrets User, Postgres Entra grant, AOAI Cognitive Services User
- Deploy workflow `apply` steps un-gated; `INFRA_DISPATCH_ENABLED` documented as ready to flip

Each gets its own task block in the Phase 2 plan, with the same "tests precede code" discipline (terraform validate / tflint / tfsec / plan-output review).

---

## Self-Review (writing-plans skill checklist)

1. **Spec coverage:** ✅ All Phase-1-shaped requirements from stack-design (§3, §4 partial, §5.3, §6.3, §6.6, §6.7 partial, §8.5) are covered. Phase 2 covers the §4 runtime resources I haven't tasked here.
2. **Placeholder scan:** No "TBD" / "implement later" / "similar to" patterns. Each task has files + code snippets where code is required.
3. **Type consistency:** All resource names follow `<resource-prefix>-dts-portfolio-portal[-<role>]-<env>`. Tag schema (`product`, `env`, `owner`, `repo`) consistent across roots.
4. **Plan scope:** Sized for one reviewable PR per phase (A–F), six PRs total. Each PR is < 500 lines diff. Total infra repo line count at end of plan ≈ 1200 lines including comments.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-21-infra-phase-1.md`.

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit because the tasks are largely independent (each file is contained), and CLAUDE.md's "no deploy overnight" rule keeps the loop safe.

**2. Inline Execution** — I execute tasks in this session. Slower; risks context bloat across six phases.

Recommend (1). Which approach?
