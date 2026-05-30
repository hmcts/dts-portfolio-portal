# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base

# pnpm via corepack, pinned to match package.json's packageManager field.
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# ---- deps ----------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Install without running postinstall (which calls scripts outside the build
# context). We run the postinstall step explicitly below.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --ignore-scripts --store-dir=/pnpm-store

# Stub next-env.d.ts so TypeScript is happy during the build stage.
# (Normally written by scripts/write-next-env.mjs from postinstall; that
# script lives outside the build context so we replicate its minimal stub.)
RUN printf '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n' > ./next-env.d.ts

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

# Standalone runtime: server.js + node_modules + public/ + .next/static
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
