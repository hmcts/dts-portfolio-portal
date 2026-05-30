---
title: DTS Portfolio Portal — Python + Kubernetes Restack Design
date: 2026-05-21
status: Draft (supersedes the 2026-05-19 Azure stack design once approved)
purpose: Capture the design for re-platforming the portal to a Python backend and Kubernetes deployment target in response to the HMCTS-DTS landing zone's runtime constraint. Retains the frozen Next.js UI work as the frontend; introduces a FastAPI backend; sets the monorepo / polyrepo-ready shape, the data-layer transition, and the cutover sequencing.
related:
  - docs/superpowers/specs/2026-05-19-azure-stack-design.md
  - docs/decisions/2026-05-19-adr-001-web-framework.md
  - docs/decisions/2026-05-19-adr-002-content-store.md
  - docs/decisions/2026-05-19-adr-005-authentication.md
  - docs/decisions/2026-05-19-adr-006-hosting.md
  - docs/decisions/2026-05-19-adr-008-platform-services.md
  - docs/decisions/2026-05-19-adr-009-repo-topology.md
---

# DTS Portfolio Portal — Python + Kubernetes Restack Design

## 1. Purpose

The 2026-05-19 stack design committed the portal to Next.js (App Router) + Prisma + Azure App Service for Linux. That design assumed an Azure App Service hosting environment. The HMCTS-DTS PlatOps landing zone that the portal will actually target requires Python at the runtime layer; JavaScript / TypeScript server runtimes are not first-class. This document supersedes the relevant portions of the 2026-05-19 design with a Python + Kubernetes shape.

What does not change: the product, the data model, the authoring loop (markdown-canonical with AI parse + human approval), the visual language, the audit log discipline, the public-repo posture. The change is architectural: the server-side application moves to Python, the deployment target moves to Kubernetes, and the frontend separates from the backend cleanly.

## 2. Constraints driving the design

| # | Constraint | Source |
|---|---|---|
| C1 | **Landing-zone runtime is Python.** The HMCTS-DTS PlatOps landing zone that the portal will deploy into supports Python at the server runtime layer; JS/TS server runtimes are not first-class. This constraint is hard; it cannot be negotiated. | User direction, 2026-05-21 |
| C2 | **Deployment target is Kubernetes.** The landing zone runs workloads on Kubernetes. The portal's previous App Service shape no longer applies. | User direction, 2026-05-21 |
| C3 | **Keep the frozen Next.js UI work.** ~95% of the React UI shipped through Phase 1 carries over without modification. The constraint is at the server runtime; static asset serving and the React frontend are not the same surface. | User direction, 2026-05-21 |
| C4 | **Match the established HMCTS-DTS pattern at the application layer.** A precedent application in the same line uses Next.js + FastAPI as a two-container monorepo. Adopting the same shape minimises the per-team learning curve and lets us share infrastructure idioms across services. | User direction, 2026-05-21 |
| C5 | **Be polyrepo-ready while running as a monorepo.** Each top-level directory is independently buildable, with no cross-imports between halves. The future split into separate repos is a `git filter-repo` + path tweak, not a refactor. | User direction, 2026-05-21 |
| C6 | **Code in the open is unchanged.** This repository remains public. The discipline list from the 2026-05-19 design (no secrets in code, no internal hostnames, fictional fixture data, masked plan output) applies in full. | Pre-existing |
| C7 | **TDD as a contract is unchanged.** Coverage gates remain on both halves. Each repository test target — Python and TypeScript — runs under CI before merge. | Pre-existing |

## 3. Repository topology

### 3.1 One repository (for now), shaped for an easy future split

```
hmcts/dts-portfolio-portal/                  (public, monorepo)
├── backend/                                 # Python FastAPI service
│   ├── app/
│   │   ├── api/                             # routers, one per entity type
│   │   ├── models/                          # SQLModel classes
│   │   ├── repositories/                    # query helpers
│   │   ├── ai/                              # AI parser + answer-card
│   │   ├── auth/                            # identity-header dependency
│   │   └── main.py                          # FastAPI + OpenAPI mount
│   ├── alembic/                             # baselined from current Postgres
│   ├── tests/                               # pytest + httpx
│   ├── pyproject.toml                       # uv-managed deps
│   ├── Dockerfile
│   └── start.sh                             # alembic upgrade head + uvicorn
│
├── frontend/                                # Next.js application (was src/)
│   ├── app/                                 # App Router pages
│   ├── components/                          # React components
│   ├── lib/
│   │   ├── api-client.ts                    # wraps fetch + typed responses
│   │   └── api/generated/                   # gitignored; produced from OpenAPI
│   ├── proxy.ts                             # auth gate (Next.js 16 middleware)
│   ├── Caddyfile                            # reverse-proxy /api/* → backend
│   ├── supervisord.conf                     # runs caddy + node start.js
│   ├── Dockerfile                           # multi-stage; final stage runs supervisord
│   └── package.json
│
├── docs/                                    # specs, ADRs, plans
├── docker-compose.yml                       # database + backend + frontend
├── docker-compose.dev.yml                   # bind-mount overlay for hot-reload
├── Makefile                                 # coordinates both halves
└── README.md
```

### 3.2 Split-ready discipline

| Discipline | How |
|---|---|
| Each half has a complete build | `frontend/Dockerfile`, `backend/Dockerfile`, separate lockfiles, separate dependency trees |
| No cross-directory source imports | The frontend imports backend types only through `lib/api/generated/` (produced from the backend's OpenAPI document). Source code does not cross directories. |
| CI paths are independent | A change under `backend/**` does not trigger frontend test runs and vice versa. |
| Shared coordinating files at root | `docker-compose.yml`, `Makefile`, `docs/`. These are easy to duplicate or leave behind when the split happens. |

When the future split is taken, the resulting repos can be `dts-portfolio-portal-frontend` and `dts-portfolio-portal-backend`. The OpenAPI contract is the only coupling that needs continued coordination.

### 3.3 Infrastructure repository is unchanged in topology, changed in content

Per ADR-009 the infrastructure code lives in a sibling repository (`hmcts/dts-portfolio-portal-infra`). That separation stays. The contents change: the Terraform that previously provisioned App Service + slots + Front Door is replaced by Kubernetes resources (Helm chart or equivalent) + supporting Azure services. The Phase 1 infra plan (drafted against App Service) is superseded; a fresh plan against the landing zone follows once PlatOps's specifics are known.

## 4. Backend service

### 4.1 Framework and runtime

| Choice | Value | Why |
|---|---|---|
| Language | Python 3.12+ | Landing zone target; widely supported |
| Web framework | FastAPI | Async-first, Pydantic-validated, OpenAPI native — the directly equivalent shape to the current TypeScript + Zod code |
| ASGI server | uvicorn | Standard FastAPI runtime |
| Package manager | uv | Faster than pip; lockfile (`uv.lock`) determinism; matches the established HMCTS-DTS pattern |
| Data access | SQLModel (Pydantic + SQLAlchemy 2.0) | One class definition serves as ORM model and response schema; matches the established pattern |
| Migrations | Alembic | Standard for SQLAlchemy; baseline from the current Postgres schema |
| Postgres driver | asyncpg + psycopg2-binary | asyncpg for the app; psycopg2 needed by SQLAlchemy tooling |
| HTTP client | httpx | Standard for FastAPI; async-friendly |
| Tests | pytest + pytest-asyncio + httpx | Standard FastAPI testing toolkit |
| Lint / format | ruff | Single tool for both; faster than the historical black + flake8 split |

### 4.2 Identity model is unchanged in shape, changed in mechanism

The application code trusts identity headers set at the platform edge — same model the 2026-05-19 design called out for App Service Easy Auth. The K8s equivalent depends on what the landing zone provides; the most common pattern is oauth2-proxy (either as an ingress middleware or a per-namespace deployment) doing OIDC against Microsoft Entra ID and injecting identity headers on upstream requests.

What we lock in here: the application reads identity from headers via a single FastAPI dependency (`backend/app/auth/identity.py`). That dependency abstracts over whichever mechanism the landing zone provides. No OIDC library in the application code; no token handling in the application code. The concrete header names and the identity-provider mechanism are deferred to landing-zone guidance.

### 4.3 AI parser and answer-card synthesis

The Azure OpenAI integration moves from `openai` (Node SDK) to `openai` (Python SDK, Azure configuration). The structured-output pattern (JSON schema or function calling) is identical between the two SDKs. The AI parser becomes `backend/app/ai/parser.py`; the answer-card synthesis becomes `backend/app/ai/answer_card.py`. Same prompts, same schemas, same content-filter expectations. The wire format on the React side does not change.

### 4.4 Local development entrypoint

`backend/start.sh` runs `alembic upgrade head` then `uvicorn app.main:app`. Local developers run the whole stack via `docker-compose up` from the repo root. The database container is `postgres:16` with a persisted volume; the backend container is built from `./backend`; the frontend container is built from `./frontend`.

## 5. Frontend service

### 5.1 Framework retained

Next.js (App Router, standalone output) stays. The constraint at C1 applies to the *server runtime* — the Next.js standalone runtime in its own container, fronted by Caddy, is the established pattern. Most of the React UI shipped through Phase 1 carries over without modification.

### 5.2 Container shape

The frontend container packages two processes managed by supervisord:

| Process | Listens on | Role |
|---|---|---|
| Caddy | `:3000` (exposed) | TLS termination is handled upstream; Caddy here is the routing layer. Reverse-proxies `/api/*` to the backend service over in-cluster DNS. Falls through to Next.js for everything else. |
| Next.js | `127.0.0.1:3001` (loopback only) | Standalone server produced by `next build`. Not reachable outside the Pod; Caddy is the only entry point. |

The multi-stage Dockerfile builds the Next.js standalone bundle, copies the runtime files into a slim Alpine image, adds `caddy` and `supervisor` system packages, and runs `supervisord` as the container entrypoint. The Caddyfile and supervisord.conf are committed to `frontend/`.

### 5.3 Typed API client

The backend exposes its OpenAPI document at `/api/openapi.json`. A script at `frontend/scripts/generate-api.ts` invokes `openapi-typescript-codegen` against that URL and writes typed models into `frontend/lib/api/generated/`. That directory is gitignored. The CI workflow regenerates and checks for drift on every build.

A hand-written wrapper at `frontend/lib/api-client.ts` provides ergonomic methods around the generated types — one method per endpoint, with explicit return types from the generated models. Identity headers from the incoming request are propagated to outgoing `fetch()` calls on the server side; in the browser the request goes to the same origin so headers are propagated by the browser.

### 5.4 Server Components vs Client Components

The current page split is retained. Pages stay Server Components and fetch via the API client on the server side (better TTFB; HTML hits the browser ready-painted). Interactive surfaces — the chip drawer, the sidebar's expand state, the search overlay — stay Client Components and call the API client from the browser via the same wrapper.

### 5.5 Auth gate

`frontend/proxy.ts` (Next.js 16 middleware) checks for the identity-cookie-or-header that the landing zone's auth layer sets, and redirects unauthenticated users to the login route. The concrete cookie or header name depends on landing-zone guidance. The pattern is the same regardless: middleware checks a single piece of evidence, redirects on miss, otherwise passes through.

## 6. Data layer

### 6.1 ORM and migrations

SQLModel for ORM, Alembic for migrations. SQLModel classes define each entity once; they serve as ORM models for DB writes, response schemas for FastAPI endpoints, and validation schemas for inbound payloads — equivalent to the role Zod currently plays in the TypeScript codebase.

### 6.2 Baseline from the current Postgres

Alembic's baseline is generated by introspecting the current Postgres schema and emitting one revision that creates everything as it stands.

Sequence on a fresh dev database:

```
psql -f the-current-schema-dump.sql              # produces the schema we have today
alembic revision --autogenerate -m "baseline"    # Alembic compares to SQLModel classes; emits the create-everything revision
alembic stamp head                               # records the baseline as already-applied
```

Sequence on an existing Prisma-migrated database:

```
alembic stamp head                                # the schema already matches; just record the baseline
```

From here, every schema change is `alembic revision --autogenerate` against the SQLModel classes. The pre-existing Prisma migration log is discarded at cutover (PR 8, §8). Git history retains the migration files for reference.

### 6.3 FTS columns and triggers

The current Postgres schema has `tsvector` columns and triggers (`prisma/migrations/20260520000000_search_fts_columns/migration.sql`). Alembic's `--autogenerate` can be unreliable about reproducing these; the baseline revision hand-includes the column definitions and the trigger create statements in `op.execute(...)` blocks to be sure they survive. One-off carefulness, low ongoing cost; future FTS changes follow the same `op.execute` pattern.

### 6.4 Repository layer

`backend/app/repositories/` holds query helpers, one module per entity type. Each function takes an `AsyncSession` and returns SQLModel instances. The current TypeScript helpers in `src/lib/portal-data.ts` map one-to-one to functions in these modules. The FastAPI router thin-wraps these calls and returns the results; Pydantic handles JSON serialisation automatically.

## 7. API surface

### 7.1 Read-path endpoints

Direct mapping from current `portal-data.ts` helpers to FastAPI routes. Phase 1 of the rewrite delivers the read path only; the write path follows in a later increment.

| Today (`portal-data.ts`) | Tomorrow (FastAPI) |
|---|---|
| `getMatrix()` | `GET /api/matrix` |
| `getActivity()` | `GET /api/activity` |
| `getSidebarJurisdictions()` | `GET /api/sidebar/jurisdictions` |
| `getJurisdictionBySlug(slug)` | `GET /api/jurisdictions/{slug}` |
| `getDomainsByJurisdiction(slug)` | `GET /api/jurisdictions/{slug}/domains` |
| `getProductsConsumedBy(slug)` | `GET /api/jurisdictions/{slug}/consumed-products` |
| `getDomainBySlug(slug)` | `GET /api/domains/{slug}` |
| `getProductsForDomain(slug)` | `GET /api/domains/{slug}/products` |
| `getTeamsForDomain(slug)` | `GET /api/domains/{slug}/teams` |
| `getInitiativesForDomain(slug)` | `GET /api/domains/{slug}/initiatives` |
| `getTeamBySlug(slug)` | `GET /api/teams/{slug}` |
| `getProductsForTeam(slug)` | `GET /api/teams/{slug}/products` |
| `getProductBySlug(slug)` | `GET /api/products/{slug}` |
| `getInitiativesForProduct(id)` | `GET /api/products/{slug}/initiatives` |
| (existing) `/api/search` | `GET /api/search?q=...` |
| (existing) `/api/answer-card` | `POST /api/answer-card` |
| (existing) `/healthz` | `GET /api/health` |

### 7.2 Write-path endpoints (deferred to a later increment)

The write path — markdown upload, AI parse, approvals queue, publish — is a larger surface that brings AOAI integration, audit-log append-only writes, and approval state machine concerns. It is intentionally not part of the first rewrite increment so that the read-path rewrite can land and demos can be served from the new stack while the write path is being ported.

### 7.3 Error categories

Two response categories, mirroring the current TypeScript pattern:

| HTTP | Meaning | Body |
|---|---|---|
| 2xx | Success | Resource as JSON (Pydantic-serialised SQLModel) |
| 404 | Slug not found / entity unknown | `{ error: "not_found", detail: "..." }` |
| 4xx (other) | Validation failure | `{ error: "validation", detail: <Pydantic validation error structure> }` |
| 5xx | Upstream failure or unexpected | `{ error: "server_error", detail: "..." }` — caught by the global FastAPI exception handler; the React error boundary renders the degraded state per ADR-011 |

## 8. Migration / cutover from the current state

### 8.1 What carries over without modification

- The Postgres schema (tables, indexes, FTS columns and triggers)
- The React UI (components, theme tokens, Tailwind config, Radix usage, Vitest setup) — moves from `src/` to `frontend/` unchanged
- The Next.js framework choice (App Router, RSC, standalone output)
- The Playwright E2E suite (selectors and flows survive; only the data-fetching underneath changes)
- The seed content (Initiative descriptions, fictional `example.com` outbound URLs, all current authored data) — migrates to a Python seed script that performs the same upserts
- The `docs/` directory (specs, ADRs, plans) — new entries are added; existing entries that are superseded stay in place marked as superseded

### 8.2 What is deleted at cutover

- `prisma/schema.prisma` and `prisma/migrations/` — entirely
- `src/lib/db.ts` — Prisma client setup
- `src/lib/portal-data.ts` and `src/lib/portal-data-seed.ts` — replaced by `api-client` calls; the seed-fallback logic becomes Python repository code
- `src/lib/entities.ts` — Zod schemas replaced by generated TypeScript types from OpenAPI
- `src/app/api/*` route handlers — every one moves to `backend/app/api/*`
- Prisma-related dependencies from `frontend/package.json`

### 8.3 ADR impact

| ADR | Change |
|---|---|
| ADR-001 (web framework) | Superseded for the server framework choice. Next.js retains the role of frontend framework only; the server-side application is FastAPI. A new ADR ratifies the split. |
| ADR-002 (content store + ORM) | Postgres choice stands. Prisma is superseded by SQLModel + Alembic. A new ADR ratifies the change. |
| ADR-005 (authentication) | Microsoft Entra ID remains the identity provider. Easy Auth is replaced by whatever mechanism the K8s landing zone provides; the application-side pattern (trust identity headers from the platform edge) is unchanged. |
| ADR-006 (hosting) | Superseded. Hosting is Kubernetes on the HMCTS-DTS landing zone; App Service is no longer the target. A new ADR ratifies the change. |
| ADR-008 (platform services) | Mostly superseded. Front Door is replaced by the cluster's ingress controller. Key Vault, Log Analytics, and Application Insights remain. A new ADR ratifies the changes; secrets resolution moves from App Service managed identity to Workload Identity. |
| ADR-009 (repo topology) | Stands. The app repo gains a `backend/` directory but the public-app + internal-infra split remains. |
| ADR-010 (deploy pipeline) | Out of scope for this design — CI/CD shape is being specced separately. ADR-010 is not yet superseded. |

The new ADRs (012 onward — exact numbering chosen when they are written) sit in `docs/decisions/` alongside the existing ones. The superseded ADRs are not deleted; they are annotated at the top with their successor and remain in the directory as historical record.

### 8.4 Sequencing

The rewrite lands as a sequence of stacked PRs against `main`, each preserving working state. The current Next.js stack stays runnable for demos until the cutover PR (PR 8) lands.

| PR | Scope | Working state after |
|----|-------|---------------------|
| 1 | Monorepo scaffolding. Move `src/` to `frontend/`; adjust `package.json` paths, lockfile, CI workflow paths; relocate `docker-compose.yml` and root configs. | Demo still runs from `frontend/` via `pnpm dev`. |
| 2 | Backend scaffolding. Add `backend/` with FastAPI hello-world and `/api/health`. Root `docker-compose.yml` brings up database + backend + frontend; the frontend does not yet call the backend. | All three containers come up; backend serves only its health route. |
| 3 | Alembic baseline. Generate baseline revision from the current Postgres schema; commit the migration file; document the one-time `alembic stamp head` for existing dev databases. | Backend can run migrations cleanly against a fresh database. |
| 4 | SQLModel models + read-path repositories. All entity types defined; no routers yet. Pytest covers the repository layer end-to-end against a service Postgres in CI. | Backend has a tested data layer; no public surface yet. |
| 5 | Read-path routers and OpenAPI exposure. Every endpoint from §7.1 implemented. `frontend/scripts/generate-api.ts` runs in CI; the gitignored client is regenerated on every build. | Backend serves the full read path; OpenAPI is the contract. |
| 6 | Caddy + supervisord on the frontend container. Multi-stage Dockerfile. Frontend calls `/api/health` through Caddy to the backend; first end-to-end smoke. | Frontend and backend talk through the runtime topology described in §5.2. |
| 7 | Page-by-page port (likely 3-5 PRs grouping pages logically — home + sidebar; jurisdiction; domain; team; product). Each PR swaps `portal-data` calls to `api-client` for one page bundle, deletes the matching `portal-data` helpers, keeps Vitest and Playwright green. | The new stack reaches feature parity for the read path one page bundle at a time. |
| 8 | Cutover. Delete `prisma/`, `src/lib/portal-data*.ts`, `src/lib/entities.ts`, Prisma dependencies. | The rewrite is feature-parity for the read path; old code is gone. |
| 9 | Write-path port. Upload → AI parse → approvals → publish, treated as its own slice because of the larger surface and AOAI integration. | Full parity with the pre-rewrite stack. |

### 8.5 Cutover criteria

The deletion in PR 8 requires three green signals:

- Existing Vitest unit tests pass against the rewritten data layer
- Existing Playwright E2E tests pass via `docker-compose up`
- A manual walk-through of every entity page renders identically against the new stack

### 8.6 Demo continuity

Until PR 8 lands, `main` runs as the current Next.js stack — `pnpm demo` produces the same demo it does today. From PR 8 onward, `main` runs as the rewrite — same UI from the user's point of view, different innards; demos are served via `docker-compose up`. The infrastructure work to actually deploy on K8s tracks separately; until then, demos remain local-only.

## 9. Out of scope for this design

These items are deliberately not pinned down in this document and will be specced separately when their dependencies resolve.

| Item | Why deferred |
|---|---|
| **CI/CD shape on the new stack** | Pipeline design depends on landing-zone-specific image-registry, identity, and dispatch mechanisms. Specced separately once those are known. ADR-010 is not yet superseded. |
| **K8s manifests / Helm chart / Kustomize choice** | The landing zone may prescribe one. The deployment shape in §5.2 + §3.3 is abstract over the choice; the concrete manifests follow when PlatOps's specifics are available. |
| **Concrete auth mechanism on K8s** | oauth2-proxy / ingress-OIDC / a landing-zone-provided sidecar are all plausible. The application-side pattern (trust identity headers from the platform edge) is independent of the choice. |
| **Image registry and tag conventions** | Probably `hmctsprod.azurecr.io` as per existing ADRs, but the landing zone may have its own. |
| **Infra repository plan revision** | The Phase 1 infra plan (App-Service-shaped) is superseded. A new plan against the K8s shape follows once the landing zone is known. |
| **Write-path rewrite** | Bigger surface than the read path; sequenced after PR 8 to keep each increment reviewable. |
| **Polyrepo split timing** | The monorepo is shaped to be split later; the actual split is deferred to a separate decision when it has a real trigger. |

## 10. Open questions for HMCTS-DTS PlatOps

Resolutions to these unblock the items in §9.

| Question | Affects |
|---|---|
| Which auth mechanism does the landing zone provide? oauth2-proxy in front of each Service? An ingress-controller OIDC integration? A namespace-level sidecar? | Concrete shape of `frontend/proxy.ts` and `backend/app/auth/identity.py`. |
| Which image registry? `hmctsprod.azurecr.io`, a landing-zone-provided ACR, or something else? | The CI/CD spec; the K8s `imagePullSecrets` shape. |
| Which K8s manifest tooling is supported / preferred? Helm? Kustomize? A custom abstraction? | The infra repository's layout for K8s artefacts. |
| Which ingress controller is in the landing zone? ingress-nginx? Traefik? An Azure-native option? | Ingress manifests; potentially the auth integration too. |
| How does the landing zone surface secrets? External Secrets Operator → Key Vault? CSI driver? Workload Identity directly? | Backend's secret resolution layer; Helm chart shape. |
| What's the observability ingestion path? Application Insights with Workload Identity? Open Telemetry to a cluster collector? | Backend's instrumentation library; configuration shape. |

## 11. Boundaries (what does and does not change)

To keep reviewers oriented, in one place:

| Stays the same | Changes |
|---|---|
| The product, the data model, the markdown-canonical authoring loop | The server runtime: Node → Python |
| Postgres as the content store | The ORM: Prisma → SQLModel + Alembic |
| The Next.js framework for the React UI | The relationship: Next.js no longer hosts the API |
| The React UI work shipped through Phase 1 | The data-fetching layer underneath each page |
| Tailwind, Radix, Vitest, Playwright, the visual language | The build/serve pipeline of the frontend container (multi-stage + supervisord) |
| Azure Postgres Flexible Server, Azure OpenAI, Azure Key Vault as the platform services | The hosting target: App Service → Kubernetes |
| Microsoft Entra ID as the identity provider | The mechanism that gates traffic before it reaches the app: Easy Auth → landing-zone-provided OIDC |
| The repository topology (public app + internal infra) | The app repo gains a `backend/` directory |
| The TDD contract, the coverage gates, the public-repo posture | The toolchain on the Python half: ruff, pytest, uv |

## 12. Self-review checklist for this document

| Check | Result |
|---|---|
| Placeholder scan (TBD / TODO / incomplete sections) | None — every section either has content or is explicitly listed in §9 as deferred with a stated reason |
| Internal consistency (architecture vs feature descriptions) | Architecture in §3-§5 matches the API surface in §7 and the cutover plan in §8 |
| Scope check (focused enough for a single implementation plan) | Yes for the read-path rewrite; the write-path rewrite (§7.2) and the infra repository revision (§9) are explicitly out of scope and will get their own plans |
| Ambiguity check (could any requirement be read two ways?) | The concrete auth mechanism and the K8s manifest tooling are deferred deliberately and §10 lists them as open questions. No requirement in the design relies on a specific resolution. |
| Public-repo safety | No internal hostnames, no stakeholder names, no real PII, no secrets, no specific configuration values lifted from internal sources. Reference patterns are described structurally; cross-references to other HMCTS-DTS repositories use only the public coordinate that already appears in earlier public ADRs. |
