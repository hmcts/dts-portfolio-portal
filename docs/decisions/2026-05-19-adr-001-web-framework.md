# ADR-001: Web framework and rendering

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** DTS Portfolio Portal team

## Context

The requirements spec (§5, §6) requires server-rendered pages with deep-linkable modal overlays, accessible focus management, markdown rendering, OIDC integration, and a streaming response path for the LLM-backed search overlay. The portal is read-heavy and broadcast-style; aggressive caching is appropriate (§8.2).

The stack-design spec (§3, §10) locks Next.js (App Router) + React + TypeScript as the web framework. This ADR records that decision and the alternatives considered.

## Options considered

### Option A — Next.js (App Router)

SSR + React Server Components by default; deep-linkable parallel routes that map naturally to modal-as-detail (§6.2); first-class accessibility primitives; large ecosystem; team familiarity. Native fit for App Service for Linux as a single Node artefact. Selected.

### Option B — Astro

Content-first, smaller bundles, fully-supported SSR on Azure Static Web Apps. Excellent fit for the read-heavy portal, with React/Vue/Svelte "islands" only where interactivity is needed. Rejected on maintenance-familiarity grounds — Next.js is the framework most JS/TS developers reach for first.

### Option C — SvelteKit

Smaller bundles than Next; mature SSR; sound accessibility primitives. Smaller component ecosystem for shadcn-style primitives the visual language depends on. Rejected for the same maintenance-familiarity reason as Astro, with an additional cost on the visual-language tooling side.

### Option D — Remix, Hugo, Eleventy

Remix has a smaller ecosystem and less SSR ergonomics than Next App Router. Hugo and Eleventy are static-only and cannot host the AI parse / approval flows required for v1. Rejected.

## Decision

Next.js (App Router) with React Server Components for read paths and client components limited to the interactive surfaces (approval screen, search overlay, modal-as-detail). TypeScript throughout.

## Consequences

- React/Node lock-in. Migration away is a rewrite, not a port.
- Discipline of "no heavy client components in marquee pages" is needed to hit the 2-second home-page budget (§8.2). Enforce via code review and Lighthouse CI in Phase 5.
- App Service for Linux (Web App for Containers) becomes the natural hosting target — sole Node artefact, no hybrid-mode caveats (see ADR-006).
- shadcn/ui copy-paste primitives (see ADR-007) integrate cleanly.
- Streaming responses for the search answer card (§6.1) work via Next.js Route Handlers returning `ReadableStream`.

## References

- Requirements spec §5, §6, §8.2
- Stack-design spec §3, §5.1, §10
- ADR-006 (hosting), ADR-007 (visual language)
