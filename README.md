# DTS Portfolio Portal

A high-level, single-front-door view of delivery information across DTS in HMCTS — products, teams, roadmaps — without replacing the source-of-truth tools beneath (Ardoq, Jira, Confluence, SharePoint, Miro).

## Status

**Phase 1 — Scaffold.** Stack is locked (see ADRs in [docs/decisions/](docs/decisions/)); Next.js + Prisma + Postgres + Tailwind + shadcn/ui foundation up and running.

## Where things live

| Document | Purpose |
|---|---|
| [docs/superpowers/specs/2026-05-15-dts-portfolio-portal-design.md](docs/superpowers/specs/2026-05-15-dts-portfolio-portal-design.md) | Requirements spec |
| [docs/superpowers/specs/2026-05-19-azure-stack-design.md](docs/superpowers/specs/2026-05-19-azure-stack-design.md) | Azure stack design (locked decisions) |
| [docs/superpowers/plans/2026-05-15-dts-portfolio-portal.md](docs/superpowers/plans/2026-05-15-dts-portfolio-portal.md) | Phased implementation plan |
| [docs/decisions/](docs/decisions/) | Ten Phase-0 ADRs |
| [docs/prototype/](docs/prototype/) | Standalone HTML prototype (visual reference) — [live preview](https://rawcdn.githack.com/hmcts/dts-portfolio-portal/72438d3f28a64b326c020125ef706ab7a5162f43/docs/prototype/DTS%20Portfolio%20Portal%20-%20standalone.html) |
| [CLAUDE.md](CLAUDE.md) | Engineering standards + how Claude is used here |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributing conventions |

## Audience

- **Leadership** — scans cross-DTS roadmap activity at NOW / NEXT / LATER altitude
- **Delivery teams** — curate their team and products via markdown upload
- **All staff** — find things by name via natural-language search

## Stack at a glance

| Layer | Choice | ADR |
|---|---|---|
| Framework | Next.js (App Router) + React + TypeScript | [001](docs/decisions/2026-05-19-adr-001-web-framework.md) |
| Database | Azure Database for PostgreSQL Flexible Server (Entra-only auth) | [002](docs/decisions/2026-05-19-adr-002-content-store.md) |
| ORM | Prisma 7 + driver-adapter (`@prisma/adapter-pg`) | [002](docs/decisions/2026-05-19-adr-002-content-store.md) |
| AI | Azure OpenAI (structured-output mode + answer-card synthesis) | [003](docs/decisions/2026-05-19-adr-003-ai-parser.md) |
| Search | Postgres full-text search | [004](docs/decisions/2026-05-19-adr-004-search-backend.md) |
| Auth | Easy Auth → Microsoft Entra ID | [005](docs/decisions/2026-05-19-adr-005-authentication.md) |
| Host | App Service for Linux (Web App for Containers) + ACR + Front Door | [006](docs/decisions/2026-05-19-adr-006-hosting.md) |
| UI | Tailwind 4 + shadcn/ui + Lucide + Geist | [007](docs/decisions/2026-05-19-adr-007-visual-language.md) |
| Platform | Key Vault + App Insights + Log Analytics + Front Door (MI-only) | [008](docs/decisions/2026-05-19-adr-008-platform-services.md) |
| Repo topology | Public app (this repo) + internal infra (`-infra` repo) | [009](docs/decisions/2026-05-19-adr-009-repo-topology.md) |
| Deploy | All-GHA with gated cross-repo dispatch | [010](docs/decisions/2026-05-19-adr-010-deploy-pipeline.md) |

## Local development

### Prerequisites

You need these installed before the demo script (or the manual setup below) will run.

| Tool | Minimum | Verify |
|---|---|---|
| **Node.js** | 22.0.0 — pinned in `.nvmrc` and `engines.node` | `node --version` → `v22.x` |
| **pnpm** | 10.0.0 — pinned via `packageManager` (`pnpm@10.4.1`) | `pnpm --version` |
| **Docker** | any recent — Desktop, OrbStack, or Colima all work | `docker info` must succeed |
| **Disk** | ~1.5 GB free for `node_modules` (~500 MB) + Postgres image (~250 MB) + Next/Playwright caches | |
| **Ports** | `3000` (dev server) and `5432` (Postgres) must be free | `lsof -i :3000`, `lsof -i :5432` |

Optional helpers:

- **`nvm` / `fnm` / `volta`** — pick up the `.nvmrc` automatically: `nvm use` or `fnm use`
- **`corepack`** — ships with Node 22 and provisions the right pnpm version on first use: `corepack enable`
- **`direnv`** — picks up the project-level `.envrc` automatically when you `cd` into the repo (the file is gitignored; it pins `DATABASE_URL` to the local container and unsets any inherited secrets)

OS support: macOS (Apple Silicon and Intel) and Linux are both routinely used. Windows works through WSL2 — run all commands inside the WSL shell, not PowerShell.

### Quick start

```bash
make install                          # installs both halves
docker compose up -d database         # bring up Postgres
make backend-migrate                  # apply migrations (creates schema)
make up                               # bring up all containers
```

Open <http://localhost:3000>.

> **Note:** `make backend-migrate` (Alembic) becomes functional once the Python backend lands (Group B of the restack). Until then, use `cd frontend && pnpm db:migrate:deploy` to apply the Prisma migrations.

### Working on one half

| Half | Command | What it runs |
|---|---|---|
| Frontend | `cd frontend && pnpm dev` | Next.js dev server on :3000 |
| Backend | `cd backend && uv run uvicorn app.main:app --reload --port 8000` | FastAPI dev server on :8000 (available once Group B lands) |
| Frontend (demo) | `cd frontend && pnpm demo` | One-shot bring-up — Postgres + migrations + seed + dev server. See [`scripts/demo.sh`](scripts/demo.sh) |

### Setup (manual)

If you'd rather run the steps yourself without `make`:

```bash
# Install dependencies
cd frontend && pnpm install --frozen-lockfile && cd ..

# Copy the example env and adjust if needed
cp .env.example .env.local

# Start Postgres in the background
docker compose up -d database

# Apply Prisma migrations (creates the schema in the local DB)
cd frontend && pnpm db:migrate:deploy

# Boot the Next.js dev server with HMR
cd frontend && pnpm dev
```

Open <http://localhost:3000>. The `/healthz` endpoint should return `{"status":"ok"}`.

### Optional: pgAdmin

```bash
docker compose --profile tools up -d pgadmin
# pgAdmin on http://localhost:5050  (login: dev@portal.local / portal)
```

### Optional: run in a container locally

```bash
docker compose --profile app up --build
```

Runs the production image instead of `pnpm dev`. Same image App Service runs in prod.

## Day-to-day commands

### Aggregate (both halves)

| Command | What it does |
|---|---|
| `make install` | Install all dependencies (frontend + backend) |
| `make test` | Run all tests (frontend Vitest + backend pytest) |
| `make lint` | Lint all code (frontend ESLint + backend Ruff) |
| `make up` | Start all containers via Docker Compose |
| `make down` | Stop all containers |
| `make logs` | Tail Docker Compose logs |

### Frontend (Next.js)

| Command | What it does |
|---|---|
| `cd frontend && pnpm demo` | One-shot local bring-up — Postgres + migrations + seed + dev server. See [`scripts/demo.sh`](scripts/demo.sh) |
| `cd frontend && pnpm dev` | Next.js dev server with HMR on :3000 |
| `make frontend-build` | Production build (Next standalone output) |
| `make frontend-typecheck` | `tsc --noEmit` on the whole project |
| `make frontend-lint` | ESLint (via `next lint`) |
| `make frontend-test` | Vitest unit + component tests |
| `cd frontend && pnpm test:watch` | Vitest in watch mode |
| `cd frontend && pnpm test:e2e` | Playwright end-to-end + axe a11y |
| `cd frontend && pnpm format` | Prettier write |
| `cd frontend && pnpm db:migrate:dev --name <slug>` | Create + apply a new Prisma migration |
| `cd frontend && pnpm db:migrate:deploy` | Apply pending Prisma migrations (production-safe) |
| `cd frontend && pnpm db:seed` | Idempotent upsert seed data (Prisma-backed; stays until Group D cutover) |
| `cd frontend && pnpm db:studio` | Prisma Studio (browse the DB in the browser) |

### Backend (Python — available once Group B lands)

| Command | What it does |
|---|---|
| `make backend-migrate` | Apply Alembic migrations (`alembic upgrade head`) |
| `make backend-test` | pytest |
| `make backend-lint` | Ruff check + format check |
| `cd backend && uv run alembic current` | Show current Alembic migration state |

## Architecture in one paragraph

The portal is a Next.js (App Router) application running on Azure App Service for Linux as a single container image (pulled from HMCTS ACR). Microsoft Entra ID authenticates users at the platform edge via Easy Auth; the app reads the `X-MS-CLIENT-PRINCIPAL` header rather than running an OIDC client. Entities (Jurisdictions, Domains, Teams, Products, Initiatives) live in Azure Database for PostgreSQL Flexible Server, accessed through Prisma with `@prisma/adapter-pg`. The append-only audit log in the same database stores every markdown upload, its AI parse output, and approval metadata. Azure OpenAI handles markdown parsing (Phase 2) and search answer-card synthesis (Phase 3); Postgres FTS handles the ranked-results side of search. Secrets live in Azure Key Vault, accessed via App Service user-assigned managed identity — no keys in code or env. Azure Front Door sits in front of App Service for CDN + WAF; Application Insights handles observability.

The Terraform that provisions all of this lives in a sibling repo, `hmcts/dts-portfolio-portal-infra`. Deploys are triggered by CI in this repo emitting a `deploy-<env>-<version>-<runid>` tag, with a cross-repo dispatch firing into the infra repo's `deploy-<env>.yml` workflow once the `INFRA_DISPATCH_ENABLED` repo variable is flipped on.

## Licence

See [LICENSE](LICENSE).
