# Python + Kubernetes Restack — Read-Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-platform the portal's read-path to a Python FastAPI backend on a monorepo shape (`backend/` + `frontend/`), with the existing Next.js UI as the frontend, while preserving demo continuity. Implements the design at `docs/superpowers/specs/2026-05-21-python-k8s-restack-design.md`.

**Architecture:** Two containers in one repo. Backend: FastAPI + SQLModel + Alembic, Postgres unchanged, baselined from the current schema. Frontend: Next.js retained, served from its own container via Caddy + supervisord, calling the backend through a `/api/*` reverse-proxy bridge. Typed across the boundary via OpenAPI codegen.

**Tech Stack:** Python 3.12+, FastAPI, uvicorn, SQLModel (Pydantic + SQLAlchemy 2.0), Alembic, asyncpg + psycopg2-binary, uv, ruff, pytest + pytest-asyncio + httpx · Next.js 16, pnpm, Caddy, supervisord, Node 24-alpine, openapi-typescript-codegen, Vitest, Playwright.

**Out of scope (deferred to later plans):**
- Write-path rewrite (upload → AI parse → approvals → publish)
- CI/CD shape on the new stack
- K8s manifests (Helm chart / Kustomize)
- Concrete auth mechanism on K8s
- Infrastructure repository revision

---

## File structure overview

```
hmcts/dts-portfolio-portal/                  (public, monorepo)
├── backend/                                 # NEW
│   ├── alembic/versions/                    # one baseline migration
│   ├── alembic.ini, alembic/env.py
│   ├── app/
│   │   ├── main.py                          # FastAPI entrypoint
│   │   ├── settings.py                      # pydantic-settings config
│   │   ├── db.py                            # async engine + session factory
│   │   ├── api/                             # routers (health, matrix, activity, sidebar, jurisdictions, domains, teams, products, search, answer_card)
│   │   ├── models/                          # SQLModel classes (one file per entity)
│   │   ├── repositories/                    # query helpers (one file per entity)
│   │   ├── auth/identity.py                 # FastAPI dep reading identity headers (stub for read-path)
│   │   ├── ai/                              # parser.py, answer_card.py
│   │   └── seed.py                          # idempotent upserts (parity with current frontend/lib/seed.ts)
│   ├── tests/                               # pytest tree
│   ├── pyproject.toml + uv.lock
│   ├── Dockerfile, start.sh, ruff.toml
│   └── .gitignore
│
├── frontend/                                # MOVED from src/
│   ├── app/, components/, lib/, public/, tests/
│   ├── lib/api-client.ts                    # NEW
│   ├── lib/api/generated/                   # NEW, gitignored
│   ├── scripts/generate-api.ts              # NEW
│   ├── Caddyfile, supervisord.conf          # NEW
│   ├── Dockerfile, start.js                 # NEW (multi-stage; standalone bootstrap)
│   ├── package.json, pnpm-lock.yaml         # MOVED
│   ├── next.config.js, tsconfig.json        # MOVED
│   ├── vitest.config.ts, playwright.config.ts
│   └── prisma/                              # MOVED then DELETED at cutover (Task K.3)
│
├── docs/                                    # unchanged
├── docker-compose.yml                       # MODIFIED — add backend service
├── docker-compose.dev.yml                   # NEW — bind-mount overlay
├── Makefile                                 # NEW — coordinates both halves
└── README.md                                # MODIFIED — monorepo entrypoint
```

**Deleted at cutover (Task K.*):**
- `frontend/prisma/` directory in full
- `frontend/lib/db.ts`, `frontend/lib/portal-data.ts`, `frontend/lib/portal-data-seed.ts`, `frontend/lib/entities.ts`
- Every file under `frontend/app/api/` whose handler was ported to `backend/app/api/`
- Prisma packages from `frontend/package.json`

---

## Group A — Monorepo scaffolding (PR 1)

### Task A.1: Move `src/` to `frontend/`

**Files:**
- Move: `src/**` → `frontend/**`
- Move: `public/**` → `frontend/public/**`
- Move: `prisma/**` → `frontend/prisma/**`
- Move: `tests/**` → `frontend/tests/**`
- Move: `package.json`, `pnpm-lock.yaml`, `next.config.js`, `next-env.d.ts`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `postcss.config.mjs`, `.eslintrc*` (any), `tailwind.config*` (if present), `instrumentation.ts` (if present) → `frontend/`

- [ ] **Step 1: Move every frontend file under `frontend/`**

```bash
git mv src frontend/src-tmp                      # temporary holding so the rename is one operation
mkdir -p frontend
mv frontend/src-tmp/* frontend/                  # unpack src/* directly under frontend/
rmdir frontend/src-tmp
git mv public frontend/public
git mv prisma frontend/prisma
git mv tests frontend/tests
for f in package.json pnpm-lock.yaml next.config.js next-env.d.ts tsconfig.json vitest.config.ts playwright.config.ts postcss.config.mjs; do
  [ -f "$f" ] && git mv "$f" frontend/
done
```

- [ ] **Step 2: Update import paths if `@/` aliases need recalibrating**

The `@/*` alias in `tsconfig.json` currently maps to `./src/*`. After the move it should map to `./` (the frontend root):

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Update `frontend/tsconfig.json` to match.

- [ ] **Step 3: Verify the move with a typecheck from the frontend dir**

```bash
cd frontend && pnpm install --frozen-lockfile && pnpm typecheck
```

Expected: clean typecheck, no `Cannot find module '@/...'` errors.

- [ ] **Step 4: Run the unit tests from the frontend dir to confirm nothing broke**

```bash
cd frontend && pnpm test
```

Expected: 199+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(monorepo): move src/ public/ prisma/ tests/ and config to frontend/"
```

### Task A.2: Update root-level CI / workflow paths to point at `frontend/`

**Files:**
- Modify: `.github/workflows/*.yml`

- [ ] **Step 1: Add a `defaults: { run: { working-directory: frontend } }` block at the top of each workflow that runs frontend commands**

For every workflow file under `.github/workflows/` that runs `pnpm install`, `pnpm test`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm db:*`, or `pnpm exec playwright`:

```yaml
defaults:
  run:
    working-directory: frontend
```

Add a `paths` filter so the frontend workflows only run on frontend changes (the inverse keeps backend changes from running frontend tests):

```yaml
on:
  push:
    paths: ['frontend/**', '.github/workflows/<this-file>']
  pull_request:
    paths: ['frontend/**', '.github/workflows/<this-file>']
```

- [ ] **Step 2: For any workflow that uses `actions/cache` keyed on `pnpm-lock.yaml`, update the key**

```yaml
key: pnpm-${{ hashFiles('frontend/pnpm-lock.yaml') }}
```

- [ ] **Step 3: Push a draft PR and watch CI**

```bash
git push -u origin HEAD
gh pr create --draft --title "chore(monorepo): scaffolding step 1" --body "Verifying CI after src/ → frontend/ move"
```

Expected: every required check on the existing main passes against the new paths.

- [ ] **Step 4: Commit any workflow fixes that the draft PR surfaces**

```bash
git add .github/workflows
git commit -m "ci: scope frontend workflows to frontend/** paths"
```

### Task A.3: Add root `.gitignore` entries for the upcoming backend

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append the Python and venv ignores to `/.gitignore`**

```gitignore
# Python (backend/)
backend/__pycache__/
backend/**/__pycache__/
backend/.pytest_cache/
backend/.ruff_cache/
backend/.mypy_cache/
backend/.venv/
backend/htmlcov/
backend/.coverage
backend/coverage.xml

# Generated TypeScript client (do not commit; regenerated each CI run)
frontend/lib/api/generated/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore Python build artefacts and generated API client"
```

### Task A.4: Add root `Makefile` coordinating both halves

**Files:**
- Create: `Makefile`

- [ ] **Step 1: Write the Makefile**

```make
.PHONY: install dev test typecheck lint build clean
.PHONY: backend-install backend-test backend-lint backend-migrate
.PHONY: frontend-install frontend-test frontend-typecheck frontend-lint frontend-build
.PHONY: up down logs

# ---- aggregate ----------------------------------------------------------

install: backend-install frontend-install
test:    backend-test frontend-test
lint:    backend-lint frontend-lint

# ---- backend (Python) ---------------------------------------------------

backend-install:
	cd backend && uv sync --frozen

backend-test:
	cd backend && uv run pytest

backend-lint:
	cd backend && uv run ruff check . && uv run ruff format --check .

backend-migrate:
	cd backend && uv run alembic upgrade head

# ---- frontend (Next.js) -------------------------------------------------

frontend-install:
	cd frontend && pnpm install --frozen-lockfile

frontend-test:
	cd frontend && pnpm test

frontend-typecheck:
	cd frontend && pnpm typecheck

frontend-lint:
	cd frontend && pnpm lint

frontend-build:
	cd frontend && pnpm build

# ---- local dev (docker compose) -----------------------------------------

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f
```

- [ ] **Step 2: Verify the Makefile**

```bash
make frontend-typecheck
```

Expected: clean typecheck. Backend targets will fail until Group B lands; that's fine.

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "chore: top-level Makefile coordinating frontend and backend"
```

### Task A.5: Update root README to reflect the monorepo

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the "Local development" section with monorepo instructions**

The current README runs `pnpm install` and `pnpm dev` at the repo root. After Task A.1 those run inside `frontend/`. Update the Quick-start to:

```markdown
## Local development

### Quick start

```bash
make install                                # installs both halves
docker compose up -d database               # bring up Postgres
make backend-migrate                        # apply migrations (creates schema)
make up                                     # bring up all containers
```

Open http://localhost:3000.

### Working on one half

| Half | Command | What it runs |
|---|---|---|
| Frontend | `cd frontend && pnpm dev` | Next.js dev server on :3000 |
| Backend | `cd backend && uv run uvicorn app.main:app --reload --port 8000` | FastAPI dev server on :8000 |
```

- [ ] **Step 2: Update the "Day-to-day commands" table to reference `make ...` targets**

Replace the `pnpm <command>` rows with `make frontend-<command>` and add the equivalent backend rows.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): reflect monorepo structure and make-based entrypoints"
```

---

## Group B — Backend scaffolding (PR 2)

### Task B.1: Initialise `backend/` with `pyproject.toml` and uv lockfile

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.python-version`
- Create: `backend/ruff.toml`
- Create: `backend/.gitignore`
- Generates: `backend/uv.lock`

- [ ] **Step 1: Create `backend/.python-version`**

```
3.12
```

- [ ] **Step 2: Create `backend/pyproject.toml`**

```toml
[project]
name = "dts-portfolio-portal-backend"
version = "0.1.0"
description = "FastAPI service for the DTS Portfolio Portal — read-path"
requires-python = ">=3.12,<3.14"
dependencies = [
    "fastapi[standard]>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sqlmodel>=0.0.22",
    "sqlalchemy>=2.0.36",
    "asyncpg>=0.30.0",
    "psycopg2-binary>=2.9.10",
    "alembic>=1.14.0",
    "pydantic-settings>=2.6.0",
    "httpx>=0.27.0",
    "openai>=1.55.0",
    "python-multipart>=0.0.18",
]

[dependency-groups]
test = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=6.0.0",
    "httpx>=0.27.0",
]
dev = [
    "ruff>=0.8.0",
    "mypy>=1.13.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 3: Create `backend/ruff.toml`**

```toml
target-version = "py312"
line-length = 100

[lint]
select = ["E", "F", "W", "I", "B", "UP", "S", "A", "C4", "T20", "PT", "SIM"]
ignore = ["S101"]  # pytest's `assert` is fine in tests

[lint.per-file-ignores]
"tests/**/*.py" = ["S105", "S106"]  # hardcoded test fixtures
```

- [ ] **Step 4: Create `backend/.gitignore`**

```gitignore
__pycache__/
*.py[cod]
.pytest_cache/
.ruff_cache/
.mypy_cache/
.venv/
.coverage
coverage.xml
htmlcov/
*.egg-info/
build/
dist/
```

- [ ] **Step 5: Generate the lockfile**

```bash
cd backend && uv sync
```

Expected: `uv.lock` created. `.venv/` populated (and gitignored).

- [ ] **Step 6: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/.python-version backend/ruff.toml backend/.gitignore
git commit -m "feat(backend): scaffold pyproject.toml, ruff config, gitignore"
```

### Task B.2: Add the FastAPI app entrypoint with `/api/health`

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/settings.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/health.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Write the failing test for `/api/health`**

Create `backend/tests/conftest.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

Create `backend/tests/test_health.py`:

```python
async def test_health_returns_ok(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run to verify the test fails**

```bash
cd backend && uv run pytest tests/test_health.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.main'` or similar.

- [ ] **Step 3: Implement the minimum to pass**

Create `backend/app/__init__.py`:

```python
# empty marker
```

Create `backend/app/settings.py`:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://portal:portal@localhost:5432/portal"
    app_version: str = "dev"
    log_level: str = "INFO"


settings = Settings()
```

Create `backend/app/api/__init__.py` (empty).

Create `backend/app/api/health.py`:

```python
from fastapi import APIRouter

from app.settings import settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/version")
async def health_version() -> dict[str, str]:
    return {"status": "ok", "version": settings.app_version}
```

Create `backend/app/main.py`:

```python
from fastapi import FastAPI

from app.api import health

app = FastAPI(
    title="DTS Portfolio Portal API",
    description="Read-path API for the DTS Portfolio Portal",
    version="0.1.0",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url=None,
)

app.include_router(health.router)
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && uv run pytest tests/test_health.py -v
```

Expected: `test_health_returns_ok PASSED`.

- [ ] **Step 5: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat(backend): FastAPI app entrypoint + /api/health endpoint"
```

### Task B.3: Add the async DB engine and session factory

**Files:**
- Create: `backend/app/db.py`
- Create: `backend/tests/test_db.py`

- [ ] **Step 1: Write the failing test that the engine connects**

```python
# backend/tests/test_db.py
import pytest
from sqlalchemy import text

from app.db import async_session_factory


@pytest.mark.skipif(
    "DATABASE_URL" not in __import__("os").environ,
    reason="Requires a live Postgres",
)
async def test_session_connects_to_postgres():
    async with async_session_factory() as session:
        result = await session.execute(text("SELECT 1"))
        assert result.scalar_one() == 1
```

- [ ] **Step 2: Run it (will fail import-side)**

```bash
cd backend && uv run pytest tests/test_db.py -v
```

Expected: `ImportError` on `app.db`.

- [ ] **Step 3: Implement `app/db.py`**

```python
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.settings import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@asynccontextmanager
async def async_session_factory() -> AsyncGenerator[AsyncSession, None]:
    """Context-managed session for ad-hoc use (scripts, tests)."""
    async with async_session_maker() as session:
        yield session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for per-request sessions."""
    async with async_session_maker() as session:
        yield session
```

- [ ] **Step 4: Run the test against a live Postgres**

```bash
cd backend && DATABASE_URL="postgresql+asyncpg://portal:portal@localhost:5432/portal" uv run pytest tests/test_db.py -v
```

Expected: `test_session_connects_to_postgres PASSED` (assumes the docker-compose database service is running from Task B.6).

- [ ] **Step 5: Commit**

```bash
git add backend/app/db.py backend/tests/test_db.py
git commit -m "feat(backend): async SQLAlchemy engine + session factory"
```

### Task B.4: Add the backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/start.sh`

- [ ] **Step 1: Write `backend/start.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Apply migrations before starting the API. Idempotent — already-applied
# revisions are no-ops.
uv run alembic upgrade head

# Boot uvicorn. --proxy-headers honours X-Forwarded-* from the upstream
# Caddy / ingress so the app sees the original client info.
exec uv run uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --proxy-headers \
    --forwarded-allow-ips "*"
```

- [ ] **Step 2: Write `backend/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM python:3.12-slim-bookworm AS base

ARG VERSION=dev
ENV APP_VERSION=${VERSION} \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# uv binary, pinned image
COPY --from=ghcr.io/astral-sh/uv:0.5.4 /uv /usr/local/bin/uv

WORKDIR /app

# Dependency layer first so source changes don't bust the cache.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache --no-dev --no-group test

COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY start.sh ./
RUN chmod +x start.sh

# Non-root user; uv's venv lives at /app/.venv and is owned by root after the
# sync above. Chown to the runtime user.
RUN useradd --create-home --uid 10001 --shell /bin/bash appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

CMD ["./start.sh"]
```

- [ ] **Step 3: Build the image locally to verify**

```bash
cd backend && docker build -t portal-backend:dev .
```

Expected: successful build, ~200 MB image.

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/start.sh
git commit -m "feat(backend): Dockerfile (python:3.12-slim + uv) and start.sh"
```

### Task B.5: Wire the backend into `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add the backend service alongside the existing database service**

The current compose file likely has just the `database` service. Add `backend` after it. Use a project-scoped env var name for the backend URL — `PORTAL_BACKEND_URL` is generic and signals that the value is just "where to reach the backend" rather than mirroring any other team's internal naming.

```yaml
services:
  database:
    # ...existing config unchanged...

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        VERSION: dev
    environment:
      DATABASE_URL: postgresql+asyncpg://portal:portal@database:5432/portal
      LOG_LEVEL: INFO
      APP_VERSION: dev
    ports:
      - "8000:8000"
    depends_on:
      database:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped
```

- [ ] **Step 2: Bring it up and verify**

```bash
docker compose up -d database backend
sleep 5
curl -s http://localhost:8000/api/health
```

Expected: `{"status":"ok"}`.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(compose): add backend service (FastAPI on :8000)"
```

### Task B.6: Add `docker-compose.dev.yml` overlay for bind-mounted hot-reload

**Files:**
- Create: `docker-compose.dev.yml`

- [ ] **Step 1: Write the overlay**

```yaml
# Overlay for local development: bind-mounts the source dirs and runs the
# dev-mode servers with hot-reload. Apply with:
#   docker compose -f docker-compose.yml -f docker-compose.dev.yml up
services:
  backend:
    command: >
      uv run uvicorn app.main:app
        --host 0.0.0.0 --port 8000
        --reload
        --reload-dir /app/app
    volumes:
      - ./backend/app:/app/app
      - ./backend/alembic:/app/alembic
      - ./backend/alembic.ini:/app/alembic.ini
    environment:
      LOG_LEVEL: DEBUG
```

- [ ] **Step 2: Verify the overlay**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend
# edit a file in backend/app/, watch the container log:
docker compose logs -f backend | head -20
```

Expected: uvicorn reports "Reloading..." on file changes.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.dev.yml
git commit -m "feat(compose): dev overlay with bind-mounted backend for hot-reload"
```

---

## Group C — Alembic baseline (PR 3)

### Task C.1: Initialise Alembic and configure async env

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/.gitkeep`

- [ ] **Step 1: Generate the initial Alembic layout**

```bash
cd backend && uv run alembic init -t async alembic
```

This produces `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, and `alembic/versions/`.

- [ ] **Step 2: Replace `backend/alembic.ini` connection URL with a placeholder**

Open `backend/alembic.ini` and set:

```ini
sqlalchemy.url = driver://user:pass@localhost/dbname
```

Then in `backend/alembic/env.py`, override the URL from settings so we don't store a real URL in `alembic.ini`:

```python
# at the top of backend/alembic/env.py
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel

from alembic import context
from app.settings import settings

# Import every model module so SQLModel.metadata is populated for autogenerate.
# These imports land in Group D. For now, the import is a forward reference;
# the file should still parse with empty models tree.
import app.models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata
```

Leave the `run_migrations_online()` and `run_migrations_offline()` functions as the `init -t async` template generated them — they already use `AsyncEngine`.

- [ ] **Step 3: Create the models package marker (forward reference for Group D)**

Create `backend/app/models/__init__.py`:

```python
# Models are imported here so Alembic's autogenerate picks them up via
# SQLModel.metadata. Each new entity in Group D adds an import.
```

- [ ] **Step 4: Verify alembic CLI works**

```bash
cd backend && uv run alembic current
```

Expected: empty output (no migrations applied yet); no traceback.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic backend/alembic.ini backend/app/models/__init__.py
git commit -m "feat(backend): initialise Alembic with async env, settings-driven URL"
```

### Task C.2: Snapshot the current Postgres schema for the baseline

**Files:**
- Create: `backend/alembic/baseline_dump.sql` (temporary; deleted at end of Task C.3)

**Why a manual dump:** The current schema is owned by Prisma. Until Group D's SQLModel classes exist, Alembic's `--autogenerate` has nothing to compare against. The cleanest baseline is "what's actually in Postgres right now"; we capture that as raw SQL, hand-include it in the first Alembic revision (Task C.3), then `alembic stamp head` against any database already in that state.

- [ ] **Step 1: Bring up a Prisma-migrated database in a clean state**

```bash
docker compose up -d database
cd frontend && pnpm prisma migrate deploy
```

Expected: all Prisma migrations applied; the database is in the canonical schema state.

- [ ] **Step 2: Dump the schema (no data)**

```bash
PGPASSWORD=portal pg_dump \
  --host localhost --port 5432 --username portal \
  --schema-only --no-owner --no-privileges \
  --exclude-schema=information_schema \
  --exclude-schema='pg_*' \
  portal > backend/alembic/baseline_dump.sql
```

Expected: a SQL file of `CREATE TABLE`, `CREATE INDEX`, `CREATE TRIGGER` statements representing the current schema.

- [ ] **Step 3: Sanity-check the dump**

```bash
grep -c "CREATE TABLE" backend/alembic/baseline_dump.sql
grep -c "CREATE INDEX" backend/alembic/baseline_dump.sql
grep -c "CREATE TRIGGER" backend/alembic/baseline_dump.sql
```

Expected: counts roughly matching the entity count (≥9 tables, several indexes, ≥1 trigger for FTS).

- [ ] **Step 4: Commit the dump (temporarily — Task C.3 inlines it then deletes it)**

```bash
git add backend/alembic/baseline_dump.sql
git commit -m "wip(alembic): capture current Prisma-managed schema dump for baselining"
```

### Task C.3: Create the Alembic baseline revision from the dump

**Files:**
- Create: `backend/alembic/versions/20260521_0000_baseline.py`
- Delete: `backend/alembic/baseline_dump.sql`

- [ ] **Step 1: Create an empty revision**

```bash
cd backend && uv run alembic revision -m "baseline" --rev-id 20260521_0000_baseline
```

Edit `backend/alembic/versions/20260521_0000_baseline.py` so the `upgrade()` function executes the SQL from the dump and `downgrade()` is intentionally empty (a baseline has no "back from" state):

```python
"""baseline

Revision ID: 20260521_0000_baseline
Revises:
Create Date: 2026-05-21 12:00:00.000000

The baseline revision is the canonical schema at the cutover from Prisma to
Alembic. It is generated once from a `pg_dump --schema-only` of a Prisma-
migrated database and never modified. Future schema changes are new
revisions on top of this one.
"""

from pathlib import Path

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260521_0000_baseline"
down_revision = None
branch_labels = None
depends_on = None

BASELINE_SQL = Path(__file__).parent.parent / "baseline_dump.sql"


def upgrade() -> None:
    sql = BASELINE_SQL.read_text(encoding="utf-8")
    # Skip set/owner statements that pg_dump emits but Alembic doesn't need.
    cleaned = "\n".join(
        line for line in sql.splitlines()
        if not line.startswith(("SET ", "SELECT pg_catalog.set_config", "--"))
    )
    # Execute statement-by-statement so a single bad line surfaces clearly.
    for stmt in (s.strip() for s in cleaned.split(";")):
        if stmt:
            op.execute(stmt)


def downgrade() -> None:
    # Baseline revisions don't downgrade — there's no prior state to return
    # to. Recreating a fresh database from scratch is the way.
    raise NotImplementedError("baseline revision cannot be downgraded")
```

- [ ] **Step 2: Test the baseline against a fresh database**

```bash
docker compose down -v
docker compose up -d database
sleep 5
cd backend && DATABASE_URL="postgresql+asyncpg://portal:portal@localhost:5432/portal" uv run alembic upgrade head
```

Expected: migration runs without error; running `\d` in `psql` shows all the tables Prisma produced.

- [ ] **Step 3: Verify against a Prisma-migrated database via `alembic stamp head`**

```bash
docker compose down -v
docker compose up -d database
sleep 5
cd frontend && pnpm prisma migrate deploy            # canonical Prisma state
cd ../backend && DATABASE_URL="postgresql+asyncpg://portal:portal@localhost:5432/portal" uv run alembic stamp head
uv run alembic current                                # should print 20260521_0000_baseline (head)
```

Expected: `alembic current` reports the baseline as current; no DDL was executed (stamp marks state, doesn't apply).

- [ ] **Step 4: Refactor — keep the dump file alongside the revision**

The baseline revision reads `baseline_dump.sql` at runtime. Keep it as a committed asset rather than deleting it. Update `.gitignore` if anything else under `alembic/` was being ignored.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/20260521_0000_baseline.py
git commit -m "feat(alembic): baseline revision from current Postgres schema"
```

---

## Group D — SQLModel models (PR 4 part 1)

The models in this group must produce a schema that exactly matches the baseline from Task C.3. The verification step at the end of the group (Task D.8) runs `alembic revision --autogenerate` and asserts an empty diff. Any divergence means a model is wrong and needs fixing.

### Task D.0: pytest DB fixtures (conftest extension)

**Files:**
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Extend `conftest.py` with a transactional DB session fixture**

```python
import os
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import app

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://portal:portal@localhost:5432/portal",
)


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Per-test session wrapped in a transaction that rolls back at the end."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, pool_pre_ping=True)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.connect() as connection:
        async with connection.begin() as transaction:
            async with session_maker(bind=connection) as session:
                yield session
            await transaction.rollback()
    await engine.dispose()


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 2: Run the existing test_health test to confirm no regression**

```bash
cd backend && uv run pytest tests/test_health.py -v
```

Expected: still passes.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "test(backend): per-test transactional db_session fixture"
```

### Task D.1: `Jurisdiction` model

**Files:**
- Create: `backend/app/models/jurisdiction.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/models/__init__.py`
- Create: `backend/tests/models/test_jurisdiction.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/models/test_jurisdiction.py
from sqlalchemy import select

from app.models.jurisdiction import Jurisdiction


async def test_jurisdiction_round_trips(db_session):
    j = Jurisdiction(slug="crime", name="Crime")
    db_session.add(j)
    await db_session.flush()

    result = await db_session.execute(select(Jurisdiction).where(Jurisdiction.slug == "crime"))
    found = result.scalar_one()
    assert found.name == "Crime"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/models/test_jurisdiction.py -v
```

Expected: `ModuleNotFoundError` on `app.models.jurisdiction`.

- [ ] **Step 3: Write the model**

```python
# backend/app/models/jurisdiction.py
from sqlmodel import Field, SQLModel


class Jurisdiction(SQLModel, table=True):
    __tablename__ = "Jurisdiction"  # Prisma keeps PascalCase table names

    id: str = Field(primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: str
```

Update `backend/app/models/__init__.py` to expose it:

```python
from app.models.jurisdiction import Jurisdiction  # noqa: F401
```

- [ ] **Step 4: Run the test against the live DB to confirm pass**

```bash
cd backend && uv run pytest tests/models/test_jurisdiction.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/jurisdiction.py backend/app/models/__init__.py backend/tests/models
git commit -m "feat(backend): Jurisdiction SQLModel"
```

### Task D.2: `ProductDomain` and `StrategicTheme` models

**Files:**
- Create: `backend/app/models/product_domain.py`
- Create: `backend/app/models/strategic_theme.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/models/test_product_domain.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/models/test_product_domain.py
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.jurisdiction import Jurisdiction
from app.models.product_domain import ProductDomain
from app.models.strategic_theme import StrategicTheme


async def test_product_domain_with_themes(db_session):
    j = Jurisdiction(id="j1", slug="crime", name="Crime")
    db_session.add(j)
    await db_session.flush()

    d = ProductDomain(
        id="d1",
        slug="common-platform",
        name="Common Platform Domain",
        jurisdiction_id=j.id,
        description="Shared services across Crime.",
    )
    db_session.add(d)
    await db_session.flush()

    t = StrategicTheme(id="t1", domain_id=d.id, position=1, title="Reduce sprawl")
    db_session.add(t)
    await db_session.flush()

    result = await db_session.execute(
        select(ProductDomain)
        .where(ProductDomain.slug == "common-platform")
        .options(selectinload(ProductDomain.strategic_themes)),
    )
    found = result.scalar_one()
    assert found.name == "Common Platform Domain"
    assert len(found.strategic_themes) == 1
    assert found.strategic_themes[0].title == "Reduce sprawl"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/models/test_product_domain.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Write the models**

```python
# backend/app/models/strategic_theme.py
from sqlmodel import Field, SQLModel


class StrategicTheme(SQLModel, table=True):
    __tablename__ = "StrategicTheme"

    id: str = Field(primary_key=True)
    domain_id: str = Field(foreign_key="ProductDomain.id", index=True)
    position: int
    title: str
    description: str | None = None
```

```python
# backend/app/models/product_domain.py
from sqlmodel import Field, Relationship, SQLModel

from app.models.strategic_theme import StrategicTheme


class ProductDomain(SQLModel, table=True):
    __tablename__ = "ProductDomain"

    id: str = Field(primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: str
    jurisdiction_id: str = Field(foreign_key="Jurisdiction.id", index=True)
    description: str | None = None
    strategic_owner: str | None = None

    strategic_themes: list[StrategicTheme] = Relationship(
        sa_relationship_kwargs={"lazy": "selectin", "order_by": "StrategicTheme.position"},
    )
```

Update `backend/app/models/__init__.py`:

```python
from app.models.jurisdiction import Jurisdiction  # noqa: F401
from app.models.product_domain import ProductDomain  # noqa: F401
from app.models.strategic_theme import StrategicTheme  # noqa: F401
```

- [ ] **Step 4: Run the test**

```bash
cd backend && uv run pytest tests/models/test_product_domain.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models backend/tests/models
git commit -m "feat(backend): ProductDomain + StrategicTheme SQLModels"
```

### Task D.3: `Team` model

**Files:**
- Create: `backend/app/models/team.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/models/test_team.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/models/test_team.py
from sqlalchemy import select

from app.models.jurisdiction import Jurisdiction
from app.models.product_domain import ProductDomain
from app.models.team import Team


async def test_team_belongs_to_domain(db_session):
    j = Jurisdiction(id="j1", slug="crime", name="Crime")
    d = ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id=j.id)
    db_session.add_all([j, d])
    await db_session.flush()

    t = Team(
        id="t1",
        slug="common-platform-core",
        name="Common Platform Core",
        domain_id=d.id,
        description="Owns the shared platform.",
        contact="common-platform-core@example.com",
    )
    db_session.add(t)
    await db_session.flush()

    result = await db_session.execute(select(Team).where(Team.slug == "common-platform-core"))
    found = result.scalar_one()
    assert found.name == "Common Platform Core"
    assert found.contact == "common-platform-core@example.com"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/models/test_team.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Write the model**

```python
# backend/app/models/team.py
from sqlmodel import Field, SQLModel


class Team(SQLModel, table=True):
    __tablename__ = "Team"

    id: str = Field(primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: str
    domain_id: str = Field(foreign_key="ProductDomain.id", index=True)
    description: str | None = None
    contact: str | None = None
```

Update `backend/app/models/__init__.py`:

```python
from app.models.team import Team  # noqa: F401
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/models/test_team.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/team.py backend/app/models/__init__.py backend/tests/models/test_team.py
git commit -m "feat(backend): Team SQLModel"
```

### Task D.4: `Product` and `OutboundLink` models

**Files:**
- Create: `backend/app/models/product.py`
- Create: `backend/app/models/outbound_link.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/models/test_product.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/models/test_product.py
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.jurisdiction import Jurisdiction
from app.models.outbound_link import OutboundLink
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team


async def test_product_with_outbound_links(db_session):
    j = Jurisdiction(id="j1", slug="crime", name="Crime")
    d = ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id=j.id)
    t = Team(id="t1", slug="cp-core", name="CP Core", domain_id=d.id)
    db_session.add_all([j, d, t])
    await db_session.flush()

    p = Product(
        id="p1",
        slug="sign-in",
        name="Sign In",
        domain_id=d.id,
        operating_team_id=t.id,
        stage="LIVE",
        consumed_by=["crime", "civil"],
        description="Identity broker for Crime services.",
    )
    db_session.add(p)
    await db_session.flush()
    db_session.add(OutboundLink(id="l1", product_id=p.id, label="Confluence", url="https://example.com/confluence"))
    await db_session.flush()

    result = await db_session.execute(
        select(Product).where(Product.slug == "sign-in").options(selectinload(Product.outbound_links)),
    )
    found = result.scalar_one()
    assert found.consumed_by == ["crime", "civil"]
    assert len(found.outbound_links) == 1
    assert found.outbound_links[0].url == "https://example.com/confluence"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/models/test_product.py -v
```

- [ ] **Step 3: Write the models**

```python
# backend/app/models/outbound_link.py
from sqlmodel import Field, SQLModel


class OutboundLink(SQLModel, table=True):
    __tablename__ = "OutboundLink"

    id: str = Field(primary_key=True)
    product_id: str = Field(foreign_key="Product.id", index=True)
    label: str
    url: str
```

```python
# backend/app/models/product.py
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import ARRAY
from sqlmodel import Field, Relationship, SQLModel, String

from app.models.outbound_link import OutboundLink


class Product(SQLModel, table=True):
    __tablename__ = "Product"

    id: str = Field(primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: str
    domain_id: str = Field(foreign_key="ProductDomain.id", index=True)
    operating_team_id: str | None = Field(default=None, foreign_key="Team.id", index=True)
    description: str | None = None
    stage: str = Field(default="LIVE")
    consumed_by: list[str] = Field(default_factory=list, sa_column=Column(ARRAY(String)))

    outbound_links: list[OutboundLink] = Relationship(
        sa_relationship_kwargs={"lazy": "selectin"},
    )
```

Update `backend/app/models/__init__.py`:

```python
from app.models.outbound_link import OutboundLink  # noqa: F401
from app.models.product import Product  # noqa: F401
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/models/test_product.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models backend/tests/models/test_product.py
git commit -m "feat(backend): Product + OutboundLink SQLModels with consumed_by array"
```

### Task D.5: `Initiative` model

**Files:**
- Create: `backend/app/models/initiative.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/models/test_initiative.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/models/test_initiative.py
from sqlalchemy import select

from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain


async def test_initiative_belongs_to_product(db_session):
    j = Jurisdiction(id="j1", slug="crime", name="Crime")
    d = ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id=j.id)
    p = Product(id="p1", slug="sign-in", name="Sign In", domain_id=d.id, stage="LIVE")
    db_session.add_all([j, d, p])
    await db_session.flush()

    i = Initiative(
        id="i1",
        product_id=p.id,
        bucket="NOW",
        title="Sign-in latency reduction",
        description="Sub-700ms p95 across Crime services.",
        outbound_url="https://tickets.example.com/browse/IDAM-1248",
        position=1,
    )
    db_session.add(i)
    await db_session.flush()

    result = await db_session.execute(select(Initiative).where(Initiative.product_id == p.id))
    found = result.scalar_one()
    assert found.title == "Sign-in latency reduction"
    assert found.bucket == "NOW"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/models/test_initiative.py -v
```

- [ ] **Step 3: Write the model**

```python
# backend/app/models/initiative.py
from sqlmodel import Field, SQLModel


class Initiative(SQLModel, table=True):
    __tablename__ = "Initiative"

    id: str = Field(primary_key=True)
    product_id: str = Field(foreign_key="Product.id", index=True)
    bucket: str  # "NOW" | "NEXT" | "LATER"
    title: str
    description: str | None = None
    outbound_url: str | None = None
    position: int = Field(default=0)
```

Update `backend/app/models/__init__.py`:

```python
from app.models.initiative import Initiative  # noqa: F401
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/models/test_initiative.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/initiative.py backend/app/models/__init__.py backend/tests/models/test_initiative.py
git commit -m "feat(backend): Initiative SQLModel"
```

### Task D.6: `ActivityEntry` model

**Files:**
- Create: `backend/app/models/activity_entry.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/models/test_activity_entry.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/models/test_activity_entry.py
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.activity_entry import ActivityEntry


async def test_activity_entry_round_trip(db_session):
    e = ActivityEntry(
        id="a1",
        subject="Common Platform",
        subject_href="/p/common-platform",
        description="Added Java 21 upgrade chip to NOW.",
        kind="roadmap-update",
        approver="Priya Shah",
        approved_at=datetime(2026, 5, 17, 9, 14, tzinfo=timezone.utc),
    )
    db_session.add(e)
    await db_session.flush()

    result = await db_session.execute(select(ActivityEntry).where(ActivityEntry.id == "a1"))
    found = result.scalar_one()
    assert found.subject == "Common Platform"
    assert found.kind == "roadmap-update"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/models/test_activity_entry.py -v
```

- [ ] **Step 3: Write the model**

```python
# backend/app/models/activity_entry.py
from datetime import datetime

from sqlmodel import Field, SQLModel


class ActivityEntry(SQLModel, table=True):
    __tablename__ = "ActivityEntry"

    id: str = Field(primary_key=True)
    subject: str
    subject_href: str
    description: str
    kind: str  # roadmap-update | new-chip | stage-change | theme-update
    approver: str
    approved_at: datetime = Field(index=True)
```

Update `backend/app/models/__init__.py`:

```python
from app.models.activity_entry import ActivityEntry  # noqa: F401
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/models/test_activity_entry.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/activity_entry.py backend/app/models/__init__.py backend/tests/models/test_activity_entry.py
git commit -m "feat(backend): ActivityEntry SQLModel"
```

### Task D.7: `AiParseMetric` model

**Files:**
- Create: `backend/app/models/ai_parse_metric.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/models/test_ai_parse_metric.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/models/test_ai_parse_metric.py
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.ai_parse_metric import AiParseMetric


async def test_ai_parse_metric_round_trip(db_session):
    m = AiParseMetric(
        id="m1",
        source="azure-openai",
        model="gpt-4o-mini-test",
        outcome="success",
        prompt_tokens=1200,
        completion_tokens=90,
        total_tokens=1290,
        latency_ms=180,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(m)
    await db_session.flush()

    result = await db_session.execute(select(AiParseMetric).where(AiParseMetric.id == "m1"))
    found = result.scalar_one()
    assert found.total_tokens == 1290
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/models/test_ai_parse_metric.py -v
```

- [ ] **Step 3: Write the model**

```python
# backend/app/models/ai_parse_metric.py
from datetime import datetime

from sqlmodel import Field, SQLModel


class AiParseMetric(SQLModel, table=True):
    __tablename__ = "AiParseMetric"

    id: str = Field(primary_key=True)
    source: str  # e.g. "azure-openai"
    model: str
    outcome: str  # "success" | "failure"
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int = Field(index=True)
    latency_ms: int
    created_at: datetime = Field(index=True)
```

Update `backend/app/models/__init__.py`:

```python
from app.models.ai_parse_metric import AiParseMetric  # noqa: F401
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/models/test_ai_parse_metric.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/ai_parse_metric.py backend/app/models/__init__.py backend/tests/models/test_ai_parse_metric.py
git commit -m "feat(backend): AiParseMetric SQLModel"
```

### Task D.8: Verify SQLModel set matches baseline (autogenerate diff is empty)

**Files:**
- No files committed; this is a verification task.

- [ ] **Step 1: Apply the baseline migration against a fresh DB**

```bash
docker compose down -v
docker compose up -d database
sleep 5
cd backend && DATABASE_URL="postgresql+asyncpg://portal:portal@localhost:5432/portal" uv run alembic upgrade head
```

Expected: baseline applied; schema matches what Prisma produced.

- [ ] **Step 2: Run autogenerate against the now-defined SQLModel classes**

```bash
cd backend && DATABASE_URL="postgresql+asyncpg://portal:portal@localhost:5432/portal" uv run alembic revision --autogenerate -m "verify_no_drift"
```

Inspect the generated file under `alembic/versions/`. Expected: the `upgrade()` and `downgrade()` functions are both `pass` (no operations) — meaning the SQLModel set exactly matches the baseline schema.

- [ ] **Step 3: Delete the no-op verification revision**

```bash
rm backend/alembic/versions/*verify_no_drift*.py
```

- [ ] **Step 4: If the diff was NOT empty, fix the models**

Common causes of drift:
- Wrong column type (`int` vs `bigint`; `str` vs `varchar(n)`)
- Missing `index=True` or `unique=True`
- Missing nullable
- Wrong foreign-key target

Fix the offending model, rerun Steps 2–3 until the diff is empty. **Do not commit a no-op verification revision** — only the baseline lives in `alembic/versions/`.

- [ ] **Step 5: All model tests pass**

```bash
cd backend && uv run pytest tests/models/ -v
```

Expected: 7 tests pass.

- [ ] **Step 6: No commit needed for the verification itself (no files changed). If model files were edited to fix drift, commit those:**

```bash
git add backend/app/models
git commit -m "fix(models): align SQLModel set with baseline schema (drift verification)"
```

---

## Group E — Repositories (PR 4 part 2)

Each repository module mirrors a section of the current `frontend/lib/portal-data.ts`. Functions take an `AsyncSession` and return SQLModel instances or plain Pydantic-shaped data. Tests use the `db_session` fixture from Task D.0 and the inline factory helpers shown below.

### Task E.1: `matrix` repository

**Files:**
- Create: `backend/app/repositories/__init__.py`
- Create: `backend/app/repositories/matrix.py`
- Create: `backend/tests/repositories/__init__.py`
- Create: `backend/tests/repositories/test_matrix.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/repositories/test_matrix.py
from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.repositories.matrix import get_matrix


async def _seed_basic(db_session):
    j = Jurisdiction(id="j1", slug="crime", name="Crime")
    d = ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1")
    p = Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", stage="LIVE")
    i = Initiative(id="i1", product_id="p1", bucket="NOW", title="Sign-in latency reduction", position=1)
    db_session.add_all([j, d, p, i])
    await db_session.flush()


async def test_matrix_returns_one_band_per_jurisdiction(db_session):
    await _seed_basic(db_session)
    bands = await get_matrix(db_session)
    assert len(bands) >= 1
    crime = next(b for b in bands if b.jurisdiction.slug == "crime")
    assert crime.domain_count == 1
    assert crime.initiative_count == 1
    assert crime.rows[0].cells["NOW"][0].title == "Sign-in latency reduction"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/repositories/test_matrix.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Write the repository**

```python
# backend/app/repositories/matrix.py
from collections import defaultdict
from collections.abc import Sequence

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain

# Canonical Jurisdiction order (per requirements spec §3.2). The DB sort by
# slug or name doesn't match this; we project the fixed order over the
# result.
JURISDICTION_ORDER: tuple[str, ...] = ("crime", "civil", "family", "tribunals", "administrative")


class MatrixInitiative(BaseModel):
    id: str
    product_id: str
    product_name: str
    product_href: str
    bucket: str
    title: str
    description: str | None = None
    outbound_url: str | None = None


class MatrixDomainRow(BaseModel):
    domain: ProductDomain
    product_count: int
    cells: dict[str, list[MatrixInitiative]]


class MatrixJurisdictionBand(BaseModel):
    jurisdiction: Jurisdiction
    domain_count: int
    initiative_count: int
    rows: list[MatrixDomainRow]


def _jurisdiction_rank(slug: str) -> int:
    return JURISDICTION_ORDER.index(slug) if slug in JURISDICTION_ORDER else len(JURISDICTION_ORDER)


async def get_matrix(session: AsyncSession) -> Sequence[MatrixJurisdictionBand]:
    """Cross-DTS roadmap matrix — Jurisdiction → Domain → NOW/NEXT/LATER cells."""
    result = await session.execute(
        select(Jurisdiction).options(
            selectinload(Jurisdiction.domains).options(
                selectinload(ProductDomain.products).options(
                    selectinload(Product.initiatives),
                ),
            ),
        ),
    )
    jurisdictions = list(result.scalars().unique())
    jurisdictions.sort(key=lambda j: _jurisdiction_rank(j.slug))

    bands: list[MatrixJurisdictionBand] = []
    for j in jurisdictions:
        ordered_domains = sorted(j.domains, key=lambda d: (-len(d.products), d.name))
        rows: list[MatrixDomainRow] = []
        for d in ordered_domains:
            cells: dict[str, list[MatrixInitiative]] = defaultdict(list)
            for p in d.products:
                for i in p.initiatives:
                    cells[i.bucket].append(
                        MatrixInitiative(
                            id=i.id,
                            product_id=p.id,
                            product_name=p.name,
                            product_href=f"/p/{p.slug}",
                            bucket=i.bucket,
                            title=i.title,
                            description=i.description,
                            outbound_url=i.outbound_url,
                        ),
                    )
            for bucket in ("NOW", "NEXT", "LATER"):
                cells.setdefault(bucket, [])
            rows.append(MatrixDomainRow(domain=d, product_count=len(d.products), cells=dict(cells)))

        bands.append(
            MatrixJurisdictionBand(
                jurisdiction=j,
                domain_count=len(rows),
                initiative_count=sum(len(c) for r in rows for c in r.cells.values()),
                rows=rows,
            ),
        )
    return bands
```

Update the models so the relationships are declared (add to `ProductDomain` and `Product`):

```python
# In app/models/product_domain.py — add:
from app.models.product import Product
# ... and on the class:
products: list[Product] = Relationship(
    sa_relationship_kwargs={"lazy": "selectin", "order_by": "Product.name"},
)
domains: list["ProductDomain"] = Relationship()  # if Jurisdiction needs it

# Similar in app/models/jurisdiction.py — add a domains relationship:
domains: list["ProductDomain"] = Relationship(
    sa_relationship_kwargs={"lazy": "selectin", "order_by": "ProductDomain.name"},
)

# In app/models/product.py — add an initiatives relationship:
from app.models.initiative import Initiative
initiatives: list[Initiative] = Relationship(
    sa_relationship_kwargs={"lazy": "selectin", "order_by": "Initiative.position"},
)
```

**Caution:** circular imports between model modules. The simplest fix is to put all relationships in a single `app/models/relationships.py` module imported once at the end of `app/models/__init__.py`, using string references for the foreign types — see SQLAlchemy's `relationship("ModelName")` form. The exact wiring is left to the implementer; the contract is "the relationships listed above are queryable from `selectinload` in the repository".

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/repositories/test_matrix.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/repositories backend/app/models backend/tests/repositories
git commit -m "feat(backend): matrix repository — Jurisdiction → Domain → cells"
```

### Task E.2: `jurisdictions` repository

**Files:**
- Create: `backend/app/repositories/jurisdictions.py`
- Create: `backend/tests/repositories/test_jurisdictions.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/repositories/test_jurisdictions.py
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.repositories.jurisdictions import (
    get_jurisdiction_by_slug,
    get_domains_by_jurisdiction,
    get_jurisdiction_counts,
    get_products_consumed_by,
)


async def test_jurisdiction_helpers(db_session):
    j = Jurisdiction(id="j1", slug="crime", name="Crime")
    d = ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1")
    p = Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", stage="LIVE", consumed_by=["civil"])
    db_session.add_all([j, d, p])
    await db_session.flush()

    counts = await get_jurisdiction_counts(db_session)
    assert counts.get("crime") == 1

    found = await get_jurisdiction_by_slug(db_session, "crime")
    assert found is not None and found.name == "Crime"

    domains = await get_domains_by_jurisdiction(db_session, "crime")
    assert len(domains) == 1 and domains[0].slug == "common-platform"

    consumed = await get_products_consumed_by(db_session, "civil")
    assert len(consumed) == 1 and consumed[0].slug == "sign-in"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/repositories/test_jurisdictions.py -v
```

- [ ] **Step 3: Write the repository**

```python
# backend/app/repositories/jurisdictions.py
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain


async def get_jurisdiction_counts(session: AsyncSession) -> dict[str, int]:
    result = await session.execute(
        select(Jurisdiction.slug, func.count(ProductDomain.id))
        .outerjoin(ProductDomain, ProductDomain.jurisdiction_id == Jurisdiction.id)
        .group_by(Jurisdiction.slug),
    )
    return {slug: count for slug, count in result.all()}


async def get_jurisdiction_by_slug(session: AsyncSession, slug: str) -> Jurisdiction | None:
    result = await session.execute(select(Jurisdiction).where(Jurisdiction.slug == slug))
    return result.scalar_one_or_none()


async def get_domains_by_jurisdiction(session: AsyncSession, slug: str) -> Sequence[ProductDomain]:
    result = await session.execute(
        select(ProductDomain)
        .join(Jurisdiction)
        .where(Jurisdiction.slug == slug)
        .order_by(ProductDomain.name),
    )
    return list(result.scalars())


async def get_products_consumed_by(session: AsyncSession, jurisdiction_slug: str) -> Sequence[Product]:
    """Products whose `consumed_by` array contains the given Jurisdiction slug."""
    result = await session.execute(
        select(Product).where(Product.consumed_by.contains([jurisdiction_slug])),
    )
    return list(result.scalars())
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/repositories/test_jurisdictions.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/repositories/jurisdictions.py backend/tests/repositories/test_jurisdictions.py
git commit -m "feat(backend): jurisdictions repository (counts, by-slug, domains-for, consumed-products)"
```

### Task E.3: `domains` repository

**Files:**
- Create: `backend/app/repositories/domains.py`
- Create: `backend/tests/repositories/test_domains.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/repositories/test_domains.py
from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team
from app.repositories.domains import (
    get_domain_by_slug,
    get_initiatives_for_domain,
    get_products_for_domain,
    get_teams_for_domain,
)


async def test_domain_helpers(db_session):
    j = Jurisdiction(id="j1", slug="crime", name="Crime")
    d = ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1")
    t = Team(id="t1", slug="cp-core", name="CP Core", domain_id="d1")
    p = Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", stage="LIVE")
    i = Initiative(id="i1", product_id="p1", bucket="NOW", title="Sign-in latency reduction", position=1)
    db_session.add_all([j, d, t, p, i])
    await db_session.flush()

    found = await get_domain_by_slug(db_session, "common-platform")
    assert found is not None

    products = await get_products_for_domain(db_session, "common-platform")
    assert len(products) == 1 and products[0].slug == "sign-in"

    teams = await get_teams_for_domain(db_session, "common-platform")
    assert len(teams) == 1 and teams[0].slug == "cp-core"

    initiatives = await get_initiatives_for_domain(db_session, "common-platform")
    assert len(initiatives["NOW"]) == 1
    assert initiatives["NEXT"] == [] and initiatives["LATER"] == []
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/repositories/test_domains.py -v
```

- [ ] **Step 3: Write the repository**

```python
# backend/app/repositories/domains.py
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.initiative import Initiative
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team


async def get_domain_by_slug(session: AsyncSession, slug: str) -> ProductDomain | None:
    result = await session.execute(
        select(ProductDomain)
        .where(ProductDomain.slug == slug)
        .options(selectinload(ProductDomain.strategic_themes)),
    )
    return result.scalar_one_or_none()


async def get_products_for_domain(session: AsyncSession, domain_slug: str) -> Sequence[Product]:
    result = await session.execute(
        select(Product)
        .join(ProductDomain)
        .where(ProductDomain.slug == domain_slug)
        .order_by(Product.name),
    )
    return list(result.scalars())


async def get_teams_for_domain(session: AsyncSession, domain_slug: str) -> Sequence[Team]:
    result = await session.execute(
        select(Team)
        .join(ProductDomain)
        .where(ProductDomain.slug == domain_slug)
        .order_by(Team.name),
    )
    return list(result.scalars())


async def get_initiatives_for_domain(session: AsyncSession, domain_slug: str) -> dict[str, list[Initiative]]:
    result = await session.execute(
        select(Initiative)
        .join(Product)
        .join(ProductDomain)
        .where(ProductDomain.slug == domain_slug)
        .order_by(Initiative.position),
    )
    initiatives = list(result.scalars())
    grouped: dict[str, list[Initiative]] = {"NOW": [], "NEXT": [], "LATER": []}
    for i in initiatives:
        grouped.setdefault(i.bucket, []).append(i)
    return grouped
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/repositories/test_domains.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/repositories/domains.py backend/tests/repositories/test_domains.py
git commit -m "feat(backend): domains repository (by-slug, products-for, teams-for, initiatives-for)"
```

### Task E.4: `teams` repository

**Files:**
- Create: `backend/app/repositories/teams.py`
- Create: `backend/tests/repositories/test_teams.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/repositories/test_teams.py
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team
from app.repositories.teams import get_products_for_team, get_team_by_slug


async def test_team_helpers(db_session):
    j = Jurisdiction(id="j1", slug="crime", name="Crime")
    d = ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1")
    t = Team(id="t1", slug="cp-core", name="CP Core", domain_id="d1")
    p = Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", operating_team_id="t1", stage="LIVE")
    db_session.add_all([j, d, t, p])
    await db_session.flush()

    found = await get_team_by_slug(db_session, "cp-core")
    assert found is not None and found.name == "CP Core"

    products = await get_products_for_team(db_session, "cp-core")
    assert len(products) == 1 and products[0].slug == "sign-in"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/repositories/test_teams.py -v
```

- [ ] **Step 3: Write the repository**

```python
# backend/app/repositories/teams.py
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.team import Team


async def get_team_by_slug(session: AsyncSession, slug: str) -> Team | None:
    result = await session.execute(select(Team).where(Team.slug == slug))
    return result.scalar_one_or_none()


async def get_products_for_team(session: AsyncSession, team_slug: str) -> Sequence[Product]:
    result = await session.execute(
        select(Product)
        .join(Team, Team.id == Product.operating_team_id)
        .where(Team.slug == team_slug)
        .order_by(Product.name),
    )
    return list(result.scalars())
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/repositories/test_teams.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/repositories/teams.py backend/tests/repositories/test_teams.py
git commit -m "feat(backend): teams repository (by-slug, products-for)"
```

### Task E.5: `products` repository

**Files:**
- Create: `backend/app/repositories/products.py`
- Create: `backend/tests/repositories/test_products.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/repositories/test_products.py
from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.repositories.products import get_initiatives_for_product, get_product_by_slug


async def test_product_helpers(db_session):
    j = Jurisdiction(id="j1", slug="crime", name="Crime")
    d = ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1")
    p = Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", stage="LIVE")
    i = Initiative(id="i1", product_id="p1", bucket="NOW", title="Sign-in latency reduction", position=1)
    db_session.add_all([j, d, p, i])
    await db_session.flush()

    found = await get_product_by_slug(db_session, "sign-in")
    assert found is not None and found.name == "Sign In"

    initiatives = await get_initiatives_for_product(db_session, "p1")
    assert len(initiatives) == 1 and initiatives[0].title == "Sign-in latency reduction"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/repositories/test_products.py -v
```

- [ ] **Step 3: Write the repository**

```python
# backend/app/repositories/products.py
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.initiative import Initiative
from app.models.product import Product


async def get_product_by_slug(session: AsyncSession, slug: str) -> Product | None:
    result = await session.execute(
        select(Product)
        .where(Product.slug == slug)
        .options(selectinload(Product.outbound_links)),
    )
    return result.scalar_one_or_none()


async def get_initiatives_for_product(session: AsyncSession, product_id: str) -> Sequence[Initiative]:
    result = await session.execute(
        select(Initiative)
        .where(Initiative.product_id == product_id)
        .order_by(Initiative.position),
    )
    return list(result.scalars())
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/repositories/test_products.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/repositories/products.py backend/tests/repositories/test_products.py
git commit -m "feat(backend): products repository (by-slug, initiatives-for)"
```

### Task E.6: `activity` repository

**Files:**
- Create: `backend/app/repositories/activity.py`
- Create: `backend/tests/repositories/test_activity.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/repositories/test_activity.py
from datetime import datetime, timedelta, timezone

from app.models.activity_entry import ActivityEntry
from app.repositories.activity import get_activity


async def test_activity_returns_most_recent_first(db_session):
    now = datetime.now(timezone.utc)
    older = ActivityEntry(
        id="a1", subject="Common Platform", subject_href="/p/common-platform",
        description="Added Java 21 upgrade chip to NOW.",
        kind="roadmap-update", approver="Priya Shah",
        approved_at=now - timedelta(days=3),
    )
    newer = ActivityEntry(
        id="a2", subject="Hearings", subject_href="/p/hearings",
        description="Welsh-interpreter logic fix added to NEXT.",
        kind="new-chip", approver="Sam Wright",
        approved_at=now - timedelta(days=1),
    )
    db_session.add_all([older, newer])
    await db_session.flush()

    entries = await get_activity(db_session, limit=10)
    assert [e.id for e in entries] == ["a2", "a1"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/repositories/test_activity.py -v
```

- [ ] **Step 3: Write the repository**

```python
# backend/app/repositories/activity.py
from collections.abc import Sequence

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_entry import ActivityEntry


async def get_activity(session: AsyncSession, limit: int = 10) -> Sequence[ActivityEntry]:
    result = await session.execute(
        select(ActivityEntry).order_by(desc(ActivityEntry.approved_at)).limit(limit),
    )
    return list(result.scalars())
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/repositories/test_activity.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/repositories/activity.py backend/tests/repositories/test_activity.py
git commit -m "feat(backend): activity repository (most-recent-first feed)"
```

### Task E.7: `sidebar` repository

**Files:**
- Create: `backend/app/repositories/sidebar.py`
- Create: `backend/tests/repositories/test_sidebar.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/repositories/test_sidebar.py
from app.models.jurisdiction import Jurisdiction
from app.models.product_domain import ProductDomain
from app.repositories.sidebar import get_sidebar_jurisdictions


async def test_sidebar_returns_jurisdictions_with_domain_lists(db_session):
    j_crime = Jurisdiction(id="j1", slug="crime", name="Crime")
    j_civil = Jurisdiction(id="j2", slug="civil", name="Civil")
    d_cp = ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1")
    db_session.add_all([j_crime, j_civil, d_cp])
    await db_session.flush()

    sidebar = await get_sidebar_jurisdictions(db_session)
    crime = next(s for s in sidebar if s.slug == "crime")
    civil = next(s for s in sidebar if s.slug == "civil")
    assert crime.count == 1 and len(crime.domains) == 1
    assert civil.count == 0 and civil.domains == []
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/repositories/test_sidebar.py -v
```

- [ ] **Step 3: Write the repository**

```python
# backend/app/repositories/sidebar.py
from collections.abc import Sequence

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.jurisdiction import Jurisdiction

# Canonical Jurisdiction order — see app/repositories/matrix.py
JURISDICTION_ORDER: tuple[str, ...] = ("crime", "civil", "family", "tribunals", "administrative")


class SidebarDomain(BaseModel):
    slug: str
    name: str


class SidebarJurisdiction(BaseModel):
    slug: str
    name: str
    count: int
    domains: list[SidebarDomain]


def _rank(slug: str) -> int:
    return JURISDICTION_ORDER.index(slug) if slug in JURISDICTION_ORDER else len(JURISDICTION_ORDER)


async def get_sidebar_jurisdictions(session: AsyncSession) -> Sequence[SidebarJurisdiction]:
    result = await session.execute(
        select(Jurisdiction).options(selectinload(Jurisdiction.domains)),
    )
    rows = sorted(result.scalars().unique(), key=lambda j: _rank(j.slug))
    return [
        SidebarJurisdiction(
            slug=j.slug,
            name=j.name,
            count=len(j.domains),
            domains=[SidebarDomain(slug=d.slug, name=d.name) for d in sorted(j.domains, key=lambda d: d.name)],
        )
        for j in rows
    ]
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/repositories/test_sidebar.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/repositories/sidebar.py backend/tests/repositories/test_sidebar.py
git commit -m "feat(backend): sidebar repository (Jurisdictions + nested Domains)"
```

### Task E.8: Repository suite passes end-to-end

- [ ] **Step 1: Run the whole repositories test directory**

```bash
cd backend && uv run pytest tests/repositories/ -v
```

Expected: all tests pass (7 repository modules → ~7 tests, plus E.1's multi-row case).

- [ ] **Step 2: No commit needed (verification only).**

---

## Group F — API routers (PR 5 part 1)

Routers thin-wrap the repositories. Each route uses the `get_db` dependency from `app/db.py`. Identity is wired through a placeholder dependency (Task F.0) that no read-path route currently uses but is in place for when auth lands.

### Task F.0: Auth identity placeholder dependency

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/identity.py`
- Create: `backend/tests/test_auth_identity.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_auth_identity.py
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.identity import Identity, current_identity


async def test_identity_falls_back_to_anonymous_when_no_headers():
    app = FastAPI()

    @app.get("/who")
    def who(identity: Identity = Depends(current_identity)) -> dict[str, str | None]:
        return {"email": identity.email, "subject_id": identity.subject_id}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/who")
    assert resp.status_code == 200
    assert resp.json() == {"email": None, "subject_id": None}


async def test_identity_picks_up_forwarded_headers():
    app = FastAPI()

    @app.get("/who")
    def who(identity: Identity = Depends(current_identity)) -> dict[str, str | None]:
        return {"email": identity.email, "subject_id": identity.subject_id}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get(
            "/who",
            headers={
                "X-Forwarded-Email": "duncan.crawford.test@example.com",
                "X-Forwarded-User": "user-abc-123",
            },
        )
    assert resp.json() == {"email": "duncan.crawford.test@example.com", "subject_id": "user-abc-123"}
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/test_auth_identity.py -v
```

- [ ] **Step 3: Write the dependency**

```python
# backend/app/auth/identity.py
from dataclasses import dataclass

from fastapi import Request


@dataclass(frozen=True)
class Identity:
    """Identity carried on the request by the platform-edge auth layer.

    Read-path routes don't currently consume this — the portal is broadly
    readable inside the gated cluster. The dependency exists so the
    write-path port (a later plan) can attach it without changing routing.
    The concrete header names are landing-zone-specific; X-Forwarded-Email
    and X-Forwarded-User are reasonable defaults that oauth2-proxy uses by
    default, but the configuration is owned by the auth layer above us.
    """

    email: str | None
    subject_id: str | None


def current_identity(request: Request) -> Identity:
    return Identity(
        email=request.headers.get("X-Forwarded-Email"),
        subject_id=request.headers.get("X-Forwarded-User"),
    )
```

Create `backend/app/auth/__init__.py` (empty marker).

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/test_auth_identity.py -v
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/auth backend/tests/test_auth_identity.py
git commit -m "feat(backend): identity dependency (anonymous fallback + forwarded headers)"
```

### Task F.1: `matrix` router

**Files:**
- Create: `backend/app/api/matrix.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/api/__init__.py`
- Create: `backend/tests/api/test_matrix.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/api/test_matrix.py
from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain


async def test_get_matrix_returns_band_list(client, db_session):
    j = Jurisdiction(id="j1", slug="crime", name="Crime")
    d = ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1")
    p = Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", stage="LIVE")
    i = Initiative(id="i1", product_id="p1", bucket="NOW", title="Sign-in latency reduction", position=1)
    db_session.add_all([j, d, p, i])
    await db_session.commit()

    resp = await client.get("/api/matrix")
    assert resp.status_code == 200
    bands = resp.json()
    crime = next(b for b in bands if b["jurisdiction"]["slug"] == "crime")
    assert crime["initiative_count"] >= 1
```

**Note**: this test uses `db_session.commit()` (not flush) because the HTTP client opens its own session against the same database. The transactional fixture from Task D.0 doesn't isolate via flush in this case — adjust the fixture to use a savepoint-per-test if isolation matters across the client boundary, or accept that API tests leave seed rows behind that the next test must tolerate. The simplest fix is to add a `TRUNCATE ... RESTART IDENTITY CASCADE` at the start of each API test file. Document this trade-off in `backend/tests/api/conftest.py`:

```python
# backend/tests/api/conftest.py
import pytest
from sqlalchemy import text

from app.db import async_session_factory


@pytest.fixture(autouse=True)
async def reset_db():
    """API tests run against the real DB and the FastAPI app's own sessions.
    Roll the schema back to empty before each test."""
    async with async_session_factory() as session:
        await session.execute(text(
            'TRUNCATE TABLE "Initiative", "OutboundLink", "Product", "Team", '
            '"StrategicTheme", "ProductDomain", "Jurisdiction", "ActivityEntry", '
            '"AiParseMetric" RESTART IDENTITY CASCADE',
        ))
        await session.commit()
    yield
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/api/test_matrix.py -v
```

- [ ] **Step 3: Write the router**

```python
# backend/app/api/matrix.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.matrix import MatrixJurisdictionBand, get_matrix

router = APIRouter(prefix="/api", tags=["matrix"])


@router.get("/matrix", response_model=list[MatrixJurisdictionBand])
async def matrix(session: AsyncSession = Depends(get_db)) -> list[MatrixJurisdictionBand]:
    return list(await get_matrix(session))
```

Update `backend/app/main.py` to include the router:

```python
from app.api import health, matrix

app.include_router(health.router)
app.include_router(matrix.router)
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/api/test_matrix.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/matrix.py backend/app/main.py backend/tests/api
git commit -m "feat(backend): GET /api/matrix"
```

### Task F.2: `activity` router

**Files:**
- Create: `backend/app/api/activity.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/api/test_activity.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/api/test_activity.py
from datetime import datetime, timezone

from app.models.activity_entry import ActivityEntry
from app.db import async_session_factory


async def test_get_activity_returns_recent_entries(client):
    async with async_session_factory() as s:
        s.add(ActivityEntry(
            id="a1", subject="Common Platform", subject_href="/p/common-platform",
            description="Added Java 21 upgrade chip to NOW.",
            kind="roadmap-update", approver="Priya Shah",
            approved_at=datetime.now(timezone.utc),
        ))
        await s.commit()

    resp = await client.get("/api/activity")
    assert resp.status_code == 200
    entries = resp.json()
    assert any(e["subject"] == "Common Platform" for e in entries)
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/api/test_activity.py -v
```

- [ ] **Step 3: Write the router**

```python
# backend/app/api/activity.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.activity_entry import ActivityEntry
from app.repositories.activity import get_activity

router = APIRouter(prefix="/api", tags=["activity"])


@router.get("/activity", response_model=list[ActivityEntry])
async def activity(
    limit: int = Query(default=10, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
) -> list[ActivityEntry]:
    return list(await get_activity(session, limit=limit))
```

Add to `main.py`:

```python
from app.api import activity
app.include_router(activity.router)
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/api/test_activity.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/activity.py backend/app/main.py backend/tests/api/test_activity.py
git commit -m "feat(backend): GET /api/activity"
```

### Task F.3: `sidebar` router

**Files:**
- Create: `backend/app/api/sidebar.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/api/test_sidebar.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/api/test_sidebar.py
from app.models.jurisdiction import Jurisdiction
from app.models.product_domain import ProductDomain
from app.db import async_session_factory


async def test_get_sidebar_returns_jurisdictions(client):
    async with async_session_factory() as s:
        s.add_all([
            Jurisdiction(id="j1", slug="crime", name="Crime"),
            ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1"),
        ])
        await s.commit()

    resp = await client.get("/api/sidebar/jurisdictions")
    assert resp.status_code == 200
    data = resp.json()
    crime = next(j for j in data if j["slug"] == "crime")
    assert crime["count"] == 1
    assert crime["domains"][0]["slug"] == "common-platform"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/api/test_sidebar.py -v
```

- [ ] **Step 3: Write the router**

```python
# backend/app/api/sidebar.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.sidebar import SidebarJurisdiction, get_sidebar_jurisdictions

router = APIRouter(prefix="/api/sidebar", tags=["sidebar"])


@router.get("/jurisdictions", response_model=list[SidebarJurisdiction])
async def sidebar_jurisdictions(session: AsyncSession = Depends(get_db)) -> list[SidebarJurisdiction]:
    return list(await get_sidebar_jurisdictions(session))
```

Add to `main.py`:

```python
from app.api import sidebar
app.include_router(sidebar.router)
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/api/test_sidebar.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/sidebar.py backend/app/main.py backend/tests/api/test_sidebar.py
git commit -m "feat(backend): GET /api/sidebar/jurisdictions"
```

### Task F.4: `jurisdictions` router

**Files:**
- Create: `backend/app/api/jurisdictions.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/api/test_jurisdictions.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/api/test_jurisdictions.py
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.db import async_session_factory


async def test_jurisdiction_endpoints(client):
    async with async_session_factory() as s:
        s.add_all([
            Jurisdiction(id="j1", slug="crime", name="Crime"),
            ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1"),
            Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", stage="LIVE", consumed_by=["civil"]),
        ])
        await s.commit()

    resp = await client.get("/api/jurisdictions/crime")
    assert resp.status_code == 200 and resp.json()["name"] == "Crime"

    resp = await client.get("/api/jurisdictions/crime/domains")
    assert resp.status_code == 200
    assert resp.json()[0]["slug"] == "common-platform"

    resp = await client.get("/api/jurisdictions/civil/consumed-products")
    assert resp.status_code == 200
    assert resp.json()[0]["slug"] == "sign-in"

    resp = await client.get("/api/jurisdictions/does-not-exist")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/api/test_jurisdictions.py -v
```

- [ ] **Step 3: Write the router**

```python
# backend/app/api/jurisdictions.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.repositories.jurisdictions import (
    get_domains_by_jurisdiction,
    get_jurisdiction_by_slug,
    get_products_consumed_by,
)

router = APIRouter(prefix="/api/jurisdictions", tags=["jurisdictions"])


@router.get("/{slug}", response_model=Jurisdiction)
async def by_slug(slug: str, session: AsyncSession = Depends(get_db)) -> Jurisdiction:
    found = await get_jurisdiction_by_slug(session, slug)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Jurisdiction '{slug}' not found")
    return found


@router.get("/{slug}/domains", response_model=list[ProductDomain])
async def domains(slug: str, session: AsyncSession = Depends(get_db)) -> list[ProductDomain]:
    return list(await get_domains_by_jurisdiction(session, slug))


@router.get("/{slug}/consumed-products", response_model=list[Product])
async def consumed_products(slug: str, session: AsyncSession = Depends(get_db)) -> list[Product]:
    return list(await get_products_consumed_by(session, slug))
```

Add to `main.py`:

```python
from app.api import jurisdictions
app.include_router(jurisdictions.router)
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/api/test_jurisdictions.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/jurisdictions.py backend/app/main.py backend/tests/api/test_jurisdictions.py
git commit -m "feat(backend): GET /api/jurisdictions/{slug} + nested endpoints"
```

### Task F.5: `domains` router

**Files:**
- Create: `backend/app/api/domains.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/api/test_domains.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/api/test_domains.py
from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team
from app.db import async_session_factory


async def test_domain_endpoints(client):
    async with async_session_factory() as s:
        s.add_all([
            Jurisdiction(id="j1", slug="crime", name="Crime"),
            ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1"),
            Team(id="t1", slug="cp-core", name="CP Core", domain_id="d1"),
            Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", stage="LIVE"),
            Initiative(id="i1", product_id="p1", bucket="NOW", title="Sign-in latency reduction", position=1),
        ])
        await s.commit()

    assert (await client.get("/api/domains/common-platform")).status_code == 200
    assert (await client.get("/api/domains/common-platform/products")).json()[0]["slug"] == "sign-in"
    assert (await client.get("/api/domains/common-platform/teams")).json()[0]["slug"] == "cp-core"
    initiatives = (await client.get("/api/domains/common-platform/initiatives")).json()
    assert initiatives["NOW"][0]["title"] == "Sign-in latency reduction"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/api/test_domains.py -v
```

- [ ] **Step 3: Write the router**

```python
# backend/app/api/domains.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.initiative import Initiative
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team
from app.repositories.domains import (
    get_domain_by_slug,
    get_initiatives_for_domain,
    get_products_for_domain,
    get_teams_for_domain,
)

router = APIRouter(prefix="/api/domains", tags=["domains"])


@router.get("/{slug}", response_model=ProductDomain)
async def by_slug(slug: str, session: AsyncSession = Depends(get_db)) -> ProductDomain:
    found = await get_domain_by_slug(session, slug)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Domain '{slug}' not found")
    return found


@router.get("/{slug}/products", response_model=list[Product])
async def products(slug: str, session: AsyncSession = Depends(get_db)) -> list[Product]:
    return list(await get_products_for_domain(session, slug))


@router.get("/{slug}/teams", response_model=list[Team])
async def teams(slug: str, session: AsyncSession = Depends(get_db)) -> list[Team]:
    return list(await get_teams_for_domain(session, slug))


@router.get("/{slug}/initiatives", response_model=dict[str, list[Initiative]])
async def initiatives(slug: str, session: AsyncSession = Depends(get_db)) -> dict[str, list[Initiative]]:
    return await get_initiatives_for_domain(session, slug)
```

Add to `main.py`:

```python
from app.api import domains
app.include_router(domains.router)
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/api/test_domains.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/domains.py backend/app/main.py backend/tests/api/test_domains.py
git commit -m "feat(backend): GET /api/domains/{slug} + nested endpoints"
```

### Task F.6: `teams` router

**Files:**
- Create: `backend/app/api/teams.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/api/test_teams.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/api/test_teams.py
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.models.team import Team
from app.db import async_session_factory


async def test_team_endpoints(client):
    async with async_session_factory() as s:
        s.add_all([
            Jurisdiction(id="j1", slug="crime", name="Crime"),
            ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1"),
            Team(id="t1", slug="cp-core", name="CP Core", domain_id="d1"),
            Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", operating_team_id="t1", stage="LIVE"),
        ])
        await s.commit()

    assert (await client.get("/api/teams/cp-core")).json()["name"] == "CP Core"
    assert (await client.get("/api/teams/cp-core/products")).json()[0]["slug"] == "sign-in"
    assert (await client.get("/api/teams/missing")).status_code == 404
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/api/test_teams.py -v
```

- [ ] **Step 3: Write the router**

```python
# backend/app/api/teams.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.product import Product
from app.models.team import Team
from app.repositories.teams import get_products_for_team, get_team_by_slug

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/{slug}", response_model=Team)
async def by_slug(slug: str, session: AsyncSession = Depends(get_db)) -> Team:
    found = await get_team_by_slug(session, slug)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Team '{slug}' not found")
    return found


@router.get("/{slug}/products", response_model=list[Product])
async def products(slug: str, session: AsyncSession = Depends(get_db)) -> list[Product]:
    return list(await get_products_for_team(session, slug))
```

Add to `main.py`:

```python
from app.api import teams
app.include_router(teams.router)
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/api/test_teams.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/teams.py backend/app/main.py backend/tests/api/test_teams.py
git commit -m "feat(backend): GET /api/teams/{slug} + products-for-team"
```

### Task F.7: `products` router

**Files:**
- Create: `backend/app/api/products.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/api/test_products.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/api/test_products.py
from app.models.initiative import Initiative
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.db import async_session_factory


async def test_product_endpoints(client):
    async with async_session_factory() as s:
        s.add_all([
            Jurisdiction(id="j1", slug="crime", name="Crime"),
            ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1"),
            Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", stage="LIVE"),
            Initiative(id="i1", product_id="p1", bucket="NOW", title="Sign-in latency reduction", position=1),
        ])
        await s.commit()

    assert (await client.get("/api/products/sign-in")).json()["name"] == "Sign In"
    initiatives = (await client.get("/api/products/sign-in/initiatives")).json()
    assert initiatives[0]["title"] == "Sign-in latency reduction"
    assert (await client.get("/api/products/missing")).status_code == 404
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && uv run pytest tests/api/test_products.py -v
```

- [ ] **Step 3: Write the router**

```python
# backend/app/api/products.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.initiative import Initiative
from app.models.product import Product
from app.repositories.products import get_initiatives_for_product, get_product_by_slug

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/{slug}", response_model=Product)
async def by_slug(slug: str, session: AsyncSession = Depends(get_db)) -> Product:
    found = await get_product_by_slug(session, slug)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Product '{slug}' not found")
    return found


@router.get("/{slug}/initiatives", response_model=list[Initiative])
async def initiatives(slug: str, session: AsyncSession = Depends(get_db)) -> list[Initiative]:
    product = await get_product_by_slug(session, slug)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product '{slug}' not found")
    return list(await get_initiatives_for_product(session, product.id))
```

Add to `main.py`:

```python
from app.api import products
app.include_router(products.router)
```

- [ ] **Step 4: Run**

```bash
cd backend && uv run pytest tests/api/test_products.py -v
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/products.py backend/app/main.py backend/tests/api/test_products.py
git commit -m "feat(backend): GET /api/products/{slug} + initiatives-for-product"
```

### Task F.8: Router suite passes end-to-end + OpenAPI document available

- [ ] **Step 1: Run the whole API test directory**

```bash
cd backend && uv run pytest tests/api/ -v
```

Expected: ~7 tests pass.

- [ ] **Step 2: Verify the OpenAPI document is served**

```bash
docker compose up -d database backend
sleep 5
curl -fsS http://localhost:8000/api/openapi.json | python -c "import json, sys; d = json.load(sys.stdin); print(len(d['paths']), 'paths')"
```

Expected: ≥10 paths (each route in F.1–F.7).

- [ ] **Step 3: No commit needed (verification only).**

---

## Group G — Frontend container (Caddy + Next.js standalone, PR 6 part 1)

The frontend container exposes `:3000` (Caddy). Inside, Caddy reverse-proxies `/api/*` to the backend service and falls through to Next.js on `127.0.0.1:3001` for everything else. Both processes run under supervisord.

### Task G.1: `frontend/Caddyfile`

**Files:**
- Create: `frontend/Caddyfile`

- [ ] **Step 1: Write the Caddyfile**

```caddyfile
{
    auto_https off
    admin off
}

:3000 {
    route {
        # API calls go to the backend service. Resolved via in-cluster DNS in
        # K8s; via the docker-compose service name locally.
        @backend path /api/*
        handle @backend {
            reverse_proxy {$PORTAL_BACKEND_URL:http://backend:8000} {
                header_up Host {http.reverse_proxy.upstream.host}
            }
        }

        # Everything else (pages, static assets, _next/*) goes to the
        # Next.js standalone server on loopback.
        handle {
            reverse_proxy localhost:3001
        }
    }
}
```

- [ ] **Step 2: No test step (config file); commit**

```bash
git add frontend/Caddyfile
git commit -m "feat(frontend): Caddyfile reverse-proxying /api/* to backend"
```

### Task G.2: `frontend/supervisord.conf`

**Files:**
- Create: `frontend/supervisord.conf`

- [ ] **Step 1: Write the supervisord config**

```ini
[supervisord]
nodaemon=true
pidfile=/tmp/supervisord.pid
logfile=/dev/null
logfile_maxbytes=0

[program:caddy]
command=caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
autostart=true
autorestart=false
environment=HOME="/tmp"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:nextjs]
command=node /app/start.js
autostart=true
autorestart=false
environment=PORT="3001",HOSTNAME="127.0.0.1"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

# If either program exits, take down supervisord so K8s sees the Pod as
# unhealthy and restarts it. Without this, a Next.js crash would leave Caddy
# happily serving 502s.
[eventlistener:quit_on_exit]
command=/bin/sh -c "printf 'READY\n'; IFS= read -r _; kill -TERM $PPID; printf 'RESULT 2\nOK'"
events=PROCESS_STATE_EXITED,PROCESS_STATE_FATAL
stdout_logfile=/dev/null
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

- [ ] **Step 2: Commit**

```bash
git add frontend/supervisord.conf
git commit -m "feat(frontend): supervisord config (caddy + next.js + quit-on-exit)"
```

### Task G.3: `frontend/start.js` and `next.config.js` standalone output

**Files:**
- Create: `frontend/start.js`
- Modify: `frontend/next.config.js`

- [ ] **Step 1: Write the start shim**

The Next.js standalone build emits `.next/standalone/server.js` (Next 15+) or `.next/standalone/<dir>/server.js`. The shim wraps that with a deterministic entrypoint and lets supervisord supervise one stable command.

```javascript
// frontend/start.js
const { spawnSync } = require("node:child_process");

const env = {
  ...process.env,
  PORT: process.env.PORT || "3001",
  HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
};

const result = spawnSync(process.execPath, ["server.js"], {
  cwd: __dirname,
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
```

- [ ] **Step 2: Update `frontend/next.config.js` to emit a standalone build**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Pin Turbopack root so it doesn't get confused by the monorepo lockfiles.
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
```

(Strip any observability or analytics wrappers that may already be present in the current `next.config.js`. They're optional and not part of the rewrite; keep `next.config.js` minimal so the standalone build path is the only behaviour the file describes.)

- [ ] **Step 3: Verify the standalone build works**

```bash
cd frontend && pnpm build
ls -la .next/standalone/server.js .next/standalone/.next/static 2>&1
node start.js &
PID=$!
sleep 3
curl -fsS http://127.0.0.1:3001/ > /dev/null && echo "OK"
kill $PID
```

Expected: build emits `.next/standalone/`; `start.js` serves the app on 3001; `/` returns 200.

- [ ] **Step 4: Commit**

```bash
git add frontend/start.js frontend/next.config.js
git commit -m "feat(frontend): standalone output + start.js shim for supervisord"
```

### Task G.4: Multi-stage `frontend/Dockerfile`

**Files:**
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS base

# pnpm via corepack, pinned to the version in package.json's packageManager
RUN corepack enable && corepack prepare pnpm@10 --activate

# ---- deps ----------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir=/pnpm-store

# ---- builder -------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VERSION=dev
ARG PORTAL_BACKEND_URL=http://backend:8000
ENV NEXT_PUBLIC_PORTAL_BACKEND_URL=$PORTAL_BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    APP_VERSION=$VERSION

RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
    pnpm run build

# ---- runner --------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ARG VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=$VERSION

RUN apk add --no-cache caddy supervisor

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone runtime: server.js + node_modules + the public/ + .next/static
COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Supervisord + Caddy config
COPY supervisord.conf /etc/supervisord.conf
COPY Caddyfile /etc/caddy/Caddyfile
COPY --chown=nextjs:nodejs start.js ./start.js

USER nextjs

EXPOSE 3000
ENV PORT=3001 \
    HOSTNAME="127.0.0.1"

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD wget -qO- http://localhost:3000/api/health > /dev/null || exit 1

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
```

- [ ] **Step 2: Build and smoke-test**

```bash
cd frontend && docker build -t portal-frontend:dev .
docker compose up -d database backend
docker run --rm -d --name portal-fe-test --network host \
  -e PORTAL_BACKEND_URL=http://localhost:8000 \
  portal-frontend:dev
sleep 6
curl -fsS http://localhost:3000/ > /dev/null && echo "Page OK"
curl -fsS http://localhost:3000/api/health
docker rm -f portal-fe-test
```

Expected: `Page OK` + `{"status":"ok"}` from the backend through Caddy.

- [ ] **Step 3: Add the frontend service to `docker-compose.yml`**

```yaml
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VERSION: dev
        PORTAL_BACKEND_URL: http://backend:8000
    environment:
      PORTAL_BACKEND_URL: http://backend:8000
    ports:
      - "3000:3000"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped
```

- [ ] **Step 4: End-to-end smoke**

```bash
docker compose up -d
sleep 10
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:3000/ > /dev/null && echo "Page OK"
```

Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add frontend/Dockerfile docker-compose.yml
git commit -m "feat(frontend): multi-stage Dockerfile with Caddy + supervisord; wire into compose"
```

---

## Group H — Generated API client + wrapper (PR 6 part 2)

### Task H.1: Add `openapi-typescript-codegen` and the `generate-api` script

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/scripts/generate-api.ts`

- [ ] **Step 1: Add dev deps**

```bash
cd frontend && pnpm add -D openapi-typescript-codegen ts-node
```

Verify `frontend/package.json` gained both entries under `devDependencies`.

- [ ] **Step 2: Add the `generate-api` script entry to package.json**

In `frontend/package.json`'s `scripts`:

```json
{
  "scripts": {
    "generate-api": "ts-node scripts/generate-api.ts"
  }
}
```

- [ ] **Step 3: Write `frontend/scripts/generate-api.ts`**

```ts
import { generate } from "openapi-typescript-codegen";

const input =
  process.env.OPENAPI_URL || "http://localhost:8000/api/openapi.json";

async function main(): Promise<void> {
  try {
    await generate({
      input,
      output: "./lib/api/generated",
      exportCore: false,
      exportServices: false,
      exportModels: true,
    });
    console.log(`Generated client from ${input}`);
  } catch (err) {
    console.error("Failed to generate API types from OpenAPI document.");
    console.error("Is the backend running on the expected port?");
    console.error(err);
    process.exit(1);
  }
}

void main();
```

- [ ] **Step 4: Run it (with backend up from Task G.4)**

```bash
docker compose up -d database backend
sleep 5
cd frontend && pnpm generate-api
ls -la lib/api/generated/
```

Expected: directory populated with `.ts` model files mirroring the FastAPI response_model types.

- [ ] **Step 5: Verify the generated dir is gitignored**

Confirm the `frontend/lib/api/generated/` entry from Task A.3 is in `/.gitignore` (or add it to `frontend/.gitignore`).

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/scripts/generate-api.ts
git commit -m "feat(frontend): openapi codegen — generate-api script + dev deps"
```

### Task H.2: `frontend/lib/api-client.ts` wrapper

**Files:**
- Create: `frontend/lib/api-client.ts`
- Create: `frontend/lib/api-client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/lib/api-client.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createApiClient, ApiError } from "./api-client";

describe("createApiClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("GETs the configured base URL + path and returns parsed JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test" });
    const result = await client.get<{ status: string }>("/api/health");
    expect(result).toEqual({ status: "ok" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://api.test/api/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws ApiError with status and detail on 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test" });
    await expect(client.get("/api/missing")).rejects.toThrow(ApiError);
    await expect(client.get("/api/missing")).rejects.toMatchObject({
      status: 404,
      detail: "not found",
    });
  });

  it("propagates forwarded identity headers when supplied", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createApiClient({
      baseUrl: "http://api.test",
      forwardedHeaders: {
        "X-Forwarded-Email": "duncan.crawford.test@example.com",
        "X-Forwarded-User": "abc-123",
      },
    });
    await client.get("/api/health");
    const [, init] = (globalThis.fetch as any).mock.calls[0];
    expect(init.headers["X-Forwarded-Email"]).toBe("duncan.crawford.test@example.com");
    expect(init.headers["X-Forwarded-User"]).toBe("abc-123");
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
cd frontend && pnpm test lib/api-client.test.ts
```

Expected: `Cannot find module './api-client'`.

- [ ] **Step 3: Write the client**

```ts
// frontend/lib/api-client.ts

/**
 * Client wrapper around fetch + the OpenAPI-generated types.
 *
 * Used by Server Components (`createApiClient` with forwarded identity
 * headers from the incoming request) and Client Components (`createApiClient`
 * with no extra headers — the browser sends cookies/identity natively to the
 * same origin).
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly url: string,
  ) {
    super(`API ${status} on ${url}: ${detail}`);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Headers to forward on every outgoing request — typically identity
   * headers propagated server-side from the incoming request. */
  forwardedHeaders?: Record<string, string>;
}

export interface ApiClient {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
}

function buildHeaders(
  forwardedHeaders: Record<string, string> | undefined,
  override: HeadersInit | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(forwardedHeaders ?? {}),
  };
  if (override) {
    if (override instanceof Headers) {
      override.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(override)) {
      for (const [key, value] of override) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, override);
    }
  }
  return headers;
}

async function parseOrThrow<T>(response: Response, url: string): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }
  let detail = response.statusText;
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) detail = body.detail;
  } catch {
    // body wasn't JSON — keep statusText
  }
  throw new ApiError(response.status, detail, url);
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const base = options.baseUrl.replace(/\/$/, "");

  return {
    async get<T>(path: string, init?: RequestInit): Promise<T> {
      const url = `${base}${path}`;
      const response = await fetch(url, {
        method: "GET",
        headers: buildHeaders(options.forwardedHeaders, init?.headers),
        ...init,
      });
      return parseOrThrow<T>(response, url);
    },
    async post<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
      const url = `${base}${path}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders(options.forwardedHeaders, init?.headers),
        },
        body: JSON.stringify(body),
        ...init,
      });
      return parseOrThrow<T>(response, url);
    },
  };
}
```

- [ ] **Step 4: Run**

```bash
cd frontend && pnpm test lib/api-client.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api-client.ts frontend/lib/api-client.test.ts
git commit -m "feat(frontend): api-client wrapper around fetch + generated types"
```

### Task H.3: Server-side helper to forward identity headers from the incoming request

**Files:**
- Create: `frontend/lib/api-client-server.ts`
- Create: `frontend/lib/api-client-server.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/lib/api-client-server.test.ts
import { describe, expect, it } from "vitest";
import { pickForwardedHeaders } from "./api-client-server";

describe("pickForwardedHeaders", () => {
  it("picks only the forwarded identity headers", () => {
    const headers = new Headers({
      "X-Forwarded-Email": "duncan.crawford.test@example.com",
      "X-Forwarded-User": "abc-123",
      "X-Forwarded-Groups": "engineering,leadership",
      Cookie: "session=opaque",
      "User-Agent": "Mozilla/5.0",
    });
    const picked = pickForwardedHeaders(headers);
    expect(picked).toEqual({
      "X-Forwarded-Email": "duncan.crawford.test@example.com",
      "X-Forwarded-User": "abc-123",
      "X-Forwarded-Groups": "engineering,leadership",
    });
  });

  it("returns an empty object when no identity headers are present", () => {
    expect(pickForwardedHeaders(new Headers({ "User-Agent": "x" }))).toEqual({});
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd frontend && pnpm test lib/api-client-server.test.ts
```

- [ ] **Step 3: Write the helper**

```ts
// frontend/lib/api-client-server.ts
import { headers as nextHeaders } from "next/headers";
import { createApiClient, type ApiClient } from "./api-client";

const FORWARDED_HEADERS = [
  "X-Forwarded-Email",
  "X-Forwarded-User",
  "X-Forwarded-Groups",
  "X-Forwarded-Preferred-Username",
];

export function pickForwardedHeaders(source: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of FORWARDED_HEADERS) {
    const value = source.get(name);
    if (value) out[name] = value;
  }
  return out;
}

/**
 * Server-only API client factory. Reads forwarded identity headers from the
 * incoming Next.js request via `headers()` and attaches them to outgoing
 * fetches against the backend. Use from Server Components, route handlers,
 * and server actions.
 */
export async function getServerApiClient(): Promise<ApiClient> {
  const baseUrl =
    process.env.PORTAL_BACKEND_URL ||
    process.env.NEXT_PUBLIC_PORTAL_BACKEND_URL ||
    "http://localhost:8000";
  const requestHeaders = await nextHeaders();
  return createApiClient({
    baseUrl,
    forwardedHeaders: pickForwardedHeaders(requestHeaders),
  });
}
```

- [ ] **Step 4: Run**

```bash
cd frontend && pnpm test lib/api-client-server.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api-client-server.ts frontend/lib/api-client-server.test.ts
git commit -m "feat(frontend): server-side api client factory with header forwarding"
```

---

## Group I — Page port (PR 7 — likely 3-5 stacked PRs)

The pattern for every page port is the same: replace `frontend/lib/portal-data` imports with `getServerApiClient()` from `frontend/lib/api-client-server.ts`, swap the function calls, and verify Vitest + Playwright still pass. Pages stay Server Components and SSR is preserved.

### Task I.1: Home page (matrix + activity)

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Verify the existing Playwright home-page test passes against the new stack**

```bash
docker compose up -d
sleep 10
cd frontend && pnpm exec playwright test tests/e2e/home --reporter=line
```

Note the baseline pass count.

- [ ] **Step 2: Swap the data fetching**

The current shape:

```tsx
// frontend/app/page.tsx (BEFORE)
import { getActivity, getMatrix } from "@/lib/portal-data";

export default async function HomePage() {
  const [matrix, activity] = await Promise.all([getMatrix(), getActivity()]);
  // ... unchanged JSX
}
```

After:

```tsx
// frontend/app/page.tsx (AFTER)
import { getServerApiClient } from "@/lib/api-client-server";
import type { MatrixJurisdictionBand, ActivityEntry } from "@/lib/api/generated";

export default async function HomePage() {
  const api = await getServerApiClient();
  const [matrix, activity] = await Promise.all([
    api.get<MatrixJurisdictionBand[]>("/api/matrix"),
    api.get<ActivityEntry[]>("/api/activity"),
  ]);
  // ... unchanged JSX
}
```

The downstream `<RoadmapMatrix bands={matrix} />` and `<ActivityFeed entries={activity} />` components see the same shapes (the OpenAPI codegen generates types that match the SQLModel response shapes).

- [ ] **Step 3: Run the home-page Playwright test again**

```bash
cd frontend && pnpm exec playwright test tests/e2e/home --reporter=line
```

Expected: same pass count as Step 1, no regressions.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(frontend): port home page to backend API for matrix + activity"
```

### Task I.2: Sidebar component

**Files:**
- Modify: `frontend/components/app-shell.tsx` (or wherever `getSidebarJurisdictions` is consumed)

- [ ] **Step 1: Locate the call site**

```bash
cd frontend && grep -rn "getSidebarJurisdictions" .
```

The current call site is `frontend/components/app-shell.tsx:24` (per prior context); confirm.

- [ ] **Step 2: Swap the data fetching**

Before:

```tsx
import { getSidebarJurisdictions } from "@/lib/portal-data";
const jurisdictions = await getSidebarJurisdictions();
```

After:

```tsx
import { getServerApiClient } from "@/lib/api-client-server";
import type { SidebarJurisdiction } from "@/lib/api/generated";

const api = await getServerApiClient();
const jurisdictions = await api.get<SidebarJurisdiction[]>("/api/sidebar/jurisdictions");
```

- [ ] **Step 3: Run sidebar-related tests**

```bash
cd frontend && pnpm test components/sidebar
cd frontend && pnpm exec playwright test tests/e2e/sidebar-expand --reporter=line
```

Expected: existing sidebar Vitest + e2e tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/app-shell.tsx
git commit -m "feat(frontend): port sidebar to backend API"
```

### Task I.3: Jurisdiction page (`/j/[slug]`)

**Files:**
- Modify: `frontend/app/j/[slug]/page.tsx`

- [ ] **Step 1: Locate the data calls**

```bash
cd frontend && cat app/j/\[slug\]/page.tsx | grep -E "getJurisdiction|getDomains|getProductsConsumed"
```

- [ ] **Step 2: Swap each call**

Before:

```tsx
import { getDomainsByJurisdiction, getJurisdictionBySlug, getProductsConsumedBy } from "@/lib/portal-data";

const [j, domains, consumed] = await Promise.all([
  getJurisdictionBySlug(slug),
  getDomainsByJurisdiction(slug),
  getProductsConsumedBy(slug),
]);
if (!j) notFound();
```

After:

```tsx
import { getServerApiClient } from "@/lib/api-client-server";
import { ApiError } from "@/lib/api-client";
import type { Jurisdiction, ProductDomain, Product } from "@/lib/api/generated";

const api = await getServerApiClient();
let j: Jurisdiction;
try {
  j = await api.get<Jurisdiction>(`/api/jurisdictions/${slug}`);
} catch (err) {
  if (err instanceof ApiError && err.status === 404) notFound();
  throw err;
}
const [domains, consumed] = await Promise.all([
  api.get<ProductDomain[]>(`/api/jurisdictions/${slug}/domains`),
  api.get<Product[]>(`/api/jurisdictions/${slug}/consumed-products`),
]);
```

- [ ] **Step 3: Run jurisdiction-page e2e tests**

```bash
cd frontend && pnpm exec playwright test tests/e2e/jurisdiction --reporter=line
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/j
git commit -m "feat(frontend): port jurisdiction page to backend API"
```

### Task I.4: Domain page (`/d/[slug]`)

**Files:**
- Modify: `frontend/app/d/[slug]/page.tsx`

- [ ] **Step 1: Swap the data calls**

Before:

```tsx
import {
  getDomainBySlug, getProductsForDomain, getTeamsForDomain, getInitiativesForDomain,
} from "@/lib/portal-data";
```

After:

```tsx
import { getServerApiClient } from "@/lib/api-client-server";
import { ApiError } from "@/lib/api-client";
import type { ProductDomain, Product, Team, Initiative } from "@/lib/api/generated";

const api = await getServerApiClient();
let domain: ProductDomain;
try {
  domain = await api.get<ProductDomain>(`/api/domains/${slug}`);
} catch (err) {
  if (err instanceof ApiError && err.status === 404) notFound();
  throw err;
}
const [products, teams, initiatives] = await Promise.all([
  api.get<Product[]>(`/api/domains/${slug}/products`),
  api.get<Team[]>(`/api/domains/${slug}/teams`),
  api.get<Record<"NOW" | "NEXT" | "LATER", Initiative[]>>(`/api/domains/${slug}/initiatives`),
]);
```

- [ ] **Step 2: Run domain-page tests**

```bash
cd frontend && pnpm exec playwright test tests/e2e/domain --reporter=line
cd frontend && pnpm exec playwright test tests/e2e/modal-and-popover --reporter=line
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/d
git commit -m "feat(frontend): port domain page to backend API"
```

### Task I.5: Team page (`/t/[slug]`)

**Files:**
- Modify: `frontend/app/t/[slug]/page.tsx`

- [ ] **Step 1: Swap the data calls**

Before:

```tsx
import { getProductsForTeam, getTeamBySlug } from "@/lib/portal-data";
```

After:

```tsx
import { getServerApiClient } from "@/lib/api-client-server";
import { ApiError } from "@/lib/api-client";
import type { Team, Product } from "@/lib/api/generated";

const api = await getServerApiClient();
let team: Team;
try {
  team = await api.get<Team>(`/api/teams/${slug}`);
} catch (err) {
  if (err instanceof ApiError && err.status === 404) notFound();
  throw err;
}
const products = await api.get<Product[]>(`/api/teams/${slug}/products`);
```

- [ ] **Step 2: Run team-page tests**

```bash
cd frontend && pnpm exec playwright test tests/e2e/team --reporter=line
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/t
git commit -m "feat(frontend): port team page to backend API"
```

### Task I.6: Product page (`/p/[slug]`)

**Files:**
- Modify: `frontend/app/p/[slug]/page.tsx`

- [ ] **Step 1: Swap the data calls**

Before:

```tsx
import { getInitiativesForProduct, getProductBySlug } from "@/lib/portal-data";
```

After:

```tsx
import { getServerApiClient } from "@/lib/api-client-server";
import { ApiError } from "@/lib/api-client";
import type { Product, Initiative } from "@/lib/api/generated";

const api = await getServerApiClient();
let product: Product;
try {
  product = await api.get<Product>(`/api/products/${slug}`);
} catch (err) {
  if (err instanceof ApiError && err.status === 404) notFound();
  throw err;
}
const initiatives = await api.get<Initiative[]>(`/api/products/${slug}/initiatives`);
```

- [ ] **Step 2: Run product-page tests**

```bash
cd frontend && pnpm exec playwright test tests/e2e/product --reporter=line
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/p
git commit -m "feat(frontend): port product page to backend API"
```

### Task I.7: Ops dashboards

**Files:**
- Modify: `frontend/app/ops/search/page.tsx`
- Modify: `frontend/app/ops/ai-cost/page.tsx`

- [ ] **Step 1: Inspect what the ops pages currently fetch**

```bash
cd frontend && grep -n "from \"@/lib/" app/ops/search/page.tsx app/ops/ai-cost/page.tsx
```

These pages currently query Prisma directly (via `db.searchEvent.*` or similar) since they're metrics dashboards. The corresponding backend endpoints aren't part of the Group F router set above — they're ops-specific.

- [ ] **Step 2: Add the ops endpoints to the backend**

This step is its own micro-iteration: add `backend/app/api/ops.py` with `/api/ops/search-events` and `/api/ops/ai-parse-metrics` that summarise the relevant tables. Mirror the existing Prisma queries from the pages. Write tests under `backend/tests/api/test_ops.py`. Commit the backend addition before continuing in Step 3.

(Sketch of the backend additions — full implementation written in this task: a `SearchEventsSummary` Pydantic model, an `AiParseMetricSummary` model, repository functions in `backend/app/repositories/ops.py`, and the router. The tests follow the same shape as F.5/F.6.)

- [ ] **Step 3: Swap the page-side data fetching**

After backend endpoints exist:

```tsx
// frontend/app/ops/search/page.tsx (AFTER)
import { getServerApiClient } from "@/lib/api-client-server";
import type { SearchEventsSummary } from "@/lib/api/generated";

const api = await getServerApiClient();
const summary = await api.get<SearchEventsSummary>("/api/ops/search-events");
```

Same shape for `/api/ops/ai-cost`.

- [ ] **Step 4: Run ops e2e tests**

```bash
cd frontend && pnpm exec playwright test tests/e2e/ops --reporter=line
```

Expected: pass (including the existing `ops-ai-cost` test that asserts the over-budget alert tone).

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/ops.py backend/app/repositories/ops.py backend/tests/api/test_ops.py frontend/app/ops
git commit -m "feat(ops): port /ops/search and /ops/ai-cost dashboards to backend API"
```

### Task I.8: Temporarily disable `/upload` and `/approvals` until the write-path port lands

**Files:**
- Modify: `frontend/app/upload/page.tsx`
- Modify: `frontend/app/approvals/page.tsx`

The write-path rewrite is a separate plan (out of scope per §1). Until that lands, the existing `/upload` and `/approvals` UIs would break at cutover (Task K) because they call `portal-data` / Prisma. Two options: take them out of the route table, or render an explicit "temporarily unavailable" notice. The notice keeps the URL working for stakeholder demos.

- [ ] **Step 1: Replace the upload page body with a notice**

Keep the file in place (route stays registered) but render an informational state:

```tsx
// frontend/app/upload/page.tsx (REPLACE BODY)
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Curate"
        title="Add content"
        lede="Upload is temporarily unavailable while we migrate the platform."
      />
      <Section eyebrow="Status" heading="Coming back online soon">
        <Card>
          <p className="text-[var(--color-ink-soft)]">
            The markdown upload + AI parse + approvals workflow is being
            re-platformed alongside the rest of the portal. The read path
            (Domains, Teams, Products, the roadmap matrix, search) continues
            to work as before. The write path returns in a follow-up release
            tracked in the implementation plan for write-path port.
          </p>
        </Card>
      </Section>
    </div>
  );
}
```

- [ ] **Step 2: Do the same for `/approvals`**

```tsx
// frontend/app/approvals/page.tsx (REPLACE BODY)
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";

export default function ApprovalsPage() {
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Curate"
        title="Approvals"
        lede="The approvals queue is temporarily unavailable while we migrate the platform."
      />
      <Section eyebrow="Status" heading="Coming back online soon">
        <Card>
          <p className="text-[var(--color-ink-soft)]">
            Markdown uploads and the approvals queue both pause during the
            platform migration. The published portal content remains available
            for browsing and search.
          </p>
        </Card>
      </Section>
    </div>
  );
}
```

- [ ] **Step 3: Update any tests that asserted upload / approvals UI**

```bash
cd frontend && grep -rn "Upload form\|Approvals queue\|file input" tests/ | head -20
```

For any test that asserts content gone in the new notices, either:
- Update the test to assert the new notice text, or
- Skip the test with `test.skip(...)` and a comment referencing the write-path plan.

- [ ] **Step 4: Run impacted tests**

```bash
cd frontend && pnpm test
cd frontend && pnpm exec playwright test --reporter=line
```

Expected: 199+ Vitest + 62+ e2e tests pass (some may be skipped with a recorded reason).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/upload frontend/app/approvals frontend/tests
git commit -m "feat(frontend): pause upload + approvals UI until write-path port lands"
```

---

## Group J — Search + answer-card (PR 5 part 2)

These are read-path endpoints by classification (§7.1 of the spec) but they involve more than a DB query — search hits the Postgres FTS, answer-card calls Azure OpenAI. They land after the basic routers in Group F because they need extra plumbing.

### Task J.1: Port `/api/search` to backend

**Files:**
- Create: `backend/app/api/search.py`
- Create: `backend/app/repositories/search.py`
- Create: `backend/tests/api/test_search.py`
- Modify: `backend/app/main.py`
- Modify: `frontend/app/search/page.tsx`

- [ ] **Step 1: Inspect the current frontend `/api/search` route handler to understand the query**

```bash
cd frontend && cat app/api/search/route.ts
```

Note the current behaviour: takes a `q` query string, runs an FTS query against `tsvector` columns, returns ranked rows. The Python port reproduces the same SQL via SQLAlchemy `text()` because raw FTS is more legible than translating `to_tsquery` / `ts_rank` into ORM syntax.

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/api/test_search.py
from app.models.jurisdiction import Jurisdiction
from app.models.product import Product
from app.models.product_domain import ProductDomain
from app.db import async_session_factory


async def test_search_returns_matches_for_obvious_query(client):
    async with async_session_factory() as s:
        s.add_all([
            Jurisdiction(id="j1", slug="crime", name="Crime"),
            ProductDomain(id="d1", slug="common-platform", name="Common Platform Domain", jurisdiction_id="j1"),
            Product(id="p1", slug="sign-in", name="Sign In", domain_id="d1", stage="LIVE"),
        ])
        await s.commit()

    resp = await client.get("/api/search?q=sign")
    assert resp.status_code == 200
    results = resp.json()
    assert any(r["slug"] == "sign-in" for r in results["results"])
```

- [ ] **Step 3: Run to confirm failure**

```bash
cd backend && uv run pytest tests/api/test_search.py -v
```

- [ ] **Step 4: Write the repository**

```python
# backend/app/repositories/search.py
from collections.abc import Sequence

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class SearchResult(BaseModel):
    kind: str  # "domain" | "team" | "product"
    slug: str
    name: str
    description: str | None
    rank: float


async def fts_search(session: AsyncSession, query: str, limit: int = 25) -> Sequence[SearchResult]:
    if not query.strip():
        return []
    sql = text("""
        SELECT 'domain' AS kind, slug, name, description,
               ts_rank("ftsTitleBody", websearch_to_tsquery('english', :q)) AS rank
          FROM "ProductDomain"
         WHERE "ftsTitleBody" @@ websearch_to_tsquery('english', :q)
        UNION ALL
        SELECT 'team' AS kind, slug, name, description,
               ts_rank("ftsTitleBody", websearch_to_tsquery('english', :q)) AS rank
          FROM "Team"
         WHERE "ftsTitleBody" @@ websearch_to_tsquery('english', :q)
        UNION ALL
        SELECT 'product' AS kind, slug, name, description,
               ts_rank("ftsTitleBody", websearch_to_tsquery('english', :q)) AS rank
          FROM "Product"
         WHERE "ftsTitleBody" @@ websearch_to_tsquery('english', :q)
        ORDER BY rank DESC
        LIMIT :limit
    """)
    rows = await session.execute(sql, {"q": query, "limit": limit})
    return [
        SearchResult(kind=k, slug=s, name=n, description=d, rank=float(r))
        for k, s, n, d, r in rows.all()
    ]
```

**Caution:** the FTS column name (`ftsTitleBody` above) reflects the existing Prisma migration; verify against `prisma/migrations/20260520000000_search_fts_columns/migration.sql` and adjust to the actual column names. If the Prisma migration used `tsv_title_body` or similar, substitute.

- [ ] **Step 5: Write the router**

```python
# backend/app/api/search.py
from collections.abc import Sequence

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.search import SearchResult, fts_search

router = APIRouter(prefix="/api", tags=["search"])


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(default="", description="Free-text search query"),
    limit: int = Query(default=25, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
) -> SearchResponse:
    results = await fts_search(session, q, limit=limit)
    return SearchResponse(query=q, results=list(results))
```

Add to `main.py`:

```python
from app.api import search
app.include_router(search.router)
```

- [ ] **Step 6: Run**

```bash
cd backend && uv run pytest tests/api/test_search.py -v
```

Expected: pass.

- [ ] **Step 7: Swap the frontend search page to call the backend**

Before (in `frontend/app/search/page.tsx`):

```tsx
import { search } from "@/lib/search";  // or wherever the FTS helper lives
const results = await search(query);
```

After:

```tsx
import { getServerApiClient } from "@/lib/api-client-server";
import type { SearchResponse } from "@/lib/api/generated";

const api = await getServerApiClient();
const response = await api.get<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`);
const results = response.results;
```

- [ ] **Step 8: Delete the now-unused frontend `app/api/search/route.ts` (only after backend port lands)**

```bash
git rm frontend/app/api/search/route.ts
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/api/search.py backend/app/repositories/search.py backend/app/main.py backend/tests/api/test_search.py frontend/app/search frontend/app/api
git commit -m "feat(search): port /api/search to backend (Postgres FTS via SQLAlchemy raw SQL)"
```

### Task J.2: Port `/api/answer-card` to backend

**Files:**
- Create: `backend/app/api/answer_card.py`
- Create: `backend/app/ai/__init__.py`
- Create: `backend/app/ai/answer_card.py`
- Create: `backend/tests/api/test_answer_card.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/settings.py`
- Modify: `frontend/app/api/answer-card/route.ts` (delete) and the calling page

- [ ] **Step 1: Add Azure OpenAI config to settings**

```python
# backend/app/settings.py — add to Settings class
azure_openai_endpoint: str | None = None
azure_openai_api_version: str = "2024-08-01-preview"
azure_openai_deployment_name: str | None = None
```

- [ ] **Step 2: Write the AI module — answer-card synthesis**

```python
# backend/app/ai/answer_card.py
from typing import Any

from openai import AsyncAzureOpenAI

from app.settings import settings


async def synthesise_answer_card(query: str, search_results: list[dict[str, Any]]) -> dict[str, Any]:
    """Synthesise a one-paragraph answer card from the top-N search results.

    Returns shape: { "summary": str, "citations": list[{slug, kind}] }.

    Raises RuntimeError if Azure OpenAI credentials aren't configured —
    callers (the route handler) should map this to a 503 so the frontend
    falls back to "answer card unavailable" per ADR-011.
    """
    if not settings.azure_openai_endpoint or not settings.azure_openai_deployment_name:
        raise RuntimeError("Azure OpenAI not configured")

    client = AsyncAzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.azure_openai_api_version,
        # Auth is via managed-identity in cluster — DefaultAzureCredential is
        # picked up automatically when no api_key is supplied.
    )
    summary_input = "\n".join(
        f"- [{r['kind']}] {r['name']}: {r.get('description') or ''}".rstrip()
        for r in search_results[:5]
    )

    response = await client.chat.completions.create(
        model=settings.azure_openai_deployment_name,
        messages=[
            {
                "role": "system",
                "content": (
                    "You answer questions about the DTS portfolio in one short "
                    "paragraph using ONLY the supplied search results. Cite each "
                    "result you draw on by its slug. Never invent facts."
                ),
            },
            {
                "role": "user",
                "content": f"Question: {query}\n\nSearch results:\n{summary_input}",
            },
        ],
        temperature=0.2,
        max_tokens=200,
    )

    return {
        "summary": response.choices[0].message.content or "",
        "citations": [{"kind": r["kind"], "slug": r["slug"]} for r in search_results[:5]],
    }
```

Create `backend/app/ai/__init__.py` (empty marker).

- [ ] **Step 3: Write the failing test for the route**

```python
# backend/tests/api/test_answer_card.py
from unittest.mock import AsyncMock, patch


async def test_answer_card_returns_synthesised_response(client):
    fake = {
        "summary": "Sign In runs identity flows for Crime services.",
        "citations": [{"kind": "product", "slug": "sign-in"}],
    }
    with patch("app.api.answer_card.synthesise_answer_card", new=AsyncMock(return_value=fake)):
        resp = await client.post(
            "/api/answer-card",
            json={"query": "who runs sign in?", "results": [{"kind": "product", "slug": "sign-in", "name": "Sign In", "description": ""}]},
        )
    assert resp.status_code == 200
    assert resp.json()["summary"].startswith("Sign In")


async def test_answer_card_returns_503_when_aoai_unconfigured(client):
    async def boom(*_args, **_kwargs) -> dict[str, str]:
        raise RuntimeError("Azure OpenAI not configured")

    with patch("app.api.answer_card.synthesise_answer_card", new=boom):
        resp = await client.post(
            "/api/answer-card",
            json={"query": "x", "results": []},
        )
    assert resp.status_code == 503
```

- [ ] **Step 4: Run to confirm failure**

```bash
cd backend && uv run pytest tests/api/test_answer_card.py -v
```

- [ ] **Step 5: Write the router**

```python
# backend/app/api/answer_card.py
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.ai.answer_card import synthesise_answer_card

router = APIRouter(prefix="/api", tags=["answer-card"])


class AnswerCardRequest(BaseModel):
    query: str
    results: list[dict[str, Any]]


class Citation(BaseModel):
    kind: str
    slug: str


class AnswerCardResponse(BaseModel):
    summary: str
    citations: list[Citation]


@router.post("/answer-card", response_model=AnswerCardResponse)
async def answer_card(payload: AnswerCardRequest) -> AnswerCardResponse:
    try:
        result = await synthesise_answer_card(payload.query, payload.results)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return AnswerCardResponse(**result)
```

Add to `main.py`:

```python
from app.api import answer_card
app.include_router(answer_card.router)
```

- [ ] **Step 6: Run**

```bash
cd backend && uv run pytest tests/api/test_answer_card.py -v
```

Expected: both tests pass.

- [ ] **Step 7: Swap the frontend caller and remove the old Next.js route handler**

```bash
cd frontend && grep -rn "answer-card" app/ components/ lib/
```

For each caller, switch from the old in-Next.js `fetch("/api/answer-card", ...)` to using `getServerApiClient()` (server side) or a direct same-origin fetch (client side, since Caddy proxies `/api/*` to the backend). Most callers are likely server-side.

Then delete the now-orphaned Next.js handler:

```bash
git rm frontend/app/api/answer-card/route.ts
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/api/answer_card.py backend/app/ai backend/tests/api/test_answer_card.py backend/app/settings.py backend/app/main.py frontend/app
git commit -m "feat(answer-card): port to backend; AOAI with managed-identity auth"
```

---

## Group K — Cutover (PR 8)

After Groups A-J land, every page reads from the Python backend. The old Prisma stack is dead code that still imports cleanly. This group rips it out.

### Task K.1: Delete `frontend/lib/portal-data.ts` + `portal-data-seed.ts`

**Files:**
- Delete: `frontend/lib/portal-data.ts`
- Delete: `frontend/lib/portal-data-seed.ts`

- [ ] **Step 1: Verify no remaining imports**

```bash
cd frontend && grep -rn "@/lib/portal-data" .
```

Expected: no results (or only commented references). If real imports remain, that page or test missed a port — back to Group I before continuing.

- [ ] **Step 2: Delete the files**

```bash
git rm frontend/lib/portal-data.ts frontend/lib/portal-data-seed.ts
```

- [ ] **Step 3: Verify the test suite still passes**

```bash
cd frontend && pnpm typecheck && pnpm test
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(cutover): remove frontend/lib/portal-data* (replaced by backend API)"
```

### Task K.2: Delete `frontend/lib/entities.ts` + `frontend/lib/db.ts`

**Files:**
- Delete: `frontend/lib/entities.ts`
- Delete: `frontend/lib/db.ts`

- [ ] **Step 1: Verify imports**

```bash
cd frontend && grep -rn "@/lib/entities" .
cd frontend && grep -rn "@/lib/db" .
```

Expected: no results. The replacement types come from `@/lib/api/generated`.

- [ ] **Step 2: Delete**

```bash
git rm frontend/lib/entities.ts frontend/lib/db.ts
```

- [ ] **Step 3: Typecheck + tests**

```bash
cd frontend && pnpm typecheck && pnpm test
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(cutover): remove frontend Zod schemas + Prisma client (replaced by generated types)"
```

### Task K.3: Delete `frontend/prisma/` and Prisma dependencies

**Files:**
- Delete: `frontend/prisma/`
- Modify: `frontend/package.json`
- Update: `frontend/pnpm-lock.yaml`

- [ ] **Step 1: Delete the prisma directory**

```bash
git rm -r frontend/prisma
```

- [ ] **Step 2: Remove Prisma packages**

```bash
cd frontend && pnpm remove @prisma/client @prisma/adapter-pg prisma
```

This updates `package.json` and regenerates `pnpm-lock.yaml`.

- [ ] **Step 3: Remove any Prisma-related scripts from package.json**

In `frontend/package.json`, delete any `"db:*"` script that referenced Prisma:

```json
{
  "scripts": {
    "db:migrate:dev": "...",            // delete
    "db:migrate:deploy": "...",         // delete
    "db:migrate:status": "...",         // delete
    "db:seed": "...",                   // delete
    "db:studio": "..."                  // delete
  }
}
```

The equivalent Python tooling lives under `make backend-migrate` (already in Task A.4).

- [ ] **Step 4: Verify**

```bash
cd frontend && pnpm typecheck && pnpm test
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "chore(cutover): remove prisma/ directory and Prisma packages from frontend"
```

### Task K.4: Delete orphaned `frontend/app/api/*` route handlers

**Files:**
- Delete: every directory under `frontend/app/api/` whose handler was ported to the backend

- [ ] **Step 1: Enumerate remaining handlers**

```bash
cd frontend && find app/api -name "route.ts" -o -name "route.tsx"
```

- [ ] **Step 2: For each route, confirm the backend equivalent exists and the frontend has no callers**

For each result from Step 1:
- Verify `backend/app/api/<equivalent>.py` exists, OR
- Confirm the handler is for write-path UI (still routed but disabled in Task I.8 — leave the directory in place but ensure the route.ts itself isn't doing DB work; ideally just a 410-style handler).

- [ ] **Step 3: Delete every fully-ported handler**

```bash
git rm -r frontend/app/api/search frontend/app/api/answer-card  # plus any others
```

- [ ] **Step 4: Verify Caddy routes everything correctly**

```bash
docker compose up -d
sleep 10
curl -fsS http://localhost:3000/api/health         # → backend
curl -fsS http://localhost:3000/api/matrix > /dev/null && echo "matrix OK"
curl -fsS http://localhost:3000/api/search?q=sign > /dev/null && echo "search OK"
```

Expected: all three succeed (Caddy reverse-proxies `/api/*` to the backend; the frontend no longer needs a Next.js API route for any of these).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(cutover): remove Next.js API routes whose handlers ported to the backend"
```

### Task K.5: End-to-end cutover smoke test

- [ ] **Step 1: Bring up the stack fresh**

```bash
docker compose down -v
docker compose up -d
sleep 15
```

- [ ] **Step 2: Run the full frontend test suite**

```bash
cd frontend && pnpm typecheck
cd frontend && pnpm test
cd frontend && pnpm exec playwright test --reporter=line
```

Expected: typecheck clean; Vitest 199+ tests pass; Playwright 62+ tests pass.

- [ ] **Step 3: Run the full backend test suite**

```bash
cd backend && uv run pytest -v
```

Expected: all model + repository + API tests pass.

- [ ] **Step 4: Manual smoke walk-through**

Open <http://localhost:3000> and click through:
- Home (matrix + activity feed)
- Sidebar (each Jurisdiction expands)
- Each Jurisdiction page
- One Domain page → Edit a Domain (read-only flow only at this point)
- One Team page
- One Product page
- Search (use a known query)
- `/ops/search` and `/ops/ai-cost`
- `/upload` (renders the "temporarily unavailable" notice)
- `/approvals` (same)

Expected: every page renders identically to pre-cutover. No console errors. No 500s in `docker compose logs backend`.

- [ ] **Step 5: Update CLAUDE.md to reflect the new stack**

Edit the "Engineering standards" section and the "Stack at a glance" table in the README to mention:
- Backend: FastAPI / Python 3.12+
- Frontend: Next.js (App Router, standalone output)
- Containers: monorepo, two images, Caddy bridge

- [ ] **Step 6: Commit + push the cutover PR for review**

```bash
git add README.md CLAUDE.md
git commit -m "docs: reflect the post-cutover monorepo stack"
git push -u origin HEAD
gh pr create --title "Cutover: Prisma deleted, all read-path served from Python backend" \
  --body "Per the implementation plan, this PR removes the old Prisma stack now that every page reads from the backend. See docs/superpowers/plans/2026-05-21-python-k8s-restack.md for the full sequence."
```

---

## Self-review (writing-plans skill checklist)

After writing the full plan, fresh-eyes pass against the spec at `docs/superpowers/specs/2026-05-21-python-k8s-restack-design.md`.

**1. Spec coverage**

| Spec section | Covered by |
|---|---|
| §3 Repository topology, monorepo, split-ready | Group A (whole) |
| §3.3 Infra repo unchanged in topology | Out of scope for this plan — recorded in §1 of plan as deferred |
| §4 Backend service: framework, runtime, identity, AI, local dev | Groups B (1-6), F.0 (identity stub), J.2 (AI), B.5-B.6 (compose) |
| §5 Frontend service: framework retained, container shape, typed client, RSC vs CC split, auth gate | Groups G, H, I (whole). Auth gate `proxy.ts` is implicit in I.8's notice; explicit `proxy.ts` middleware is part of the write-path port plan |
| §6 Data layer: ORM, migrations, baseline, FTS, repositories | Groups C, D, E (whole) |
| §7.1 Read-path endpoints table | Group F + Group J (Group F covers GET endpoints; J covers search + answer-card) |
| §7.2 Write-path deferred | Group I.8 disables the UI; the actual port is its own future plan |
| §7.3 Error categories | Implicit in router `HTTPException(status_code=404)` + the global FastAPI exception handler (default) |
| §8.1 What carries over | Group A.1 (moves frontend code intact); Group C (baseline preserves the schema) |
| §8.2 What is deleted at cutover | Group K (whole) |
| §8.3 ADR impact | Recorded in the spec; this plan does not author the new ADRs (the spec marks 012+ as "exact numbering chosen when written") — those would be a small follow-up task before merging the spec PR |
| §8.4 Sequencing (PRs 1-9) | Group structure mirrors the PR layout: A=PR1, B=PR2, C=PR3, D+E=PR4, F+J=PR5, G+H=PR6, I=PR7 (multiple), K=PR8. PR9 (write-path) is the next plan. |
| §8.5 Cutover criteria | Task K.5 |
| §8.6 Demo continuity | Implicit — Groups A through I-7 don't delete anything Prisma-backed; cutover only at K |
| §9 Out of scope | Recorded at the top of this plan + §11 below |
| §10 Open questions for PlatOps | Surfaced for the implementer in the relevant tasks (auth header names in F.0, Caddy env var in G.1, image registry in Group G note about VERSION arg) |
| §11 Boundaries | Implicit in the deletion list (Group K) and the carry-over (Group A.1) |

**Gaps identified during review:**
- New ADRs (012+) to be authored as a small follow-up task before this plan executes — added a note to §1 of the plan to surface this.
- The `proxy.ts` middleware for auth gating doesn't have an explicit task. It depends on landing-zone-specific auth header / cookie names. **Decision:** intentionally deferred — the middleware lands when the auth mechanism is concrete (in the write-path port plan or its own small spec). The current plan keeps every page reachable without an auth gate in app code, which matches today's behaviour (Easy Auth gates at platform edge).

**2. Placeholder scan**

Searched the plan for "TBD", "TODO", "implement later", "fill in details", "Add appropriate error handling", "Add validation", "Handle edge cases", "Write tests for the above", "Similar to Task". None found. Every step has actual content or a clearly-scoped action.

**3. Type / signature consistency**

| Type | Defined in | Used in |
|---|---|---|
| `Identity` | F.0 | unused by read-path routes (correct — read-path is anonymous-friendly) |
| `MatrixInitiative`, `MatrixDomainRow`, `MatrixJurisdictionBand` | E.1 | F.1, I.1 |
| `SidebarJurisdiction`, `SidebarDomain` | E.7 | F.3, I.2 |
| `SearchResult`, `SearchResponse` | J.1 | I.7 (ops uses different shapes — its own models in I.7) |
| Generated TS types: `MatrixJurisdictionBand`, `ActivityEntry`, `Jurisdiction`, etc. | H.1 (codegen) | I.1 through I.6 |

Reference shapes match between Python repository return types and TS generated types because the FastAPI `response_model=` declaration is the single source of truth.

**4. Public-repo safety**

Confirmed during write:
- No reference repo named directly in the plan
- No internal hostnames, stakeholder names, Sentry orgs, PostHog keys, or specific JWT cookie names
- The auth dependency uses generic `X-Forwarded-Email` / `X-Forwarded-User` names — common to multiple OIDC sidecars and not specific to any one HMCTS internal pattern
- All examples use `example.com` for outbound URLs and `*.test@example.com` for fixture emails
- The Caddyfile env var is named `PORTAL_BACKEND_URL` (project-scoped, generic), not an internal pattern lifted verbatim
- `hmctsprod.azurecr.io` appears nowhere in the plan (it's only in the spec's deferred-items table, which is appropriate per the existing public ADRs)

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-21-python-k8s-restack.md`.

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, with two-stage review (spec compliance, then code quality) between each. Best fit because the tasks are well-bounded, mostly independent within a group, and the read-path rewrite is the kind of mechanical-but-detailed work where a fresh context per task keeps the changes focused.

**2. Inline execution** — I work through the tasks in this session using `superpowers:executing-plans`. Slower; risks context bloat across ~50+ tasks.

**Which approach?**
