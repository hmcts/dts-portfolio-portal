# DTS Portfolio Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the DTS Portfolio Portal — a high-level "front door" over Ardoq / Jira / Confluence — in five shippable phases. Each phase produces working, demoable software.

**Architecture:** Decided at design level on 2026-05-19 (see [../specs/2026-05-19-azure-stack-design.md](../specs/2026-05-19-azure-stack-design.md)); ratified through **Phase 0** ADRs. The source requirements spec ([../specs/2026-05-15-dts-portfolio-portal-design.md](../specs/2026-05-15-dts-portfolio-portal-design.md)) deferred the stack; the stack-design spec captures the locked answers. Phase 0 now runs as a formal ADR sign-off pass rather than a fresh decision pass.

**Tech Stack (locked):** Next.js (App Router) + React + TypeScript, containerised; Prisma + Azure Database for PostgreSQL Flexible Server (with Postgres full-text search); Azure OpenAI for markdown parsing and answer-card synthesis; Easy Auth → Microsoft Entra ID for authentication; Azure App Service for Linux (Web App for Containers) for hosting, image hosted in pre-provisioned HMCTS ACR (`hmctsprod.azurecr.io`); Azure Front Door for CDN + WAF; Azure Key Vault + managed identity for secrets; Application Insights + Log Analytics for observability. Build: pnpm, ESLint + Prettier, Vitest, Playwright, axe-core. Infra: Terraform (`infrastructure/` + `platform/` roots), all-GHA CI/CD (ADO deferred). See the stack-design spec for the full picture.

**Repository topology:** Two repos. `hmcts/dts-portfolio-portal` (this repo) — **public** — carries app, Dockerfile, GHA workflows, docs. `hmcts/dts-portfolio-portal-infra` — **internal** (intent to publish) — carries Terraform and the deploy workflows triggered via cross-repo `repository_dispatch`.

---

## Plan altitude — read this first

This plan operates **above the writing-plans skill's default code-and-test-snippet altitude**. Tasks below are described at the level of *"build this capability, verify it does X, this is the spec reference, these are the risks"* — not as TDD steps with exact file paths and `pnpm test` commands.

**To execute:** before starting any phase, refine its task list into TDD bite-sized tasks (matching the writing-plans default form). Phase 0 outputs are decision records, not code; Phases 1–5 each become their own concrete TDD plan after Phase 0 signs off. Now that the stack is locked (see the stack-design spec), this refinement is a mechanical step rather than a re-litigation.

**Source documents:**
- Requirements spec: [../specs/2026-05-15-dts-portfolio-portal-design.md](../specs/2026-05-15-dts-portfolio-portal-design.md)
- Stack design spec: [../specs/2026-05-19-azure-stack-design.md](../specs/2026-05-19-azure-stack-design.md)
- Reference visual language: requirements spec, §6.6
- Out-of-scope items: requirements spec, §3.2
- ADR index: [../../decisions/README.md](../../decisions/README.md)

**Section references** (`§N.N`) in this plan point to the requirements spec above.

---

## Phase shape and demoable outcomes

| Phase | What it delivers | Demo at end |
|---|---|---|
| **0. ADR sign-off** | Ten ADRs ratified from the stack-design spec (framework / store / AI / search / auth / hosting / visual / platform / repo-topology / deploy-pipeline) | ADRs committed, statuses moved Proposed → Accepted; team sign-off |
| **1. Scaffold + read-only seeded pages** | All six pages working with seeded data; modal-as-detail; visual language; Claude design pass; containerised; CI green; deploy chain wired with infra dispatch disabled | Click through the portal end-to-end with realistic seeded data |
| **2. Markdown upload + AI parse + approval** | Live data via markdown upload; approval screen; audit log | Upload a Team markdown, approve, see it live |
| **3. Search** | Portal-wide NL search with instant overlay and deep results page | Ask *"who owns Common Platform?"* and get a one-sentence answer card |
| **4. Auth integration** | Authenticated DTS staff only; team membership recognised | Sign in with Entra ID (or chosen provider); "Your team" shortcut wired up |
| **5. Hardening** | WCAG 2.2 AA; performance budgets met; observability; backups; deployable | Production-ready release |

Phase 1 can run in parallel with a **Claude design pass** producing mockups from the same spec — the scaffold work and the design output converge before Phase 1 review.

Phases 1 → 2 → 3 → 4 are sequential. Phase 5 can begin late in Phase 4 (accessibility / performance audits don't require completed auth).

---

# Phase 0 — ADR sign-off

**Goal:** Take the locked stack-design decisions and ratify them as ADRs the team signs off on. Per ADR: write the record, capture the alternatives considered (lifted from the brainstorming dialogue and the stack-design spec), capture consequences, move the status from Proposed to Accepted. No application code.

**Inputs:** The stack-design spec ([../specs/2026-05-19-azure-stack-design.md](../specs/2026-05-19-azure-stack-design.md)) provides the locked recommendations for every ADR below.

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-NNN-*.md` (one per decision below; ten total)
- The index `docs/decisions/README.md` already exists; update its Phase 0 backlog table as ADRs land

**Decision-record format:** title, status, date, deciders, context, options considered, decision, consequences, references.

### Task 0.1 — ADR-001: Web framework and rendering

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-001-web-framework.md`

**Locked decision (from stack-design §10):** Next.js (App Router) + React + TypeScript.

- [ ] **Step 1: Capture alternatives considered**

  Document the candidates compared in the 2026-05-19 brainstorming:
  - **Next.js (App Router)** — SSR + RSC; ecosystem match for shadcn/Tailwind; team familiarity; runs natively on App Service as a single Node artefact (chosen)
  - **Astro** — content-first, smaller bundles; considered because the portal is mostly read-heavy; rejected for maintenance familiarity reasons
  - **SvelteKit** — smaller bundles than Next; smaller ecosystem for shadcn-style primitives; rejected
  - **Remix / Hugo / Eleventy** — weaker fits for the LLM-overlay UI; rejected

- [ ] **Step 2: Capture acceptance criteria the decision satisfies**

  SSR for fast home-page render (§8.2); deep-linkable modal overlays (§6.2); accessible focus management (§8.1); markdown rendering; Easy Auth integration (§8.5); streaming responses for search (§6.1); single-artefact deploy to App Service.

- [ ] **Step 3: Record the decision and rationale**

  Next.js. Rationale: maintenance familiarity, native App Service fit (no hybrid-mode caveats), strong RSC story for the mostly-static read paths, ecosystem match for visual language tooling.

- [ ] **Step 4: Capture consequences**

  Lock-in to React/Node; need discipline of "no heavy components in marquee pages" to hit the 2s budget; App Service hosting tier must be Linux + Web App for Containers.

- [ ] **Step 5: Sign off and commit**

---

### Task 0.2 — ADR-002: Content store and ORM

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-002-content-store.md`

**Locked decision (from stack-design §10):** Azure Database for PostgreSQL Flexible Server, accessed via Prisma. Prisma Migrate manages schema changes (the Node analogue of Alembic).

- [ ] **Step 1: Capture alternatives considered**

  Stores: Sanity CMS (rejected — vendor lock, redundant editorial workflows); Filesystem Git repo + index (deferred to v2 — round-trippable already); Azure Cosmos DB (rejected — less idiomatic for relational queries).
  ORMs: Drizzle (rejected — less maintenance familiarity than Prisma at this scale).

- [ ] **Step 2: Capture acceptance criteria the decision satisfies**

  Append-only source-markdown storage (§7.6); approved-and-live parsed data; version_number per entity; submitter/approver fields (§7.7); idempotent AI parse caching; full-text indexing (Phase 3 dependency); Entra authentication (no passwords); managed-identity access from App Service.

- [ ] **Step 3: Record the decision and rationale**

  Azure Database for PostgreSQL Flexible Server with Entra-only authentication. One store for the spine (entities), the audit log (append-only table with raw markdown bytes), and the full-text search index. Prisma chosen for the ORM on maintenance-familiarity grounds; Prisma Migrate generates SQL migrations checked into the repo.

- [ ] **Step 4: Capture consequences**

  Backup/DR strategy needed (Phase 5); we own data migrations going forward via Prisma Migrate; the markdown is round-trippable so a future move to Git-as-source remains possible without losing history; Prisma client size acceptable given non-serverless host.

- [ ] **Step 5: Sign off and commit**

---

### Task 0.3 — ADR-003: AI parser

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-003-ai-parser.md`

**Locked decision (from stack-design §10):** Azure OpenAI for both parsing (Phase 2) and answer-card synthesis (Phase 3), accessed via managed identity.

- [ ] **Step 1: Capture alternatives considered**

  Document trade-offs:
  - **Azure OpenAI** — HMCTS-friendly cloud (gov tenancy); user signalled Azure AI Services preference; structured-output mode supported.
  - **Anthropic Claude (direct)** — strong instruction-following; data-residency questions for HMCTS.
  - **OpenAI direct** — same.
  - **Self-hosted (Llama / similar)** — most data-control; infra burden; weaker structured output.

- [ ] **Step 2: Document acceptance criteria**

  Must support: structured-output mode (JSON schema or function-calling) (§7.5); confidence flags per field (§7.5); idempotent for identical input; <10s per parse (acceptable async); fallback path when the API is unavailable (§7.5).

- [ ] **Step 3: Record the decision and rationale**

  **Decision:** Azure OpenAI. Data-residency, HMCTS procurement fit, structured-output support. Strict-template parser is the fallback when AI is unavailable (§7.5 — already required). Access via managed identity (`DefaultAzureCredential`), no keys.

- [ ] **Step 4: Capture consequences**

  Per-parse cost; cache parses by source-markdown hash to avoid re-billing identical re-uploads; ops needs Azure OpenAI quota allocated in tenant + budget alert.

- [ ] **Step 5: Sign off and commit**

---

### Task 0.4 — ADR-004: Search backend

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-004-search.md`

**Locked decision (from stack-design §10):** Postgres full-text search. Adequate at v1 scale; Azure AI Search captured as known tech debt (stack-design §9) — revisit if relevance proves poor or entity count grows beyond ~5k.

- [ ] **Step 1: Capture alternatives considered**

  Document trade-offs:
  - **Postgres full-text + LLM rerank/answer** — simplest; one fewer service; good enough for our scale; relevance via LLM rerank on top-N.
  - **Azure AI Search (with RAG)** — purpose-built; another service to run; sharper relevance.
  - **Elasticsearch / OpenSearch** — heavier; richer query DSL; overkill for v1 scale.
  - **pgvector + LLM** — embedding-based; useful for fuzzy phrase queries; adds embedding pipeline complexity.

- [ ] **Step 2: Document acceptance criteria**

  Must support: NL queries returning a one-sentence answer card + ranked entity matches (§5.7, §6.1); overlay results within 500ms perceived (§8.2); entity-type filtering (§5.7); cheap to operate at DTS scale (hundreds of entities, not millions).

- [ ] **Step 3: Record the decision and rationale**

  **Decision:** Postgres full-text + Azure OpenAI for answer-card synthesis. Lowest moving-parts; matches our scale; keeps state in one store (ADR-002). Saves ~£200/month vs Azure AI Search at our scale.

- [ ] **Step 4: Capture consequences**

  Search-quality ceiling capped by Postgres FTS; LLM rerank optional. Search analytics (zero-result queries) feeds future relevance work and the AI Search graduation decision.

- [ ] **Step 5: Sign off and commit**

---

### Task 0.5 — ADR-005: Authentication provider

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-005-auth.md`

**Locked decision (from stack-design §10):** Easy Auth → Microsoft Entra ID. Platform-level sidecar on App Service. The app consumes `X-MS-CLIENT-PRINCIPAL` header — no auth library in code for v1.

- [ ] **Step 1: Capture alternatives considered**

  Document trade-offs:
  - **Azure Entra ID via OIDC** — HMCTS default; group claims map to team membership.
  - **GOV.UK Sign In** — citizen-facing; wrong audience.
  - **Header-trusted proxy** — what the prior attempt did via preview-auth; OK for previews, weak production posture.
  - **Self-hosted OIDC (Keycloak)** — full control; ops burden.

- [ ] **Step 2: Document acceptance criteria**

  Must support: DTS staff sign-in (§8.5); email identity claim; optional team-membership claim feeding the "Your team" shortcut (§5.2); submitter/approver distinct identities (§7.6); separation from preview/dev environments.

- [ ] **Step 3: Record the decision and rationale**

  **Decision:** Microsoft Entra ID via App Service Easy Auth (platform sidecar). HMCTS-default identity provider; zero auth library in the app code. Header-trusted preview-auth path retained for non-prod environments only; rejected outright in production via Easy Auth being the only auth source.

- [ ] **Step 4: Capture consequences**

  Entra app registration + group provisioning becomes an ops dependency. Team-claim mapping requires a convention (groups named per Team) — capture in this ADR. Easy Auth sidecar means auth happens at the platform edge before request reaches Next.js — local dev needs a parallel header-trusted shim.

- [ ] **Step 5: Sign off and commit**

---

### Task 0.6 — ADR-006: Hosting and deployment

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-006-hosting.md`

**Locked decision (from stack-design §10):** Azure App Service for Linux (Web App for Containers). Image hosted in pre-provisioned HMCTS ACR (`hmctsprod.azurecr.io`). Azure Front Door for CDN + WAF. The same container image is deployable to AKS (cnp shared cluster) without rebuild if PlatOps later mandates the move.

- [ ] **Step 1: Capture alternatives considered**

  - **Azure App Service for Containers** — chosen. Single Node artefact; no serverless caps; native Next.js runtime; deployment slots for blue/green.
  - **Azure Static Web Apps** — rejected. Hybrid Next.js mode imposes 45s/250MB function caps and ISR limitations; bigger fit for Astro/static-first projects.
  - **Azure Container Apps** — rejected for v1. Useful "what if we needed scale-to-zero" reference point.
  - **AKS via cnp shared cluster** — overkill for v1. Retained as a future migration target; the containerised image is portable.

- [ ] **Step 2: Capture acceptance criteria the decision satisfies**

  Production hosting alongside Entra ID + Azure OpenAI in the same tenant; deployment slots for safe releases; rollbacks via slot swap; structured logs to App Insights; secrets via Key Vault + managed identity; future portability to AKS at zero migration cost on the image.

- [ ] **Step 3: Record the decision and rationale**

  Azure App Service for Linux (Web App for Containers). Image in HMCTS ACR. Front Door in front. Image built via `next/standalone` mode for tiny production image; same image runs locally via `docker compose`.

- [ ] **Step 4: Capture consequences**

  Always-on plan cost (no scale-to-zero); Front Door adds a managed resource (HMCTS baseline WAF rules apply); ACR push permissions for GHA need HMCTS org-provisioned credentials (already exist).

- [ ] **Step 5: Sign off and commit**

---

### Task 0.7 — ADR-007: Visual language tooling

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-007-visual-tooling.md`

**Locked decision (from stack-design §10):** Tailwind CSS + shadcn/ui primitives + Lucide icons + Geist font (served via `next/font`). A custom design system was rejected as over-investment for v1.

- [ ] **Step 1: Capture alternatives considered**

  Custom design system rejected (over-investment); MUI / Chakra rejected (heavier, less aligned with the calm-monochrome aesthetic the spec calls for).

- [ ] **Step 2: Define design tokens**

  Token names, values, and where they live. CSS variables driven by Tailwind config. Token inventory matches §6.6 (colour, spacing 8px base, radii, type scale).

- [ ] **Step 3: Record the decision**

- [ ] **Step 4: Capture consequences**

  Lock the icon family early to avoid bikeshedding. Disallow ad-hoc component CSS to keep the calm look intact. shadcn copy-paste model means we own the component code — accept this for control over the visual language.

- [ ] **Step 5: Sign off and commit**

---

### Task 0.8 — ADR-008: Platform services

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-008-platform-services.md`

**Locked decision (from stack-design §10):** Azure Key Vault + Application Insights + Log Analytics workspace + Azure Front Door. RBAC is managed-identity-only — no service principals with secrets; no connection strings with passwords.

- [ ] **Step 1: Capture alternatives considered**

  - **Sentry / Datadog** for observability — rejected; App Insights is native Azure with managed-identity ingestion.
  - **GitHub Secrets at runtime** for secret storage — rejected; Key Vault is centralised, auditable, rotatable.
  - **Cloudflare for CDN/WAF** — rejected; Front Door keeps the stack in-Azure with consistent identity model.

- [ ] **Step 2: Capture acceptance criteria the decision satisfies**

  Centralised secret storage with audit; observability with managed-identity ingestion; CDN + WAF in front of App Service; identity model is uniform (no keys to leak).

- [ ] **Step 3: Record the decision and rationale**

  Key Vault + App Insights + Log Analytics + Front Door. All accessed via App Service user-assigned managed identity. Terraform `platform/` root provisions identities and RBAC; `infrastructure/` root provisions the services that consume them.

- [ ] **Step 4: Capture consequences**

  Managed-identity discipline is non-negotiable — code that uses `DefaultAzureCredential` everywhere; Terraform that never produces a connection string with embedded password. WAF rule set per HMCTS baseline (link from ADR).

- [ ] **Step 5: Sign off and commit**

---

### Task 0.9 — ADR-009: Repository topology

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-009-repo-topology.md`

**Locked decision (from stack-design §3, §10):** Two repos. `hmcts/dts-portfolio-portal` (this repo) is **public** and carries the app, Dockerfile, CI workflows, and docs. `hmcts/dts-portfolio-portal-infra` is **internal** visibility (intent to publish once HMCTS-DTS PlatOps confirms an IaC publicity stance) and carries the Terraform plus the `terraform apply` workflows triggered via cross-repo `repository_dispatch`. Both repos follow the same code-in-the-open disciplines from day one.

- [ ] **Step 1: Capture alternatives considered**

  - **Same-repo with CODEOWNERS** — rejected for v1. Reveals architecture-blueprint to public reconnaissance without HMCTS PlatOps having a confirmed IaC publicity stance.
  - **Separate private infra repo (permanent)** — rejected. Locks out public visibility option if PlatOps later confirms it's safe.
  - **Same-repo for v1, split at Phase 5** — rejected. Migration cost of the public→public split (after the repo has accumulated history) is higher than starting with two repos.

- [ ] **Step 2: Capture acceptance criteria the decision satisfies**

  Public app code (C1); infra-code visibility deferred pending PlatOps; both repos follow public-safe disciplines from day one so a future flip is one repo-settings change; cross-repo deploy orchestration via `repository_dispatch` on deploy tags.

- [ ] **Step 3: Record the decision and rationale**

  Two repos as above. Dispatch authentication via a GitHub App (preferred over PAT — no rotation overhead). Dispatch step in the app repo is **gated by `INFRA_DISPATCH_ENABLED` repo variable** (default `false`) so the workflow is fully wired but dormant until the Azure estate is ready.

- [ ] **Step 4: Capture consequences**

  Cross-repo PR coordination when app+infra need to change together (rare; expected during framework or service migrations). Two sets of CODEOWNERS, branch protection, and READMEs to maintain. Infra repo visibility flip is captured as known tech debt (stack-design §9) with PlatOps confirmation as the trigger.

- [ ] **Step 5: Sign off and commit**

---

### Task 0.10 — ADR-010: Deploy pipeline

**Files:**
- Create: `docs/decisions/2026-MM-DD-adr-010-deploy-pipeline.md`

**Locked decision (from stack-design §6, §10):** All-GHA CI/CD in v1. The `hmcts/courtstranscribe` pattern is adapted: GHA builds and pushes the image to ACR, pushes a `deploy-<env>-<version>-<run_id>` git tag for audit, and fires `repository_dispatch` against the infra repo (gated by `INFRA_DISPATCH_ENABLED`). ADO + cnp pipelines are deferred as known tech debt.

- [ ] **Step 1: Capture alternatives considered**

  - **ADO + cnp pipelines** (the courtstranscribe pattern verbatim) — deferred. Adds ADO setup cost; loses the all-GHA simplicity for v1.
  - **GHA monolith** (build + apply + swap in one workflow run on the same repo) — rejected. Mixing build with terraform apply in the same workflow run conflates two distinct identities (one for image push, one for infra apply); cross-repo dispatch keeps the separation clean and aligns with the two-repo topology.

- [ ] **Step 2: Capture acceptance criteria the decision satisfies**

  Audit trail: every deploy is a tag (`deploy-<env>-<version>-<run_id>`). Cross-repo orchestration: `repository_dispatch` from app repo → infra repo `deploy-<env>.yml`. Gated dispatch: `INFRA_DISPATCH_ENABLED` repo variable defaults `false` so the chain is dormant until estate setup completes.

- [ ] **Step 3: Record the decision and rationale**

  All-GHA, courtstranscribe-derived. Deploy tags retained for audit even without ADO consuming them.

- [ ] **Step 4: Capture consequences**

  Workload identity federation between GHA and Azure becomes a Phase 1 setup task (per environment, per repo). Tag protection ruleset must allow `github-actions[bot]` to push and delete `deploy-*` tags. ADO migration is a future change (revisit when DTS PlatOps standardisation triggers).

- [ ] **Step 5: Sign off and commit**

---

### Task 0.11 — Decision record index and sign-off

**Files:**
- Update: `docs/decisions/README.md` (Phase 0 backlog table grows from 7 to 10)

- [ ] **Step 1: Reflect every ADR in the index**

  One-line summary per ADR, status (proposed / accepted / superseded), date.

- [ ] **Step 2: Capture sign-off list**

  Names / roles of the people who reviewed each ADR before Phase 1 begins.

- [ ] **Step 3: Commit and circulate**

---

# Phase 1 — Scaffold + read-only seeded pages

**Goal:** Stand up the project, build all six pages with realistic seed data, get the visual language right, run a Claude design pass. End state: the portal is browsable end-to-end as if real content existed.

**Demoable outcome:** A reviewer can open the portal locally, see the home matrix populated from seed, click into a Jurisdiction → Domain → Team and Product, open Initiative chips as popovers and modals, navigate via breadcrumbs and sidebar. No upload, no search, no auth.

**Spec sections covered:** §4 (entity model); §5 (pages); §6.2–§6.6 (cross-cutting visual / modal / breadcrumb / sidebar); §8.1 (accessibility — baseline keyboard support).

### Task 1.1 — Project initialisation

Initialise the Next.js (App Router) project with TypeScript, pnpm, ESLint + Prettier. Add a `Dockerfile` using Next.js `output: 'standalone'` for a tiny production image. Add `docker-compose.yml` for local dev: app container + a local Postgres + pgAdmin, parity with what CI runs. Add `.nvmrc` matching the Node version baked into the Dockerfile base image. Add Vitest and Playwright (with `@axe-core/playwright`) baseline configs. Add `README.md` linking to the requirements spec, stack-design spec, and this plan. Commit per stable subtask (init, Dockerfile, compose, lint, test).

**Acceptance:** `pnpm dev` renders a blank page; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` all exit cleanly; `docker compose up` brings up the app + Postgres + pgAdmin locally; the built image runs identically to local dev (modulo HMR).

**Spec ref:** stack-design §3, §5.

### Task 1.1a — CI workflows duplicated from courtstranscribe

Copy and adapt the courtstranscribe `.github/workflows/` set per the stack-design §6.1–§6.2 inventory. Single-app simplifications throughout (no frontend/backend split).

**Files (this repo):**
- `.github/workflows/secrets-scanner.yml` (copy as-is)
- `.github/workflows/codeql.yml` (copy as-is)
- `.github/workflows/code-analysis.yml` (adapt for Node toolchain)
- `.github/workflows/prune-deploy-tags.yml` (copy as-is)
- `.github/workflows/deploy-status.yml` (copy as-is)
- `.github/workflows/sbom.yml` (adapt — single CycloneDX SBOM via `npx @cyclonedx/cdxgen -t pnpm --required-only`)
- `.github/workflows/tests.yml` (adapt — Vitest unit + Playwright E2E + axe a11y against service Postgres)
- `.github/workflows/db-migration-check.yml` (adapt — `npx prisma migrate deploy && npx prisma migrate status` against service Postgres)
- `.github/workflows/ci-build-images.yml` (adapt — single image, single CHANGELOG via `git-cliff`)
- `.github/workflows/deploy-dev.yml` / `deploy-stg.yml` / `deploy-prod.yml` (adapt — fire `repository_dispatch` to infra repo instead of relying on ADO; gated per Task 1.1c)
- `.github/dependabot.yml` (npm + GHA + Docker ecosystems)
- `cliff.toml` (git-cliff config, copy as-is)
- `.pre-commit-config.yaml` (adapt to Node hooks: gitleaks, prettier, eslint, conventional-commit lint on PR title)

**Acceptance:** All workflows pass on a PR (with the `build` and `push` jobs skipped on `pull_request` events per the courtstranscribe pattern). Secrets scanner finds nothing in the seed history. SBOM artefact uploads with a valid hash. `git-cliff --version` runs.

**Spec ref:** stack-design §6.

### Task 1.1b — CODEOWNERS, branch protection, and rulesets

Configure the GitHub-side governance per stack-design §6.6.

**Files (this repo):**
- `CODEOWNERS` (root or `.github/`) — assign reviewer teams; scope `docs/decisions/**` to the architecture-owning reviewer
- `.github/SECURITY.md` — HMCTS disclosure policy
- `.github/PULL_REQUEST_TEMPLATE.md` — short template prompting spec/ADR reference
- `.github/ISSUE_TEMPLATE/bug.md` and `feature.md` — short templates

**GitHub configuration (not in repo, applied via repo settings):**
- Branch protection on `main`: required PR review (≥1), required status checks (`tests`, `codeql`, `secrets-scanner`, `sbom`, `db-migration-check`, `lint`, `typecheck`, `build`), signed commits, no direct push, no force push, no deletion
- Tag protection ruleset on `deploy-*`: allow `github-actions[bot]` push + delete; deny everyone else
- Tag protection ruleset on `v*`: deny force-push + deletion (releases via UI only)
- GitHub Environments configured: `dev`, `stg`, `prod`. Per-env secrets `AZURE_CLIENT_ID_<ENV>` (populated from the `make apply-platform-<env>` output in the infra repo). Reviewers required on `prod` only.
- GitHub Advanced Security enabled (secret scanning + push protection)

**Acceptance:** A test direct-push to `main` is rejected; an unsigned commit is rejected; a `deploy-*` tag pushed by a human is rejected; the prod environment requires approval.

**Spec ref:** stack-design §6.6, §6.7.

### Task 1.1c — Cross-repo dispatch wiring (gated)

Wire the `repository_dispatch` step in each `deploy-<env>.yml` to fire against the infra repo, but **gated so it's dormant until the Azure estate is ready**.

**Configuration:**
- Repo variable `INFRA_DISPATCH_ENABLED` — default `false`; flip to `true` once the infra repo exists, federated identities are provisioned, and the deploy chain is intended to run end-to-end.
- Repo variable `INFRA_DISPATCH_TARGET_REPO` — set to `hmcts/dts-portfolio-portal-infra` when the repo is created.
- Repo secret `INFRA_DISPATCH_APP_ID` + `INFRA_DISPATCH_PRIVATE_KEY` (GitHub App; preferred) OR `INFRA_DISPATCH_TOKEN` (fine-scoped PAT) — populated when the dispatch goes live.

**Workflow step shape:**
```yaml
- name: Trigger infra deploy
  if: vars.INFRA_DISPATCH_ENABLED == 'true'
  uses: peter-evans/repository-dispatch@v3
  with:
    token: ${{ steps.app-token.outputs.token }}
    repository: ${{ vars.INFRA_DISPATCH_TARGET_REPO }}
    event-type: deploy-${{ env.DEPLOY_ENV }}
    client-payload: |
      { "version": "${{ needs.build.outputs.version }}", "image_tag": "${{ needs.build.outputs.version }}", "run_id": "${{ github.run_id }}" }
```

**Acceptance:** With `INFRA_DISPATCH_ENABLED=false`, the deploy workflow completes successfully (image builds, tag pushes) and the dispatch step is skipped cleanly — no error. With `INFRA_DISPATCH_ENABLED=true` and a valid target repo, dispatch fires and the infra repo's workflow receives the payload.

**Owner note:** The user creates the infra repo. This repo's Phase 1 work readies *everything* to dispatch; flipping the variable is the user's action once the estate is ready.

**Spec ref:** stack-design §3.4, §3.5, §9.

### Task 1.1d — Document infra-repo bootstrap requirements

Author `docs/runbooks/bootstrap-infra-repo.md` capturing what the user needs to do to create and prepare `hmcts/dts-portfolio-portal-infra`. Does not commit infra code to this repo — the infra code lives only in the infra repo per ADR-009.

**Contents of the runbook:**
- Create the infra repo at internal visibility under `hmcts/`
- Set up CODEOWNERS, branch protection, and rulesets to match this repo's posture
- Add the Terraform skeleton: `infrastructure/` (App Service, ACR-pull RBAC, Front Door, Postgres, OpenAI, Key Vault, App Insights, Log Analytics, Front Door) and `platform/` (managed identities, OIDC federation, RBAC)
- Add the `.github/workflows/deploy-<env>.yml` workflows triggered by `repository_dispatch` from this repo
- Add the `Makefile` patterns from courtstranscribe: `make setup-<env>` (init + plan) and `make apply-<env>` (apply after review)
- Run `make apply-platform-<env>` per environment and copy the federated client IDs into this repo's environment secrets (`AZURE_CLIENT_ID_DEV` / `_STG` / `_PROD`) and the infra repo's matching secrets
- Once federated identities work end-to-end with a manual `terraform apply`, set `INFRA_DISPATCH_ENABLED=true` and `INFRA_DISPATCH_TARGET_REPO=hmcts/dts-portfolio-portal-infra` in this repo's variables
- Confirm a `repository_dispatch` from this repo arrives in the infra repo and runs end-to-end

**Acceptance:** Runbook reads as a complete checklist; a colleague unfamiliar with the project can follow it without asking questions.

**Spec ref:** stack-design §3, §6.

### Task 1.2 — Visual tokens

Apply the tokens defined in ADR-007 as CSS variables. Add Geist font via the framework's font loader. Add Lucide as the icon dependency. Confirm a sample button + card visually matches the calm monochrome target.

**Acceptance:** A `/styleguide` route renders the token palette, the type scale, sample buttons (primary / outline / pill), a sample card with eyebrow + status pill, and a hairline divider. Designer sign-off captured.

**Spec ref:** §6.6.

### Task 1.3 — AppShell

Build the global shell: collapsible left sidebar (~224px), top bar spanning the right column, main content column with generous horizontal padding. Sidebar items list per §6.5. Search input lives in the top bar (non-functional placeholder; resolved in Phase 3). Active sidebar item gets the soft-grey pill.

**Acceptance:** Navigating between routes preserves the shell. Sidebar collapse remembered between visits. Keyboard navigation works through all shell elements. No layout shift on route change.

**Spec ref:** §6.5.

### Task 1.4 — Reusable page primitives

Build `PageHeader` (eyebrow → H1 → description → action cluster), `FilterStrip` (placeholder filters; we wire real filters per page), `CardGrid` (responsive 3-up), `StatusPill` (green/amber/red/blue/grey with required icon-or-label), `EyebrowLabel`. Each documented in `/styleguide` with prop examples.

**Acceptance:** Six examples in `/styleguide`; all primitives accept `aria-*` props correctly; status pills never rely on colour alone (audit by removing CSS colour temporarily and reading content).

**Spec ref:** §6.6, §8.1.

### Task 1.5 — Entity types

Define TypeScript types and runtime schemas (Zod or framework equivalent) for `Jurisdiction`, `ProductDomain`, `Team`, `Product`, `Initiative`. Include all relationships per §4 (strategic/operational owners, consumed-by). Add a `seedShape.test.ts` that asserts the seed validates against the schemas.

**Acceptance:** Schema tests pass; schemas are the single source of truth for entity shape; type definitions exported from one module imported everywhere.

**Spec ref:** §4.

### Task 1.6 — Seed data

Author `lib/seed/seed.json` (or framework equivalent) with at least: 2 Jurisdictions, 4 Product Domains, 6 Teams, 12 Products, 30 Initiatives spread across NOW / NEXT / LATER. Include 1 cross-Jurisdiction "consumed by" relationship. Use plausible HMCTS names. Validate against schemas from 1.5.

**Acceptance:** Schema validation passes; seed is rich enough for every page below to look populated, not empty.

**Spec ref:** §4.

### Task 1.7 — Modal-as-detail pattern

Build the slide-over modal component. URL-deep-linkable (e.g. `/d/court-hearing-domain-a?modal=product:common-components`). On open: preserves underlying page state (scroll, filters), traps focus, restores focus to trigger on close. Includes a "View as page" affordance.

**Acceptance:** Open a Product modal from the Domain page; refresh the URL; same modal-over-context appears. Tab cycles within the modal only while open. Screen reader announces modal title on open.

**Spec ref:** §6.2, §8.1.

### Task 1.8 — Breadcrumbs

Build `Breadcrumbs` component. Used on every entity page and inside modals. Clickable segments navigate up. Format: Jurisdiction → Domain → (Team | Product).

**Acceptance:** Visible on all five entity surfaces; keyboard accessible; reads correctly to a screen reader.

**Spec ref:** §6.4.

### Task 1.9 — Home page

Build the cross-DTS roadmap matrix per §5.2: rows grouped by Jurisdiction, three columns (NOW / NEXT / LATER), initiative chips per cell. Jurisdictions other than the first collapsed by default; sticky preference for "filter to your Jurisdiction" (persisted in localStorage until auth lands). Always-on search input above the matrix (non-functional placeholder). No KPI tile strip.

**Acceptance:** Home renders the seed data; collapse state remembered; chip overflow handled (expandable cell). Accessibility: matrix has proper table semantics or grid role with row/col headers.

**Spec ref:** §5.2.

### Task 1.10 — Jurisdiction page

Build `/j/[slug]` per §5.3: header band, Jurisdiction-scoped Domain roadmap matrix, list of Domains, list of consumed-from-elsewhere Products.

**Acceptance:** Loads seed Jurisdiction; matrix shows only this Jurisdiction's Domains; consumed-by section appears when at least one cross-Jurisdiction relationship exists.

**Spec ref:** §5.3.

### Task 1.11 — Product Domain page

Build `/d/[slug]` per §5.4: header, Strategic Direction themes, light FilterStrip, Teams card grid, Products card grid.

**Acceptance:** Theme cards render; filters reduce both grids cohesively; Product cards show the breadcrumb eyebrow (Jurisdiction · Domain), stage pill, clamped description, operating Team and last-approved date placeholder.

**Spec ref:** §5.4.

### Task 1.12 — Team page

Build `/t/[slug]` per §5.5: header band with breadcrumb and how-to-reach text, About block, Products grid, latest-activity stub (populated in Phase 2 from audit log; static placeholder in Phase 1).

**Acceptance:** Renders for any seed Team; Markdown-rendered About block (use the same Markdown renderer chosen for Product descriptions); contact links are clickable (`mailto:`, Slack DL).

**Spec ref:** §5.5.

### Task 1.13 — Product page

Build `/p/[slug]` per §5.6: header, description, NOW/NEXT/LATER roadmap, outbound-links block, operating Team card, Strategic Domain card, Consumed-by list.

**Acceptance:** Roadmap chips display per time bucket; clicking a chip opens the popover (1.14); outbound links open in new tab with destination label.

**Spec ref:** §5.6.

### Task 1.14 — Initiative popover and modal

Build the two response surfaces (B2 + B3 from brainstorming): hover/click on a chip → popover (one-line, owner, outbound link); "More" → modal-as-detail showing the full chip with title, description, time bucket, outbound link. Initiative has **no full-page view**.

**Acceptance:** Popover dismisses on outside click and Escape; modal supports the same URL-deep-link pattern as 1.7.

**Spec ref:** §4.3, §5.6, §6.2.

### Task 1.15 — Empty / loading / error states

Add three states for every list and matrix surface: skeleton cards/shimmer for loading; friendly empty messages ("This Domain hasn't added any Products yet"); error states with a recovery action.

**Acceptance:** Force each state via a query param or test page; screen reader announces the state appropriately.

**Spec ref:** §3.2 ("Out of scope" excludes anything fancier than this).

### Task 1.16 — Sidebar Jurisdictions expansion

Wire the sidebar Jurisdictions item per §6.5: clicking expands to show all Jurisdictions; clicking one navigates to its Jurisdiction page.

**Acceptance:** Expansion is keyboard-operable; expanded state persisted; current Jurisdiction highlighted.

**Spec ref:** §6.5.

### Task 1.17 — Help and Add-content placeholder pages

Stub the Help page (linking to templates — actual templates appear in Phase 2) and the Add-content page (placeholder text — actual upload UI in Phase 2). These prevent broken sidebar links during Phase 1.

**Acceptance:** Both routes render a clear "coming in Phase 2" message; no dead links from the sidebar.

### Task 1.18 — Claude design pass

Run a Claude design pass on the scaffolded portal. Capture mockups for each of the six pages with the seeded data. Feed back into 1.2 / 1.4 if tokens or primitives need adjusting. Lock the visual language at the end.

**Acceptance:** Mockups stored in `docs/design/phase-1-mockups/`; design adjustments back-ported into the scaffold; visual review signed off.

**Spec ref:** §6.6.

### Task 1.19 — Phase 1 review and demo

Walk-through demo: open the portal, navigate every page, open every modal, exercise every empty/error state. Verify against §5 page-by-page.

**Acceptance:** All six pages and the modal-as-detail pattern work with seed data; sign-off captured before Phase 2 begins.

---

# Phase 2 — Markdown upload + AI parse + approval

**Goal:** Replace seed data with live data submitted via the markdown lifecycle. End state: any authorised contributor can upload a markdown file, see AI's parse, approve and publish, and the result renders on the portal.

**Demoable outcome:** Take any seed Team out of the JSON. Author its `team.md`. Upload. Watch AI parse it. Approve. See the Team page exactly as before, now sourced from the live store.

**Spec sections covered:** §7 (all subsections).

### Task 2.1 — Markdown identity parser

Build a parser for the strict YAML front-matter (§7.1): `type`, `name`, parent reference. Reject malformed front-matter with a clear error.

**Acceptance:** Unit tests cover: well-formed front-matter parses; missing fields rejected; unknown `type` rejected; parent reference present and shaped correctly.

**Spec ref:** §7.1.

### Task 2.2 — Strict-template body parser (AI fallback)

Build a deterministic parser that handles the *canonical* template body — exact section headers in expected order — used as the fallback if AI is unavailable (§7.5). Sections vary by entity type.

**Acceptance:** Unit tests cover canonical templates for each of the three entity types. Tolerates blank optional sections. Documented as the "well-formed" path that AI is permitted to deviate from.

**Spec ref:** §7.5.

### Task 2.3 — AI parser integration

Wire the Azure OpenAI client (per ADR-003). Define a structured-output schema (JSON schema matching entity types from Task 1.5). System prompt instructs: parse loosely-named sections, surface low-confidence fields, surface unrecognised content, never invent fields. Cache by source-markdown hash.

**Acceptance:** Integration test against the live Azure OpenAI dev tenant: well-formed markdown parses to expected JSON; loose-named sections (e.g. "Contact us" → contact block) parse correctly; intentionally-broken markdown returns error states rather than half-parsed data.

**Spec ref:** §7.1, §7.5.

### Task 2.4 — Audit log storage

Build the append-only audit log table per §7.6. Schema: `submission_id`, `entity_kind`, `entity_id`, `submitter`, `submitted_at`, `source_markdown_bytes`, `ai_parsed_output`, `ai_confidence_flags`, `approver`, `approved_at`, `version_number`, `notes`. Add a database-level constraint preventing UPDATE on inserted rows (only INSERT).

**Acceptance:** Schema tests: rows are insertable; updates rejected; deletes rejected. Documented as append-only.

**Spec ref:** §7.6.

### Task 2.5 — Upload route

Build the upload endpoint (`POST /api/uploads`): accepts a `.md` file or pasted markdown, stores the source to the audit log (with submitter from the auth layer — header-trusted in Phase 2; real auth in Phase 4), queues an AI parse, returns a draft submission ID.

**Acceptance:** Integration test: upload a valid Team markdown; submission record appears in audit log with raw bytes; AI parse job queued; response payload includes the submission ID and a link to the approval screen.

**Spec ref:** §7.1, §7.6.

### Task 2.6 — Approval screen

Build the approval UI per §7.4: split pane, source-left/parsed-right, AI confidence flags surfaced as warnings, "I didn't know what to do with this" panel for un-parseable content, inline edit affordances on parsed fields, Save-as-draft and Approve-and-publish buttons.

**Acceptance:** Walk-through with a real AI parse: low-confidence fields are highlighted; unrecognised sections appear in the dedicated panel with Drop / Add-as-note / Fix-in-source actions; inline edits persist on Save-as-draft.

**Spec ref:** §7.4, §7.5.

### Task 2.7 — Approve-and-publish endpoint

Build `POST /api/uploads/:id/approve`: writes the parsed-and-tweaked output to the live entity store, stamps approver + approved_at + version_number on the audit log row, sets the entity's "last approved by/on" metadata.

**Acceptance:** Integration test: approve a draft; live entity reflects new data; subsequent reads show the approved version; audit log row is now closed.

**Spec ref:** §7.4, §7.6.

### Task 2.8 — Diff view for updates

When the uploaded entity already exists, the approval screen shows a diff against the live version ("3 fields changed, 1 initiative added, 1 removed"). Highlight changed fields visually.

**Acceptance:** Re-upload an existing Team with a modified description and one extra roadmap item; diff view highlights exactly the two changes.

**Spec ref:** §7.4.

### Task 2.9 — Inline typo-fix flow

Add an Edit affordance on Team / Product / Domain pages for fields. Edit → routes through the approval screen as a single-field "update". Same approve-and-publish path.

**Acceptance:** Click Edit on a Team's contact line; tweak; the approval screen shows source-vs-parsed for just that field; approve; live page reflects. Audit log captures the same way as a full re-upload.

**Spec ref:** §7.4 ("Even a single-character typo-fix routes through this screen").

### Task 2.10 — Downloadable templates

Author three templates: `new-domain.md`, `new-team.md`, `new-product.md`. Each carries the section skeleton with commented explanations and an example. Download links surface on the Help page and the upload screen.

**Acceptance:** Download each template; upload it unmodified (after filling in identity fields); AI parses to a valid draft entity.

**Spec ref:** §7.2.

### Task 2.11 — Migrate seed data through the lifecycle

For every entity in the Phase 1 seed, hand-author the corresponding markdown, upload it, approve it. The live store now mirrors the seed.

**Acceptance:** The portal renders identically to Phase 1 but every entity is sourced from the live store; the Phase 1 `seed.json` is deleted.

**Spec ref:** §7.

### Task 2.12 — "Latest activity" on Team page

Wire the §5.5 "latest activity / what's next" block to query the audit log: most recent initiative changes across Products this Team operates.

**Acceptance:** Approving a Product roadmap change is reflected in the operating Team's latest-activity list within seconds.

**Spec ref:** §5.5, §7.6.

### Task 2.13 — AI cost monitoring

Add an ops dashboard (or scheduled report) tracking AI API calls per day, average tokens per parse, parse failure rate. Set a budget-alert threshold.

**Acceptance:** Dashboard accessible; alert fires on a synthetic budget breach.

**Spec ref:** spec doesn't require this; the plan adds it because ADR-003 flagged cost as a consequence.

### Task 2.14 — AI-down fallback path tested

Force the AI client offline (config flag). Upload a strict-template markdown. Confirm it parses via Task 2.2 fallback and approves cleanly.

**Acceptance:** With AI disabled, well-formed markdown still flows through to approval; an error path exists for badly-formed markdown.

**Spec ref:** §7.5.

### Task 2.15 — Phase 2 review and demo

Demo: upload a fresh Team, approve, see it live; edit a field, approve, see the change; upload an existing Product with diffs; verify audit log row count grows monotonically.

**Acceptance:** Sign-off captured before Phase 3 begins.

---

# Phase 3 — Search

**Goal:** Portal-wide natural-language search per §6.1 and §5.7.

**Demoable outcome:** Type *"who owns Common Platform?"* in the top-bar input. Within 500ms perceived, an overlay shows a one-sentence answer card citing the operating Team, plus the five ranked entity matches below. Enter takes you to the deep results page.

**Spec sections covered:** §5.7, §6.1, §8.2.

### Task 3.1 — Search index

Index entity content for full-text search per ADR-004. Index fields: entity name, description, themes, roadmap chip titles, contact, operating Team name. Re-index on approve-and-publish.

**Acceptance:** Re-indexing happens within seconds of approval; index search returns sane top-N for plain-text queries against seeded data.

**Spec ref:** §6.1.

### Task 3.2 — Search query API

Build `GET /api/search?q=...`. Returns: `{ topMatches: Entity[], queryId }`. `topMatches` are ranked by FTS score, optionally LLM-reranked at top-K.

**Acceptance:** Returns within 300ms for typical queries against seeded data. Unit tests cover: name-match, description-match, theme-match, no-match.

**Spec ref:** §6.1.

### Task 3.3 — Answer-card API

Build `POST /api/search/answer`. Input: NL query + top matches. Output: one-sentence answer card with entity citations. Uses Azure OpenAI (ADR-003) with a tight system prompt: answer only from the supplied entity context; cite entities by ID; refuse if no supporting entity present.

**Acceptance:** Answer card is generated within ~2s; refusal mode triggers on ambiguous / unsupported queries; citations link to live entities.

**Spec ref:** §5.7, §6.1.

### Task 3.4 — Instant overlay UI

Build the instant overlay under the top-bar search input. As the user types: debounced calls to 3.2 (fast), stream answer card from 3.3 (slower). Show top-5 matches + answer card. Dismiss on Escape, outside click, or selecting a match.

**Acceptance:** Type-to-results visible within 500ms perceived (answer card may stream after). Keyboard navigation through matches with arrow keys; Enter opens the highlighted match.

**Spec ref:** §6.1, §8.2.

### Task 3.5 — Deep results page

Build `/search?q=...` per §5.7: answer card at top, ranked entity matches below grouped by entity type with filter chips (Jurisdiction / Domain / Team / Product / Initiative).

**Acceptance:** Filter chips narrow results in place; URL reflects the active filters and query for shareability.

**Spec ref:** §5.7.

### Task 3.6 — Keyboard shortcuts

`/` and `⌘K` (or `Ctrl-K`) focus the search input from any page. Escape blurs it.

**Acceptance:** Shortcut works on every page; doesn't conflict with form inputs; documented in the Help page.

**Spec ref:** §6.1.

### Task 3.7 — Search analytics

Log every query (anonymised by Phase 4 auth identity) with: query text, top-result entity ID, whether the user clicked a result. Surface zero-result queries on the ops dashboard.

**Acceptance:** Dashboard shows zero-result query list; queries with answers but zero clicks visible for relevance triage.

**Spec ref:** plan adds this; spec does not require it but anticipates it.

### Task 3.8 — Phase 3 performance pass

Profile the overlay critical path. Confirm 500ms perceived budget. Optimise if needed (db query plan; LLM streaming; cache).

**Acceptance:** Lighthouse / Web Vitals on a search interaction stay under budget on the staging environment.

**Spec ref:** §8.2.

### Task 3.9 — Phase 3 review and demo

Demo: a half-dozen real questions exercising the answer card, the ranked list, the keyboard shortcuts, and the deep results filtering. Capture any low-confidence answers for future LLM-prompt iteration.

**Acceptance:** Sign-off captured before Phase 4 begins.

---

# Phase 4 — Auth integration

**Goal:** Wire the authentication provider chosen in ADR-005. Authenticated DTS staff only; team membership exposed to the portal.

**Demoable outcome:** Visit the portal unsigned-in — redirected to the provider sign-in. Sign in. "Your team" shortcut appears on the home page and Profile menu. Submitter on uploads is your authenticated identity, not a fake header.

**Spec sections covered:** §7.7 (capability gating), §8.5 (authentication).

### Task 4.1 — Easy Auth integration (Entra ID)

Configure App Service Easy Auth (the platform sidecar) to require Microsoft Entra ID sign-in. No auth library in the Next.js code — the sidecar handles the OIDC dance and surfaces the signed-in identity via the `X-MS-CLIENT-PRINCIPAL` header on every request that reaches the app. In Next.js, read the header inside an RSC helper that returns a typed `getCurrentUser()` value (email, OID, groups). Sign-out via `/.auth/logout`.

**Files (infra repo, this task surfaces the requirement):** Terraform configures `auth_settings_v2` on the App Service with Entra provider. App registration created (or referenced) per the deployment runbook.

**Acceptance:** Visiting `/` in a non-prod env without an Entra session redirects to the Entra sign-in page; after sign-in, `getCurrentUser()` returns the expected identity; `/.auth/logout` clears the session.

**Spec ref:** §8.5, stack-design §4, §10 (ADR-005).

### Task 4.2 — Local-dev auth shim

Easy Auth lives at the platform edge, so local dev (running `next dev` or `docker compose up`) doesn't see the `X-MS-CLIENT-PRINCIPAL` header. Provide a dev-only middleware that injects a fake principal header from an `.env.local` value (`DEV_FAKE_PRINCIPAL_EMAIL`, `DEV_FAKE_PRINCIPAL_GROUPS`). The middleware **must not** be reachable in production — gated by a build-time flag or a hard `NODE_ENV !== 'production'` check.

**Acceptance:** `pnpm dev` populates `getCurrentUser()` from the env-injected fake principal; production build fails an assertion if the shim is reachable.

**Spec ref:** §8.5.

### Task 4.3 — Team membership claim

Decode the Entra group claim (or equivalent) into a Team membership list. Document the naming convention (per ADR-005). Expose the user's team(s) to the app via a typed `getCurrentUser()` helper.

**Acceptance:** Test harness simulates Entra group claims; `getCurrentUser()` returns the expected team(s).

**Spec ref:** §5.2 ("Your team" shortcut).

### Task 4.4 — "Your team" shortcut

Wire the home-page shortcut per §5.2 and the Profile menu item per §6.5. Hidden if no team membership claim. Multiple memberships render as a small picker.

**Acceptance:** Shortcut links to the user's Team page; hidden gracefully when claim absent; tested for users in 0, 1, and >1 teams.

**Spec ref:** §5.2, §6.5.

### Task 4.5 — Submitter and approver populated from auth

Replace the header-trusted submitter/approver wiring (Phase 2 stub) with the authenticated identity. Submitter recorded on upload; approver recorded on approve-and-publish.

**Acceptance:** Upload as user A, approve as user B; audit-log row shows the two emails distinctly.

**Spec ref:** §7.6, §7.7.

### Task 4.6 — Capability checks

Enforce the conceptual capability matrix from §7.7. v1 doesn't ship full RBAC; the minimum is: anyone authenticated can upload (any entity); anyone authenticated can approve; the audit log captures who did what.

**Acceptance:** Unauthenticated `POST /api/uploads` rejected; capability matrix decisions documented for future tightening.

**Spec ref:** §7.7.

### Task 4.7 — Optional 4-eyes feature flag

Add a feature flag (default off in v1) enforcing approver != submitter. When on, approve endpoint rejects with a 403 when same person.

**Acceptance:** Flag off → self-approval permitted (default); flag on → self-approval rejected. Document the flag in operator docs.

**Spec ref:** §7.7 ("4-eyes-ready but not enforced").

### Task 4.8 — Phase 4 review and demo

Demo: sign in as two different users; user A uploads, user B approves; "your team" shortcut works for both; production preview rejects header-trusted email entirely.

**Acceptance:** Sign-off captured before Phase 5 begins.

---

# Phase 5 — Hardening

**Goal:** Production-ready: accessibility audited, performance budgets met, observability and backup wired, deployable.

**Demoable outcome:** Phase 5 closes with a production cut over to Azure App Service (or chosen platform). Operator docs cover the routine ops scenarios.

**Spec sections covered:** §8.1, §8.2, §8.4.

### Task 5.1 — WCAG 2.2 AA audit

Run automated audits (axe-core) on every page. Run manual screen reader passes (NVDA on Windows, VoiceOver on macOS) on the home, search overlay, modal-as-detail, and the approval screen. Fix every blocker.

**Acceptance:** Zero axe violations on a baseline scan; manual screen reader run-throughs documented; any reasonable AAA improvements applied opportunistically.

**Spec ref:** §8.1.

### Task 5.2 — Keyboard navigation audit

Tab through every page; verify focus rings, focus order, and that focus doesn't escape modals.

**Acceptance:** Audit report documents the keyboard journey; any traps fixed; visible-focus styles consistent.

**Spec ref:** §8.1.

### Task 5.3 — Colour-blind safety audit

Disable colour CSS (force greyscale); verify every status pill remains intelligible via icon or label.

**Acceptance:** Audit screenshots stored in `docs/design/colour-blind-pass/`.

**Spec ref:** §8.1.

### Task 5.4 — Performance audit

Lighthouse runs on home, Domain page, Product page, search results. Hit the §8.2 budgets: 2s home, 500ms perceived search overlay.

**Acceptance:** Lighthouse scores recorded; any blockers fixed (image sizes, JS bundle, RSC vs client component split, db query plans).

**Spec ref:** §8.2.

### Task 5.5 — Caching strategy

Approve-and-publish is the only state-change for read paths; everything else is static-friendly. Set HTTP cache headers (with revalidation on approve); enable framework-level data caching; CDN if available on the chosen host.

**Acceptance:** Cold and warm cache benchmarks recorded; cache invalidates within seconds of approve.

**Spec ref:** §8.2.

### Task 5.6 — Observability

Structured logs for: route handler entry/exit, AI calls (tokens, latency, errors), DB query timings, auth events. Error reporting (Sentry or equivalent). Search-analytics dashboard from 3.7 integrated.

**Acceptance:** A synthetic error appears in the error reporter within seconds; logs queryable via the standard ops tooling.

**Spec ref:** plan adds; spec implies.

### Task 5.7 — Backup and disaster recovery

Document RPO/RTO for the content store + audit log. Configure automated Postgres backups + point-in-time recovery per the chosen host. Test a restore against a clean environment.

**Acceptance:** Restore drill documented; runbook lives in operator docs.

**Spec ref:** §3.2 (consumed-by, append-only) implies the audit log is precious.

### Task 5.8 — Deployment automation (all-GHA, cross-repo)

CI builds an immutable container artefact, pushes to HMCTS ACR, pushes a `deploy-<env>-<version>-<runid>` git tag, and fires `repository_dispatch` against the infra repo (per ADR-010). The infra repo's matching workflow runs `terraform plan` (precheck), `terraform apply`, `az webapp config set --linuxFxVersion`, `az webapp restart`, and post-deploy smoke tests. Production deploy is a manual `workflow_dispatch` with a version-existence check against ACR (no rebuild). Rollback is a re-run of the prod deploy workflow against the previous version.

**Acceptance:** Successful end-to-end deploy via the cross-repo chain in dev; staging deploy fires from a GitHub release; production promotion verifies the image exists in ACR before tagging; rollback rehearsed by promoting a previous version.

**Spec ref:** stack-design §3.4, §6, §10 (ADR-010).

### Task 5.9 — Operator documentation

Write `docs/runbooks/`:
- adding a new Jurisdiction (config change)
- on-call: how to restore from backup
- on-call: how to archive a deprecated entity
- on-call: how to toggle the 4-eyes feature flag
- on-call: how to disable AI parsing (fallback to strict-template parser)
- monthly: review search-zero-result queries, AI budget, audit log row count

**Acceptance:** Each runbook tested by a colleague who hasn't seen the portal before.

**Spec ref:** §3.2 ("admin actions creating new Jurisdictions… managed as configuration").

### Task 5.10 — Re-evaluate infra-repo visibility

Per ADR-009 and stack-design §3 / §9: the infra repo started at internal visibility with intent to publish. By Phase 5 we have a body of code to audit and a clear sense of what's exposed.

- [ ] Audit the infra repo for residual sensitivity per stack-design §3.3 (no hardcoded IDs, no secret names that reveal internal structure beyond what's already public via DNS / App Service URLs, no comments referencing internal context).
- [ ] Consult HMCTS-DTS PlatOps on the IaC publicity stance. Capture the position as a follow-up ADR.
- [ ] If approved: flip the infra repo to public. Update ADR-009 status to "Superseded by ADR-NNN" (the follow-up).
- [ ] If declined: capture the reason in a follow-up ADR; leave the infra repo internal.

**Acceptance:** Position is recorded as an ADR with a concrete rationale, regardless of direction.

**Spec ref:** stack-design §3.3, §9; ADR-009.

### Task 5.11 — Production cutover and Phase 5 review

Cut the portal over to production (the chosen host, the chosen auth provider, the chosen AI tenant). Hold a release retrospective. Capture v2 backlog items.

**Acceptance:** Portal live; release retro notes filed; v2 backlog reviewed against the deferred items below.

---

# Phase 6 — Deferred v2 work (not in scope for v1, listed for tracking)

Items from §3.2 that may become v2 work, depending on adoption signals:

- "Draft from prose" reverse mode for first-time authors
- ChangeLog / per-field audit trail
- Per-field RBAC, editor allowlists
- Submission wizards / multi-step forms (only if upload UX proves insufficient)
- Rich-text / Portable Text editor
- Comments / threads / @-mentions
- Notifications / email reminders for stale data
- Exports (Excel / Word / PowerPoint)
- Compare mode, reporting cuts, snapshots
- KPI tile strips
- Tiering / DPIA / governance compliance fields
- 4-eyes approval *enforced by policy* (the flag exists in v1; v2 turns it on)
- Mobile-optimised experience
- Multilingual / Welsh content
- Git repo as canonical content store (round-trippable already)
- Direct integration with Ardoq / Jira / Confluence (data pulled in, not just linked out)
- Cross-Jurisdiction roadmap aggregations beyond the home matrix

Each v2 item should get its own brainstorming + spec + plan cycle when prioritised.

---

# Self-review

Run inline against the spec.

**1. Spec coverage:**

| Spec section | Phase / Task | Notes |
|---|---|---|
| §1 Purpose / north star | All phases reflect "high-level front door, not replacement" | The hardening phase preserves the link-out posture. |
| §2 Audiences | All page tasks are mapped to audiences | Leadership → home & Jurisdiction; Delivery → upload + Team page; All staff → search. |
| §3.1 In scope v1 | All in-scope items have phase tasks | Crime/Civil/Family/Tribunals/Administrative seeded; full content lifecycle in Phase 2; search Phase 3. |
| §3.2 Out of scope v1 | Listed in Phase 6; nothing slipped into v1 | Verified. |
| §4 Entity model | Task 1.5 (types), 1.6 (seed), 2.5–2.7 (live data) | All five entities represented; consumed-by relationship handled at seed + at upload time. |
| §4.3 Two roadmap altitudes | 1.9 (home matrix), 1.11 (Domain themes), 1.13 (Product roadmap) | Both altitudes covered. |
| §5 Pages | 1.9–1.13 (five entity pages) + 3.5 (search results) | Six pages covered. |
| §6.1 Search | Phase 3 in full | Covered. |
| §6.2 Modal-as-detail | 1.7, 1.14 | Covered. |
| §6.3 Outbound linking | 1.13 | Covered. |
| §6.4 Breadcrumbs | 1.8 | Covered. |
| §6.5 Sidebar | 1.3, 1.16 | Covered. |
| §6.6 Visual language | 0.7 (ADR), 1.2 (tokens), 1.18 (Claude pass) | Covered. |
| §7.1–§7.4 Authoring + approval | 2.1–2.10 | Covered. |
| §7.5 AI behaviour | 2.3, 2.14 | Covered. |
| §7.6 Audit log | 2.4 | Covered. |
| §7.7 Capabilities | 4.6, 4.7 | Covered. |
| §8.1 Accessibility | 1.4 + 5.1–5.3 | Covered. |
| §8.2 Performance | 3.8 + 5.4–5.5 | Covered. |
| §8.3 Language | UI is English by default; no task needed | Implicit. |
| §8.4 Device support | Phase 1 layout is desktop-primary; 5.4 audit checks tablet | Covered. |
| §8.5 Auth | Phase 4 in full | Covered. |

No gaps identified.

**2. Placeholder scan:**

No "TBD" / "TODO" / "fill in details" outside Phase 0, where the *content* of the decision records is genuinely produced during that phase (that's the work, not a placeholder).

No "Similar to Task N" references — each task is self-contained.

No code blocks with `...` stubs — code-level snippets are intentionally absent from this plan because the stack is undecided; the plan-altitude note at the top makes that explicit.

**3. Type consistency:**

Entity names (`Jurisdiction`, `ProductDomain`, `Team`, `Product`, `Initiative`) used identically across the plan. Field names from §7.6 (`submission_id`, `entity_kind`, etc.) used as-is in Task 2.4.

API endpoint paths (`/api/uploads`, `/api/search`, `/api/search/answer`) consistent across tasks.

URL patterns (`/j/[slug]`, `/d/[slug]`, `/t/[slug]`, `/p/[slug]`, `/search`) consistent with §5.1.

No drift detected.

---

# Execution handoff

**The user has explicitly asked NOT to execute the implementation in this session.** This plan is for future execution.

When ready to execute, the two options offered by the writing-plans skill are:

1. **Subagent-Driven (recommended)** — fresh subagent per task; review between tasks; fast iteration. Best fit once Phase 0 has produced concrete ADRs and Phase 1 tasks are refined into TDD bite-sized steps.

2. **Inline Execution** — execute tasks in the same session via the executing-plans skill; batch execution with checkpoints.

**Recommended sequencing for execution:**
1. Run Phase 0 in a single session (decisions only, no code) — output is ADRs.
2. Before each subsequent phase, **refine that phase's task list into TDD-style steps** matching the writing-plans default form (file paths, test code, run commands, expected output, commit step). This refinement is itself a writing-plans pass once the stack is fixed.
3. Then execute the refined plan via subagent-driven development.

This two-stage approach (high-level plan → per-phase refined plan) lets you keep this top-level document as the durable map while each phase plan gets the TDD-grade detail it needs.
