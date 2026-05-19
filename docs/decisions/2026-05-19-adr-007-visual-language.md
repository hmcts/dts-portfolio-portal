# ADR-007: Visual language tooling

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** DTS Portfolio Portal team

## Context

The requirements spec (§6.6) describes the visual language as principles: calm, near-monochrome modern SaaS register (Linear / Vercel / Notion, not GOV.UK transactional); Geist sans; 8px spacing base; generous radii; hairline borders; status pills carrying icon-or-text alongside colour. This ADR picks the *tooling* that delivers those principles consistently.

The stack-design spec (§5.1, §10) locks Tailwind CSS + shadcn/ui + Lucide + Geist.

## Options considered

### Option A — Tailwind CSS + shadcn/ui + Lucide + Geist

Tailwind for utility CSS; shadcn/ui as a copy-paste primitive library (we own the component code, no runtime dependency); Lucide as the icon family with consistent stroke weight; Geist via `next/font` for the UI typeface. Aligns naturally with Next.js + React. Selected.

### Option B — Custom design system

Build component primitives from scratch. Rejected as over-investment for v1 — the visual language is well-served by shadcn primitives, and the copy-paste model means we can still own and customise the code.

### Option C — Material UI (MUI) / Chakra UI

Mature component libraries with rich primitives. Rejected: heavier runtime dependency; opinion drift from the calm-monochrome aesthetic (MUI defaults are Material; Chakra defaults are more colourful than the spec wants).

## Decision

Tailwind CSS configured with CSS-variable design tokens; shadcn/ui primitives copied in (Button, Card, Dialog, DropdownMenu, etc.) and themed via the Tailwind tokens; Lucide as the only icon family; Geist (sans) served via `next/font` for UI, with optional humanist variable serif (e.g. Inter or Source Serif) for marquee surfaces per §6.6. Status pills always carry an icon or text label — colour is never load-bearing alone (§8.1).

Token inventory matches §6.6: 8px spacing base, 14–16px card radii, fully-rounded pills, status colour palette (green / amber / red / blue / grey), eyebrow type style, body type scale.

## Consequences

- The icon family is locked early to avoid bikeshedding — Lucide only, no mixing.
- Ad-hoc component CSS is disallowed in code review to keep the calm look intact.
- shadcn copy-paste means we own the component code in `src/components/ui/` — we accept the responsibility for updating those components if upstream improvements ship.
- Tailwind purges unused styles at build time, keeping the production CSS bundle small.

## References

- Requirements spec §6.6, §8.1
- Stack-design spec §5.1, §10
- The standalone prototype at `docs/prototype/DTS Portfolio Portal - standalone.html` is the visual reference Phase 1 builds against
