---
title: Baseline — pre Python + Kubernetes rewrite
date: 2026-07-23
status: Draft (tag applied post-Dependabot-merges)
tag: baseline/pre-python-rewrite
supersedes: n/a
---

# Baseline — pre Python + Kubernetes rewrite

A reference snapshot of the DTS Portfolio Portal codebase before the Python + Kubernetes read-path rewrite (PRs [#53](https://github.com/hmcts/dts-portfolio-portal/pull/53) through [#63](https://github.com/hmcts/dts-portfolio-portal/pull/63)) lands.

## Why baseline

The rewrite replaces the Next.js + Prisma app with a FastAPI backend + Next.js frontend split, deployed on Kubernetes. That is a substantial architectural pivot. This baseline exists so:

- The pre-rewrite tech stack, shape and behaviour are unambiguously documented for reference.
- If the rewrite is paused, rolled back or forked, the recovery point is a single named tag rather than a hunt through commit history.
- Post-rewrite comparisons ("we used to have X modules; we now have Y") have a fixed reference.

## What this baseline covers

- **Branch:** `main`
- **HEAD at snapshot time:** `c66cfe7218beffde1309b357adb343c94d800ad6` — *"spec + plan: Python + Kubernetes restack (read-path) (#51)"*
- **Git tag to apply:** `baseline/pre-python-rewrite` (annotated). Applied after the currently-open Dependabot merges (PRs #65, #70, #74–#80) land — those are patch/minor version bumps, not shape changes.
- **Excluded from baseline:** the open rewrite PRs #53–#63 (they define the *next* state, not this one).

## Tech stack

Locked by the seven Phase 0 ADRs and the Azure stack design spec ([`docs/superpowers/specs/2026-05-19-azure-stack-design.md`](../superpowers/specs/2026-05-19-azure-stack-design.md)):

| Layer | Choice | Version | ADR |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.2.6 | [001](../decisions/2026-05-19-adr-001-web-framework.md) |
| Language | TypeScript | 6.0.3 | 001 |
| UI runtime | React + react-dom | 19.2.6 | 001 |
| Database | Azure Database for PostgreSQL Flexible Server | — | [002](../decisions/2026-05-19-adr-002-content-store.md) |
| ORM | Prisma 7 + `@prisma/adapter-pg` | 7.8.0 | 002 |
| AI | Azure OpenAI (`openai` SDK) | 6.38.0 | [003](../decisions/2026-05-19-adr-003-ai-parser.md) |
| Search | Postgres full-text (in-schema `tsvector`) | — | [004](../decisions/2026-05-19-adr-004-search-backend.md) |
| Auth | Easy Auth → Entra ID (`X-MS-CLIENT-PRINCIPAL` header) | — | [005](../decisions/2026-05-19-adr-005-authentication.md) |
| Host | Azure App Service for Linux (Web App for Containers) via ACR | — | [006](../decisions/2026-05-19-adr-006-hosting.md) |
| UI kit | Tailwind 4.3 + shadcn/ui + Radix + Lucide + Geist | — | [007](../decisions/2026-05-19-adr-007-visual-language.md) |
| Platform | Key Vault + App Insights + Log Analytics + Front Door | — | [008](../decisions/2026-05-19-adr-008-platform-services.md) |
| Repo topology | Public app (this repo) + internal `-infra` repo | — | [009](../decisions/2026-05-19-adr-009-repo-topology.md) |
| Deploy | All-GHA with gated cross-repo dispatch | — | [010](../decisions/2026-05-19-adr-010-deploy-pipeline.md) |
| Runtime | Node.js ≥22.0.0 | 22 | 001 |
| Package manager | pnpm | 10.4.1 | 001 |
| Unit test | Vitest + Testing Library + happy-dom | 4.1.6 | — |
| E2E | Playwright + `@axe-core/playwright` | 1.60 | — |
| Docker base | (inherited via Dockerfile) | — | — |

Also in effect: [ADR-011 Graceful degradation](../decisions/2026-05-20-adr-011-graceful-degradation.md) (Proposed).

## Repository shape

197 tracked files at HEAD. Top-level distribution:

| Directory | Tracked files | Purpose |
|---|---|---|
| `src/` | 104 | Application code — Next.js App Router pages, API routes, components, lib modules |
| `docs/` | 20 | Specs, plans, ADRs, prototype, runbooks, baselines |
| `tests/` | 17 | Integration + Playwright end-to-end suites |
| `.github/` | 16 | 10 CI workflows + templates + Dependabot config |
| `prisma/` | 9 | Schema + 7 migrations |
| `scripts/` | 4 | `demo.sh`, `seed-db.ts`, migration/postinstall helpers |
| Root | ~13 | `package.json`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml`, `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, config files |

Tracked LOC by file type: 82 `.ts`, 45 `.tsx`, 29 `.md`, 12 `.yml`, 7 `.sql`, 4 `.json`, plus small counts of `.mjs`, `.toml`, `.prisma`, `.html`, `.sh`.

## Application surface

### Pages (App Router)

| Route | Purpose | Spec |
|---|---|---|
| `/` | Cross-DTS NOW/NEXT/LATER roadmap matrix + search + "Your team" shortcut | §5.2 |
| `/j/[slug]` | Jurisdiction roll-up: its Domain matrix, consumed-by list | §5.3 |
| `/d/[slug]` | Product Domain: strategic themes, Products grid, Teams grid | §5.4 |
| `/t/[slug]` | Team page: About, operated Products, latest activity | §5.5 |
| `/p/[slug]` | Product page: description, roadmap, outbound links, breadcrumb | §5.6 |
| `/search` | Deep search results page (LLM answer card + ranked matches) | §5.7 |
| `/upload` | Markdown upload UI | §7.1 |
| `/approvals` and `/approvals/[submissionId]` | Approval screen + queue | §7.4 |
| `/styleguide` | Design tokens + primitives reference | plan T1.2 / T1.4 |
| `/help` | Templates, format guide, FAQ | plan T1.17 |
| `/healthz` | Liveness endpoint (`{"status":"ok"}`) | — |
| `/ops/ai-cost` | AI parse token / cost dashboard | plan T2.13 |
| `/ops/search` | Search analytics (zero-result, no-click) | plan T3.7 |

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/search` | GET | Postgres full-text ranked matches |
| `/api/answer-card` | POST | Azure OpenAI single-sentence answer card |
| `/api/search-events` | POST | Client-side beacon for search analytics |

### lib modules

`src/lib/`:
- `ai-answer/` — answer-card synthesis prompt + client
- `ai-parser/` — markdown → structured JSON via Azure OpenAI, plus strict-template fallback
- `markdown/` — YAML front-matter and section parsing
- `audit-log/` — append-only submission table interface
- `publish/` — approve-and-publish transaction
- `search/` — Postgres full-text query + rerank
- `health/` — health probe
- `upload/` — file upload validation

## Data layer

7 Prisma migrations, latest at `20260520030000_search_event`.

Entities (matches requirements spec §4):

- **Jurisdiction** — fixed taxonomy (crime, civil, family, tribunals, administrative). One-to-many to ProductDomain; many-to-many "consumed by" to Product.
- **ProductDomain** — sets strategic direction. One-to-many to Team and Product; one-to-many to Theme (strategic themes on the domain roadmap).
- **Team** — belongs to exactly one Domain. One-to-many to Product ("operates").
- **Product** — one Domain (strategic owner), one Team (operational owner), 0..N consuming Jurisdictions. One-to-many to Initiative (roadmap chips) and OutboundLink. Stage enum: `discovery | alpha | beta | live | retiring | retired`. Carries `lastApprovedAt`, `lastApprovedBy`, `versionNumber`.
- **Initiative** — chip on a Product roadmap. Bucket enum: `NOW | NEXT | LATER`. Optional description and outbound URL.
- **Theme** — cards on the Domain roadmap.
- **OutboundLink** — labelled links (Ardoq, Jira, Confluence, Miro, repo) per Product.

Append-only tables (INSERT-only enforced at DB layer via REVOKE UPDATE, DELETE in migrations):
- **Submission** — every markdown upload: `entityKind`, `entityId?`, `submitter`, `submittedAt`, `sourceMarkdown` (raw bytes), `sourceMarkdownSha`, `aiParsedOutput`, `aiConfidenceFlags`, `aiParseSource`, `approver?`, `approvedAt?`, `versionNumber?`, `notes?`.
- **AiParseMetric** — per-parse cost/latency/outcome for the AI ops dashboard.
- **SearchEvent** — one row per search query and one per result click; identity carried as SHA-256 hash of the auth sub claim (data minimisation per spec §8.4).

Slugs are author-set in markdown front-matter; uniqueness is validated at *approve* time, not upload time.

## Content lifecycle (Phase 2 delivered)

Upload → append to audit log → AI parse (Azure OpenAI structured output, or strict-template fallback if AOAI unavailable) → approval screen (source markdown left, parsed fields right, confidence flags, unrecognised-content panel) → Approve & Publish → live on portal; entity carries `lastApprovedBy` + `versionNumber`.

Markdown format:
- **YAML front-matter (strict):** `type`, `name`, parent reference
- **Body (loose):** section headers parsed with tolerance for variants — the AI parser handles the flex; the strict-template fallback expects canonical headers only

## Tests and quality gates

- **Unit + component:** Vitest with happy-dom. 49 test files across `src/` and `tests/`.
- **Integration:** `pnpm test:int` (`vitest.int.config.ts`) — runs against a service Postgres in CI (`db-migration-check.yml`, `tests.yml`).
- **E2E + a11y:** Playwright with `@axe-core/playwright`.
- **CI thresholds:** target 80% line / 70% branch (per CLAUDE.md). CI gates.
- **Static analysis:** ESLint (`next lint`), Prettier, `tsc --noEmit`. All wired into CI.

## CI/CD pipelines

10 workflows in `.github/workflows/`:

| Workflow | Role |
|---|---|
| `tests.yml` | Vitest unit + integration + Playwright |
| `db-migration-check.yml` | `prisma migrate deploy` against service Postgres |
| `codeql.yml` | GitHub CodeQL analysis (javascript-typescript) |
| `secrets-scanner.yml` | Gitleaks — blocks secrets in PRs |
| `sbom.yml` | CycloneDX Node/pnpm SBOM per build |
| `ci-build-images.yml` | Reusable image-build (called by deploys) |
| `deploy-dev.yml` | Push→main: build, push to ACR, tag `deploy-dev-<version>-<runid>`, cross-repo dispatch to `-infra` |
| `deploy-stg.yml` | Manual: promote a dev tag to stg |
| `deploy-prod.yml` | Manual: promote a stg tag to prod |
| `prune-deploy-tags.yml` | Housekeeping — trim old `deploy-*` tags |

Deploy pipeline is **gated by repo variable `INFRA_DISPATCH_ENABLED`** (default `false`) — chain stays dormant until the Azure estate is provisioned. Per ADR-009 and ADR-010.

## Environments

Three GitHub environments referenced by the deploy workflows: `dev`, `stg`, `prod`. Terraform for each lives in the sibling internal repo `hmcts/dts-portfolio-portal-infra`.

## Design artefacts in effect

- **Requirements spec:** [`docs/superpowers/specs/2026-05-15-dts-portfolio-portal-design.md`](../superpowers/specs/2026-05-15-dts-portfolio-portal-design.md) — the product requirements
- **Azure stack design:** [`docs/superpowers/specs/2026-05-19-azure-stack-design.md`](../superpowers/specs/2026-05-19-azure-stack-design.md) — locked stack decisions
- **Python + K8s restack spec+plan:** [`docs/superpowers/specs/2026-05-21-python-k8s-restack-design.md`](../superpowers/specs/2026-05-21-python-k8s-restack-design.md) — the *rewrite* that succeeds this baseline
- **Implementation plan:** [`docs/superpowers/plans/2026-05-15-dts-portfolio-portal.md`](../superpowers/plans/2026-05-15-dts-portfolio-portal.md) — the phased plan
- **ADRs:** 10 accepted (001–010) + [011 (Proposed)](../decisions/2026-05-20-adr-011-graceful-degradation.md)
- **Prototype:** [`docs/prototype/DTS Portfolio Portal - standalone.html`](../prototype/) — standalone visual reference

## Known gaps at this baseline

- **Auth is a stub.** Phase 4 auth (Easy Auth → Entra ID, `X-MS-CLIENT-PRINCIPAL` header) is designed but not wired in. `submitter`/`approver` fields accept anything from a request header today.
- **Infra deploy gate off.** `INFRA_DISPATCH_ENABLED=false`. No live Azure estate for this repo yet.
- **Dependabot grouping gap.** No `react`/`react-dom`/`@types/react`/`@types/react-dom` group in `.github/dependabot.yml` — this caused the mismatched-versions failure that closed PR #67. Recommend a follow-up commit to add a `react` group before the rewrite lands (or migrate the concern to the frontend package once the split happens).
- **Local WIP not on the tag.** Untracked working-tree files (`app.json`, `backend/`, `frontend/`) from an earlier experiment with the monorepo split (PR #53) sit locally in Duncan's clone. Not part of the baseline; not committed.

## What the rewrite (PRs #53–#63) changes

Summarised from the [Python + K8s restack spec](../superpowers/specs/2026-05-21-python-k8s-restack-design.md):

- **Backend:** Next.js API routes → **FastAPI + uv + SQLModel + Alembic**, 16 read-path endpoints
- **Frontend:** Next.js remains, but as a **standalone container** behind Caddy via supervisord; consumes the backend via **OpenAPI-generated api-client**
- **DB access:** Prisma → **SQLModel + Alembic**; Prisma deleted in cutover PR #63
- **Runtime:** App Service single container → **Kubernetes** with separate frontend and backend containers
- **Repo layout:** flat root → **`frontend/` + `backend/` monorepo**
- **CI:** paths-aware, per-package pipelines
- **Auth/Ops/Search backends:** unchanged in shape (Azure OpenAI, Postgres FTS, Entra ID); only the framework moves

The read path is being ported first; write path (upload / AI parse / approval) is out of the initial rewrite scope.

## Recovery

To return the repo to this baseline state:

```bash
git fetch --tags
git checkout baseline/pre-python-rewrite
```

Or to open a branch from the baseline for a hotfix:

```bash
git switch -c hotfix/<slug> baseline/pre-python-rewrite
```

The `baseline/pre-python-rewrite` tag is annotated (`git tag -a`) with a short message pointing at this document.

## Follow-ups suggested at baseline time

Small housekeeping worth landing on the baseline commit or immediately after — none are blockers for the rewrite:

1. Add a `react` group to `.github/dependabot.yml` covering `react`, `react-dom`, `@types/react`, `@types/react-dom` — prevents future `Incompatible React versions` mismatches.
2. Decide the fate of the local untracked `app.json`, `backend/`, `frontend/` in Duncan's working tree — safe to move to a scratch dir since the same shape arrives via PR #53.
3. Move ADR-011 (Graceful degradation) from *Proposed* → *Accepted* if it's expected to hold across the rewrite, or note explicitly that it will be revisited once the split lands.
