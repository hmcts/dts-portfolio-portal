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
