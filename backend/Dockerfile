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
