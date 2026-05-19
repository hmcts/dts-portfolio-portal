---
title: DTS Portfolio Portal — Azure Stack Design
date: 2026-05-19
status: Design-ready
purpose: Capture the stack decisions that the requirements spec deferred to Phase 0. Companion design doc to the requirements spec, ahead of formal ADR authoring.
related:
  - docs/superpowers/specs/2026-05-15-dts-portfolio-portal-design.md
  - docs/superpowers/plans/2026-05-15-dts-portfolio-portal.md
  - docs/decisions/README.md
---

# DTS Portfolio Portal — Azure Stack Design

## 1. Purpose

The requirements spec (2026-05-15) intentionally deferred architecture to Phase 0 of the implementation plan. This document captures the stack decisions reached on 2026-05-19, ahead of formal Phase 0 ADR authoring. It establishes:

- The Azure services the portal will use
- The frameworks and libraries it will be built with
- The repository topology and visibility model
- The CI/CD pipeline shape, derived from the HMCTS `courtstranscribe` pattern
- The engineering disciplines that hold across both repos

Phase 0 still runs as the formal ADR authoring phase, but uses this design as its seed — converting these decisions into reviewed-and-signed-off ADRs rather than re-litigating them. Where this document and Phase 0 ADRs disagree, the ADR is authoritative; this design exists to make Phase 0 a fast sign-off rather than a long deliberation.

## 2. Constraints driving the design

These are the inputs the design optimises for. Decisions trace back to one or more of these.

| # | Constraint | Source |
|---|---|---|
| C1 | **Code in the open.** The application repository is public. The default for every file is "what does someone outside HMCTS infer from this?" | User direction, 2026-05-19 |
| C2 | **HMCTS Azure tenancy.** Deployment targets are within HMCTS-managed Azure subscriptions; ACR is pre-provisioned at `hmctsprod.azurecr.io`. | Existing HMCTS practice |
| C3 | **Maintenance-first stack choices.** Where two tools are equivalent, choose the one a typical JS/TS team will recognise. | User direction, 2026-05-19 |
| C4 | **AS → AKS migration optionality.** Containerise the app from day one so the same image can move to AKS without rebuild if HMCTS PlatOps later mandates it. | User direction, 2026-05-19 |
| C5 | **TDD as a contract.** Untested code is not done; CI gates a coverage threshold. | User direction, 2026-05-19 |
| C6 | **Reuse over re-invention.** Where the `hmcts/courtstranscribe` repo provides a battle-tested pattern (versioning, CHANGELOG, ACR push, secrets scanning, deploy tags), duplicate with adaptation rather than designing fresh. | User direction, 2026-05-19 |
| C7 | **High altitude.** The portal stays at portfolio altitude; the stack must not invite operational-detail features. | Requirements spec §1, §3.2 |

## 3. Repository topology

### 3.1 Two repositories

| Repo | Visibility | Contents |
|---|---|---|
| `hmcts/dts-portfolio-portal` | **Public** | Next.js app code, Prisma schema + migrations, Dockerfile, GHA workflows (CI + deploy-tag emission), documentation |
| `hmcts/dts-portfolio-portal-infra` | **Internal** (intent to publish; see §3.3) | Terraform: `infrastructure/` + `platform/` roots, GHA workflows for `terraform apply` triggered by cross-repo dispatch |

### 3.2 Why split

The application code is published openly per the HMCTS "Coded in the Open" posture. Infrastructure-as-code is no less defensible in public if disciplined, but it reveals an architecture blueprint that gives reconnaissance value to an attacker: every Azure resource, every config flag, every SKU, every identity, every secret name in Key Vault. HMCTS-DTS practice on IaC publicity is uneven; some `cnp-*` repos are public, many service-specific `*-infra` repos are private. The cautious play is to start the infra repo at internal visibility and graduate it to public once PlatOps confirms a position.

### 3.3 "Build as if public from day one"

Even at internal visibility, the infra repo follows the same disciplines a public repo would. The discipline list (also captured in §8):

- No hardcoded subscription IDs, tenant IDs, object IDs — variables read from GitHub Secrets at apply time
- All sensitive values via Key Vault — Terraform uses `data "azurerm_key_vault_secret"` referencing only KV ID and secret name
- Remote Terraform state in Azure Storage, encrypted at rest, access restricted to the federated CI identity — never committed
- `.gitignore` blocks `*.tfstate*`, `*.tfvars` (except `*.tfvars.example`), `.terraform/`
- Resource names embed the public project name; no internal codenames or customer references
- No internal hostnames, IPs, or stakeholder names in comments or commit messages
- Plan output never posted to PR comments verbatim (uses summarising tooling, or posted to step summary only)

Flipping to public becomes a one-line repo-settings change, no remediation lag.

### 3.4 Cross-repo deploy orchestration

```
App repo (public)                         Infra repo (internal)
─────────────────                         ─────────────────────
push to main / release / workflow_dispatch
  │
  ▼
ci-build-images.yml
  ├── version (hmcts/artefact-version-action@v1)
  ├── changelog (orhun/git-cliff-action@v4)
  ├── build Docker image
  └── push to hmctsprod.azurecr.io
  │
  ▼
deploy-<env>.yml
  ├── push deploy-<env>-<version>-<runid> tag
  └── repository_dispatch ──────────────► deploy-<env>.yml (infra)
                                            ├── terraform plan (precheck)
                                            ├── terraform apply
                                            ├── az webapp config set --linuxFxVersion
                                            ├── az webapp restart
                                            └── smoke test
```

The app repo's deploy workflow produces an image and records the deploy intent (tag + dispatch). The infra repo's deploy workflow realises it (terraform + App Service update). Both repos consume the same per-environment GitHub Secrets (`AZURE_CLIENT_ID_<ENV>`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`) via OIDC federation against the platform-provisioned managed identities.

### 3.5 Authentication for cross-repo dispatch

`repository_dispatch` from the app repo to the infra repo requires a token with `repo` scope on the target. Two options, in order of preference:

1. **GitHub App** installed on both repos with `contents:write` and `actions:write`. App credentials stored as `INFRA_DISPATCH_APP_ID` / `INFRA_DISPATCH_PRIVATE_KEY` in the app repo. No PAT rotation overhead.
2. **Fine-scoped PAT** stored as `INFRA_DISPATCH_TOKEN`. Simpler to set up; requires manual rotation.

Phase 1 task to decide and provision. ADR-009 (new, see §10) captures the choice.

## 4. Azure services

| Service | Purpose | Configuration notes |
|---|---|---|
| **App Service for Linux** (Web App for Containers) | Host the Next.js container | Production tier (P1v3 or per cnp guidance); staging slot for blue/green |
| **HMCTS ACR** (`hmctsprod.azurecr.io`) | Container image registry | Already provisioned — no incremental cost; image pull via App Service managed identity |
| **Azure Front Door** | CDN + WAF in front of App Service | Standard tier; WAF rules per HMCTS baseline |
| **Azure Database for PostgreSQL Flexible Server** | Content store, audit log, full-text search index | Entra authentication only (`password_auth_enabled = false`); private endpoint; geo-redundant backup |
| **Azure OpenAI** | Markdown parsing (Phase 2), answer-card synthesis (Phase 3) | Structured-output mode (JSON schema or function calling); cache parses by source-markdown hash |
| **Easy Auth → Microsoft Entra ID** | Authentication | Platform-level sidecar on App Service; consumes `X-MS-CLIENT-PRINCIPAL` header inside the app — no auth library in code for v1 |
| **Azure Key Vault** | Secrets storage | Accessed via App Service user-assigned managed identity; Terraform references by secret name |
| **Application Insights + Log Analytics** | Observability | Auto-instrumented from Next.js + structured logging via `pino` |

### 4.1 Identity model

Every service-to-service connection uses managed identity. No connection strings with passwords:

- App Service → Postgres Flexible Server: Entra token via managed identity
- App Service → ACR (image pull): managed identity assigned `AcrPull`
- App Service → Azure OpenAI: managed identity tokens; SDK uses `DefaultAzureCredential`
- App Service → Key Vault: managed identity with access policy granting `get` on relevant secrets

The platform Terraform root provisions the managed identities and their RBAC; the infrastructure root consumes them.

## 5. Frameworks and libraries

### 5.1 Application

| Library | Purpose |
|---|---|
| **Next.js (App Router)** | Web framework — SSR, RSC, routing — ADR-001 |
| **React** + **TypeScript** | Component model + types |
| **Tailwind CSS** | Utility CSS for the visual language — ADR-007 |
| **shadcn/ui** | Component primitives, copy-paste style (not a runtime dep) — ADR-007 |
| **Lucide** | Icon family — ADR-007 |
| **Geist** | UI font, served via `next/font` — ADR-007 |
| **Prisma** + `@prisma/client` | DB access; Prisma Migrate for schema changes — ADR-002 |
| **Zod** | Runtime schema validation for entity types and API I/O |
| **gray-matter** | YAML front-matter parsing in markdown uploads |
| **unified** / **remark** / **rehype** / **rehype-sanitize** | Markdown → safe HTML pipeline |
| **`openai`** SDK (Azure-configured) | Talks to Azure OpenAI |
| **pino** | Structured logging; auto-shipped to Application Insights |

### 5.2 Build, test, lint

| Tool | Purpose |
|---|---|
| **pnpm** | Package manager — aligns with courtstranscribe |
| **ESLint + Prettier** | Lint + format — conservative; widest familiarity |
| **Vitest** | Unit tests — ESM-native |
| **Playwright** | End-to-end tests |
| **@axe-core/playwright** | Accessibility tests in the E2E suite |
| **Docker** | Image build using Next.js `output: 'standalone'` |
| **docker compose** | Local dev: app + Postgres in one command, parity with CI |

### 5.3 Infrastructure

| Tool | Purpose |
|---|---|
| **Terraform** + `azurerm` provider | All Azure resources |
| **Two roots:** `infrastructure/` + `platform/` | App resources vs identity / OIDC / RBAC (cnp pattern) |
| **Remote state** in Azure Storage | Per-env containers (`tfstate-dev`, `tfstate-stg`, `tfstate-prod`); `app.tfstate` + `platform.tfstate` keys |
| **Makefile** | `make setup-<env>` (init + plan) + `make apply-<env>` (apply after review) |

## 6. CI/CD pipeline derived from courtstranscribe

### 6.1 Workflows duplicated from courtstranscribe

Light adaptation noted where it applies:

| File | Adaptation |
|---|---|
| `.github/workflows/secrets-scanner.yml` | Copy as-is |
| `.github/workflows/codeql.yml` | Copy as-is |
| `.github/workflows/code-analysis.yml` | Adapt for Node toolchain |
| `.github/workflows/prune-deploy-tags.yml` | Copy as-is (env-agnostic) |
| `.github/workflows/deploy-status.yml` | Copy as-is |
| `cliff.toml` | Copy as-is (git-cliff config) |
| `.pre-commit-config.yaml` | Adapt to Node hooks |

### 6.2 Workflows adapted in shape

| courtstranscribe | Adapted for portal |
|---|---|
| `ci-build-images.yml` | Single build job, single image, single CHANGELOG (no frontend/backend split) |
| `deploy-dev.yml` / `deploy-stg.yml` / `deploy-prod.yml` | Same pattern; fires `repository_dispatch` to infra repo instead of waiting for ADO |
| `sbom.yml` | Single SBOM via `npx @cyclonedx/cdxgen -t pnpm --required-only`, PR + weekly cron |
| `python-alembic-migration-check.yaml` | `db-migration-check.yml` — `npx prisma migrate deploy && npx prisma migrate status` against service Postgres |
| `tests.yml` | Vitest unit + Playwright E2E + axe-core a11y, against service Postgres |

### 6.3 Workflows not copied

- Anything Python-specific (`uv`, `pyproject.toml`, Alembic)
- ADO pipeline YAMLs (`azure-infra-pipeline.yml`, `pipelines/deploy-jobs.yml`) — ADO is deferred; see §9
- `.cruft.json` cookiecutter marker

### 6.4 Versioning and changelog

| Event | Output | Example |
|---|---|---|
| `push` / `workflow_dispatch` | `draft_version` from `hmcts/artefact-version-action@v1` | `0.1.2-a1b2c3d` |
| `release: published` | `release_version` | `0.1.2` |

Released versions are SemVer, sourced from the `v*` git tag. Draft versions append a SHA. `git-cliff` generates a single `CHANGELOG.md` from conventional-commit history on release events; placeholder content on non-release builds keeps the Dockerfile `COPY` honest.

Commit hygiene: **conventional commits** (`feat:`, `fix:`, `chore:`, etc.) enforced via a PR-title check (not commit-by-commit; squash merges normalise the trailing history).

### 6.5 Deploy tag format and lifecycle

```
deploy-<env>-<version>-<run_id>

deploy-dev-0.1.2-a1b2c3d-25566933121     # dev draft from a push to main
deploy-stg-0.1.4-25812345678              # stg from a published release
deploy-prod-0.1.4-25812345700             # prod promotion of an existing image
```

- `<env>` is `dev`, `stg`, or `prod`
- `<version>` is the artefact version (draft or release)
- `<run_id>` makes every deploy tag unique even when re-running the same version

The infra repo's `repository_dispatch` handler reads `<env>` and `<version>` from the payload, runs the matching terraform root, then `az webapp config set --linuxFxVersion=hmctsprod.azurecr.io/<image>:<version>` against the env's App Service.

Tag pruning: `prune-deploy-tags.yml` runs weekly. Per courtstranscribe rules — newest 50 dev / 15 stg / 15 prod retained; older deleted; release tags (`v*`) excluded.

### 6.6 GitHub rulesets

| Ruleset | Target | Allow | Deny |
|---|---|---|---|
| Branch protection | `main` (both repos) | merge via PR with ≥1 reviewer; required status checks; signed commits | direct push, force-push, deletion |
| Tag protection: deploy | `deploy-*` (app repo) | `github-actions[bot]` push + delete | everyone else |
| Tag protection: releases | `v*` (app repo) | manual push via Releases UI | force-push, deletion |
| GitHub Environments | `dev`, `stg`, `prod` (both repos) | env-scoped `AZURE_CLIENT_ID_*` secrets; reviewers on `prod` only | — |

Required status checks (app repo) on PRs to `main`: `tests`, `codeql`, `secrets-scanner`, `sbom`, `db-migration-check`, `lint`, `typecheck`, `build`.

### 6.7 GitHub secrets

| Secret | Scope | Source |
|---|---|---|
| `HMCTSPROD_REGISTRY_USERNAME` | org | HMCTS org-provisioned |
| `HMCTSPROD_REGISTRY_PASSWORD` | org | HMCTS org-provisioned |
| `GITLEAKS_LICENSE` | org | HMCTS org-provisioned |
| `AZURE_TENANT_ID` | repo | Set once per repo |
| `AZURE_SUBSCRIPTION_ID` | repo | Set once per repo |
| `AZURE_CLIENT_ID_DEV` / `_STG` / `_PROD` | env-scoped | Output from `make apply-platform-<env>` in the infra repo |
| `INFRA_DISPATCH_APP_ID` + `INFRA_DISPATCH_PRIVATE_KEY` (or `INFRA_DISPATCH_TOKEN`) | repo (app repo only) | GitHub App or fine-scoped PAT — decided in ADR-009 |

## 7. The Azure-first choices, named in one place

The portal commits to Azure-native services wherever Azure offers a fit. Decisions, in one place:

| Concern | Decision | Rejected alternatives | Why |
|---|---|---|---|
| Host | App Service (containers) | Static Web Apps, Container Apps, AKS | Single Node artefact, no Function caps, AS → AKS migration via same image |
| Image registry | HMCTS ACR | Docker Hub, GHCR | Already provisioned; no incremental cost |
| Content store | Postgres Flexible Server | Cosmos DB, Azure SQL | Relational fit; FTS in same store; cheapest path |
| Search | Postgres FTS | Azure AI Search | Adequate at our scale (hundreds of entities); ~£200/month saved; revisit at v2 |
| AI | Azure OpenAI | Anthropic Claude, OpenAI direct, self-hosted | Data residency; HMCTS procurement fit |
| Auth | Easy Auth → Entra ID | NextAuth, msal-node, custom | Platform-level; zero auth library in code for v1 |
| CDN / WAF | Azure Front Door | Cloudflare, native App Service only | Native Azure; WAF baked in |
| Secrets | Azure Key Vault + managed identity | Env vars, GitHub Secrets at runtime | Centralised, auditable, no plaintext |
| Observability | Application Insights + Log Analytics | Sentry, Datadog | Native Azure; managed identity ingestion |

## 8. Engineering disciplines

### 8.1 Code in the open

The app repo is public from day one. Every commit, file, comment, and test fixture must be safe for external readers.

| Discipline | How |
|---|---|
| No secrets in code or commit history | Pre-commit `gitleaks` check; secret scanning + push protection at the org level; `.env*` files gitignored |
| No internal hostnames, IPs, or stakeholder names | Code review check; CODEOWNERS reviewers verify |
| No real PII in seed data, fixtures, or test data | Use plausible-but-fictional HMCTS-flavoured names; production data never travels to non-prod env |
| Commit messages safe to read externally | Jira ticket references are fine (`PORT-1234`); paste content is not |
| Issues, PRs, and discussions assumed public | Don't paste error messages containing real data or internal hostnames |
| `.github/SECURITY.md` | Disclosure policy per HMCTS standard |

### 8.2 Test-driven development

Per C5, untested code is not done.

| Discipline | How |
|---|---|
| Tests precede code | Red → green → refactor on every change |
| Coverage threshold gates CI | Vitest configured at 80% line / 70% branch initially; tightened over time |
| Pure functions over I/O-laced code | Parsing, validation, ranking, formatting are pure; DB / AOAI / HTTP wrapped behind interfaces |
| Small testable units | Function size guideline: if it doesn't fit on a screen, split |
| Integration tests against real services where reasonable | DB tests against a service Postgres in CI (per `db-migration-check.yml`); AOAI tests stubbed; auth tested behind a header-trusted preview mode in non-prod |
| Failing CI test job blocks merge | Required check; no override without explicit reviewer note |

### 8.3 Reuse over re-invention

Per C6.

| Discipline | How |
|---|---|
| Default to duplicating courtstranscribe patterns | When `hmcts/courtstranscribe` has a precedent, copy it. Adapt only with documented reason |
| When adapting, document the why | A comment in the workflow file referencing this design doc and the constraint that drove the adaptation |
| Resist tempting "improvements" that drift from the reference | A patch that improves *and* drifts is a patch that costs sync overhead later. Prefer to upstream improvements to courtstranscribe |

### 8.4 Secrets handling

Per the global `~/.claude/CLAUDE.md` and the constraints above.

| Discipline | How |
|---|---|
| No secrets read into agent context | `set -a; source .env.local; set +a; <command>` patterns; mask when inspecting |
| Secrets live in Key Vault | Terraform references by name only; runtime resolution via managed identity |
| No connection strings with passwords | Entra auth for Postgres; managed identity for AOAI, ACR, KV |
| `.env.example` only in repo | Real `.env*` files gitignored |

### 8.5 Infrastructure repo discipline (even at internal visibility)

Per §3.3.

| Discipline | How |
|---|---|
| No hardcoded subscription/tenant/object IDs | Variables read from GitHub Secrets at apply time |
| No `terraform.tfstate` in repo | Remote backend in Azure Storage, encrypted, restricted-access |
| No `*.tfvars` with real values | Only `*.tfvars.example` placeholder files committed |
| Resource names embed the public project name | No internal codenames or customer references |
| Plan output never posted verbatim to PR comments | Summarised via tooling or written to step summary only |

## 9. Known tech debt

| Item | Why deferred | Trigger to revisit |
|---|---|---|
| **Azure DevOps deploy chain** | All-GHA chosen for simplicity in v1. `courtstranscribe` uses ADO + cnp pipelines for the deploy step; we replicate that in GHA for now. | DTS PlatOps standardisation; or a need to share secrets/SPs with other DTS services that already live in ADO |
| **Infra repo flip to public** | Internal visibility while HMCTS-DTS PlatOps confirms the IaC publicity stance | PlatOps confirms position; or external transparency need drives the question |
| **Azure AI Search** | Postgres FTS adequate at v1 scale. AI Search would unlock RAG-native answer card via "On Your Data". | Search relevance complaints; entity count >5k; need for hybrid keyword + vector search |
| **4-eyes enforcement on approve** | Spec §7.7 — data model supports it; v1 permits self-approval | Governance request; concrete misuse incident |
| **Per-field RBAC** | Out of scope per spec §3.2 | Capability matrix complexity grows beyond "anyone authenticated" |

## 10. Relationship to Phase 0 ADRs

The Phase 0 ADR backlog from `docs/decisions/README.md` grows from 7 to 10 to reflect the decisions captured here:

| ADR | Topic | Locked recommendation (this doc) |
|---|---|---|
| ADR-001 | Web framework and rendering | Next.js (App Router) |
| ADR-002 | Content store (and ORM) | Azure Database for PostgreSQL Flexible Server; Prisma + Prisma Migrate |
| ADR-003 | AI parser | Azure OpenAI |
| ADR-004 | Search backend | Postgres full-text search |
| ADR-005 | Authentication | Easy Auth → Microsoft Entra ID |
| ADR-006 | Hosting and deployment | App Service for Linux (Web App for Containers); image in HMCTS ACR; Front Door in front; AS → AKS migration via same image |
| ADR-007 | Visual language tooling | Tailwind CSS + shadcn/ui + Lucide + Geist |
| **ADR-008** (new) | Platform services | Key Vault + Application Insights + Log Analytics + Front Door; managed-identity-only RBAC |
| **ADR-009** (new) | Repository topology | Two repos: public app, internal-visibility infra (intent to publish); cross-repo dispatch; dispatch via GitHub App (preferred) or fine-scoped PAT |
| **ADR-010** (new) | Deploy pipeline | All-GHA in v1 (courtstranscribe pattern adapted); ADO deferred as known tech debt; cross-repo orchestration via `repository_dispatch` on deploy tags |

Phase 0 sign-off uses this design as the seed; each ADR's "Options considered" still records the alternatives and the rationale for clarity, but Phase 0 should not re-litigate decisions captured here unless a Phase-0 review surfaces evidence that overturns them.

## 11. What this document does not decide

- **Specific Azure resource SKUs and tiers** for non-prod environments — left to the platform Terraform module; informed by HMCTS-DTS cost guidance
- **Front Door rule set details** — informed by the HMCTS WAF baseline
- **Entra app registration shape** — group claim conventions and redirect URIs are Phase 4 detail
- **Specific JSON Schema for AOAI structured output** — Phase 2 detail, shaped by entity types from Task 1.5
- **Postgres backup retention windows** — Phase 5 hardening, informed by the audit log's RPO/RTO target

These remain Phase-specific decisions; this design only constrains the technologies they're made in.
