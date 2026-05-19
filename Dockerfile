# syntax=docker/dockerfile:1.7

# Multi-stage build for the Next.js production image.
# Stage 1: install deps  → Stage 2: build  → Stage 3: minimal runtime.
# Final image runs as a non-root user and serves the Next.js standalone
# output — small image, fast start, identical to App Service runtime.

ARG NODE_VERSION=22-alpine

# ---------- deps ----------
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

# Install pnpm with the same version the project pins.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- builder ----------
FROM node:${NODE_VERSION} AS builder
RUN corepack enable
WORKDIR /app

# Bring deps over from the previous stage to skip a second install.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the Prisma client. DATABASE_URL not needed for generate; we
# pass a placeholder so the runtime adapter import resolves cleanly.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm exec prisma generate

# Next.js standalone output bundles only the files the server needs.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---------- runner ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user — App Service runs containers with a randomised UID but
# we set our own for parity with local Docker runs and the AKS path.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Build-arg version label embedded in /app/CHANGELOG.md by CI when a
# release is published; in dev builds the placeholder above keeps the
# COPY honest.
ARG VERSION="0.0.0-dev"
ENV APP_VERSION=${VERSION}

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health endpoint hit by App Service liveness + docker-compose smoke.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/healthz || exit 1

CMD ["node", "server.js"]
