#!/usr/bin/env bash
#
# scripts/demo.sh — bring up a local demo of the post-cutover stack
# in one command:
#
#   1. ensure docker is running
#   2. bring up the docker compose stack (db + backend + frontend + Caddy)
#   3. block until all services are healthy
#   4. confirm /api/health responds through the frontend's Caddy proxy
#   5. print where to open the browser + what's visible vs stubbed
#
# Idempotent — running it twice is a no-op on warm containers.
#
# The compose images bundle their own dependencies. This script does
# NOT run pnpm install, uv sync, or any host-side dep install. If you
# want to develop on the host with hot-reload, use the Setup (manual)
# section of the README instead.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

FRONTEND_PORT="${PORT:-3000}"
HEALTH_URL="http://localhost:${FRONTEND_PORT}/api/health"

# Colour helpers — fall back to plain text if stdout is not a TTY
if [ -t 1 ]; then
  green()  { printf '\033[0;32m%s\033[0m\n' "$1"; }
  yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
  red()    { printf '\033[0;31m%s\033[0m\n' "$1"; }
else
  green()  { echo "$1"; }
  yellow() { echo "$1"; }
  red()    { echo "$1"; }
fi

step() { yellow "▸ $1"; }

# ---- 1. docker check --------------------------------------------------------

step "Checking Docker is running"
if ! docker info > /dev/null 2>&1; then
  red "Docker isn't running. Start Docker Desktop / OrbStack / Colima and retry."
  exit 1
fi
green "  Docker is up."

# ---- 2. compose up ----------------------------------------------------------

step "Bringing up the compose stack (db + backend + frontend)"

# Prefer --wait if the local compose CLI supports it (Docker Compose v2.18+).
# --wait blocks until every service with a healthcheck reports healthy, which
# includes the Alembic migration that runs inside the backend's start.sh —
# no need to run migrations from the host.
if docker compose up --help 2>&1 | grep -q -- '--wait'; then
  docker compose up -d --wait
else
  docker compose up -d
  step "Compose CLI is older than v2.18; polling /api/health manually"
  for i in $(seq 1 60); do
    if curl -fsS "$HEALTH_URL" > /dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi
green "  Stack is up."

# ---- 3. smoke test ----------------------------------------------------------

step "Smoke-testing /api/health through Caddy"
if ! curl -fsS "$HEALTH_URL" > /dev/null; then
  red "Failed to reach $HEALTH_URL. Check 'docker compose logs' for errors."
  exit 1
fi
green "  /api/health is responding."

# ---- 4. print summary -------------------------------------------------------

cat <<EOF

$(green "All good.")

Open the portal:
  $(green "http://localhost:${FRONTEND_PORT}")

What works:
  • Home (cross-DTS roadmap matrix + activity feed)
  • Sidebar (Jurisdictions → Domains)
  • Entity pages: /j/<slug>, /d/<slug>, /t/<slug>, /p/<slug>
  • Search (/search?q=...) and /ops/* dashboards
  • Health probe: /api/health

What's temporarily stubbed (write-path port pending):
  • /upload (renders a "temporarily unavailable" notice)
  • /approvals (same)

To bring it down:
  $(yellow "make down")    or    $(yellow "docker compose down")

To stream logs:
  $(yellow "make logs")
EOF
