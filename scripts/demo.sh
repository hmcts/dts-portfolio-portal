#!/usr/bin/env bash
#
# scripts/demo.sh — bring up a local demo environment from a cold
# clone in one command:
#
#   1. ensure docker is running
#   2. ensure a local Postgres container is up + healthy
#   3. install JS dependencies if needed
#   4. apply Prisma migrations
#   5. start `pnpm dev` and tail until it's ready
#   6. print a quick rundown of what's visible vs what isn't
#
# Idempotent — running it twice on a warm environment is a no-op
# except for the dev server start. Designed for the "can I see
# where this is at?" question, not for production-shaped runs.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PG_CONTAINER="portal-db"
PG_IMAGE="postgres:17-alpine"
PG_PORT="${PORTAL_DEMO_PG_PORT:-5432}"
APP_PORT="${PORT:-3000}"

# Pin DATABASE_URL to the local container regardless of what the
# user has exported. Some umbrella .envrc files set DATABASE_URL to
# a non-local service (see security-database-url-token memory) —
# overriding here keeps the demo deterministic.
export DATABASE_URL="postgresql://portal:portal@localhost:${PG_PORT}/portal?schema=public"

# Demo defaults — don't fight the e2e suite if it shares the DB.
# AI_PARSER_FORCE_FALLBACK keeps uploads off the real Azure OpenAI
# client (the demo doesn't need AOAI to be useful). The user can
# unset it later to wire AOAI in.
export AI_PARSER_FORCE_FALLBACK="${AI_PARSER_FORCE_FALLBACK:-true}"

ok()   { printf "\033[32m✓\033[0m %s\n" "$*"; }
info() { printf "  %s\n" "$*"; }
warn() { printf "\033[33m!\033[0m %s\n" "$*"; }
die()  { printf "\033[31m✗\033[0m %s\n" "$*" >&2; exit 1; }

# ---------- 1. docker ----------
if ! command -v docker >/dev/null 2>&1; then
  die "docker is not installed. Install Docker Desktop or colima first."
fi
if ! docker info >/dev/null 2>&1; then
  die "docker is not running. Start Docker Desktop (or 'colima start') and re-run."
fi
ok "docker is running"

# ---------- 2. postgres ----------
if docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  ok "postgres container '$PG_CONTAINER' already running"
elif docker ps -a --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  info "starting existing '$PG_CONTAINER' container"
  docker start "$PG_CONTAINER" >/dev/null
  ok "postgres container started"
else
  info "no '$PG_CONTAINER' container — creating one (image $PG_IMAGE, host port $PG_PORT)"
  docker run -d --name "$PG_CONTAINER" \
    -p "${PG_PORT}:5432" \
    -e POSTGRES_USER=portal \
    -e POSTGRES_PASSWORD=portal \
    -e POSTGRES_DB=portal \
    "$PG_IMAGE" >/dev/null
  ok "postgres container created"
fi

# Wait for pg_isready inside the container.
info "waiting for postgres to accept connections..."
ATTEMPTS=0
until docker exec "$PG_CONTAINER" pg_isready -U portal -d portal -q 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -gt 30 ]; then
    die "postgres did not become ready after 30 attempts; check 'docker logs $PG_CONTAINER'"
  fi
  sleep 1
done
ok "postgres is ready on localhost:$PG_PORT"

# ---------- 3. node deps ----------
if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-installed-marker 2>/dev/null ]; then
  info "installing pnpm dependencies"
  pnpm install --frozen-lockfile
  touch node_modules/.package-installed-marker 2>/dev/null || true
  ok "dependencies installed"
else
  ok "dependencies up to date"
fi

# ---------- 4. prisma migrate ----------
info "applying Prisma migrations"
pnpm db:migrate:deploy 2>&1 | sed 's/^/    /' | tail -5
ok "migrations applied"

# ---------- 5. dev server ----------
# Stop anything already on the port — local dev pattern.
if lsof -i ":${APP_PORT}" -t >/dev/null 2>&1; then
  info "stopping process already on port $APP_PORT"
  lsof -i ":${APP_PORT}" -t | xargs -r kill 2>/dev/null || true
  sleep 1
fi

info "starting dev server (will background; logs at /tmp/portal-demo.log)"
pnpm dev > /tmp/portal-demo.log 2>&1 &
DEV_PID=$!
echo "$DEV_PID" > /tmp/portal-demo.pid

# Wait for /healthz to respond.
ATTEMPTS=0
until curl -sf "http://localhost:${APP_PORT}/healthz" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -gt 60 ]; then
    warn "dev server didn't respond after 60s — check /tmp/portal-demo.log"
    break
  fi
  sleep 1
done
ok "dev server up at http://localhost:${APP_PORT} (pid $DEV_PID)"

# ---------- 6. rundown ----------
cat <<EOF

────────────────────────────────────────────────────────────────────
  DTS Portfolio Portal — local demo ready
────────────────────────────────────────────────────────────────────

  Open:           http://localhost:${APP_PORT}

  What works out of the box (reads from src/lib/seed.ts):
    /                       home matrix with all 5 Jurisdictions
    /j/crime, /j/civil, …   Jurisdiction pages
    /d/<slug>               Domain pages
    /t/<slug>               Team pages
    /p/<slug>               Product pages
    /upload                 markdown upload form
    /help                   templates + keyboard shortcuts
    Hotkeys                 "/" or ⌘K to focus search

  Visible but empty (reads from Postgres — empty until you author):
    /approvals              upload + approve to populate
    /ops/ai-cost            populates as parses happen
    /ops/search             populates as searches happen
    Search overlay          returns "No matches" against an empty DB

  Stopped working locally (deliberate):
    Azure OpenAI            AI_PARSER_FORCE_FALLBACK=true forces the
                            strict-template fallback parser.
    Answer card             /api/answer-card returns "unavailable"
                            until AZURE_OPENAI_ENDPOINT is set.

  Stop the dev server:
    kill \$(cat /tmp/portal-demo.pid)

  Stop everything (incl. postgres):
    kill \$(cat /tmp/portal-demo.pid); docker stop ${PG_CONTAINER}

EOF
