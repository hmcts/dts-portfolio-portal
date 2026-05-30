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
