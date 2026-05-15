# Working in this repo with Claude

The portal is built spec-first. Read the relevant artefact before changing behaviour.

## Workflow

Non-trivial work follows **brainstorm → spec → plan → (per-phase TDD plan) → execute**.

- Specs: `docs/superpowers/specs/`
- Plans: `docs/superpowers/plans/`
- ADRs: `docs/decisions/`

Before executing any phase, refine its tasks into TDD-grade steps once the architecture for that phase is locked.

## Two principles to internalise

1. **High-altitude is non-negotiable.** The portal surfaces DTS at portfolio altitude. Operational detail belongs in Ardoq / Jira / Confluence — link to them, never duplicate them. Anything that looks like a KPI dashboard or Jira-ticket plumbing has gone wrong. A previous attempt failed precisely by going too deep too early; do not repeat that.
2. **Architecture is deferred to Phase 0.** Until ADRs land in `docs/decisions/`, do not assume a web framework, content store, auth provider or hosting platform. Refining Phase 1+ tasks into code-level detail before their dependent ADR exists is a process failure.

## Markdown is canonical for content

Per spec §7, entities (Domains, Teams, Products) are authored as markdown with strict YAML front-matter for identity and loose section bodies. AI translates loose markdown into structured fields; a human approves before publish. Source markdown is stored append-only as audit.

Do not introduce structured forms or rich-text editors. Markdown upload is the authoring path.

## Out of scope

See the requirements spec §3.2 for the full list. Items most likely to drift back in (don't let them):

- ChangeLog per-field audit
- RBAC plumbing
- Galaxy / constellation visualisation
- KPI tile strips
- Submission wizards
- Comments / threads / @-mentions
- Exports (Excel / Word / PowerPoint)
- Initiative as a first-class page

## Naming

Per the spec glossary: **Jurisdiction**, **Product Domain** (or Domain), **Team**, **Product**, **Initiative**.

- The Team that runs a Product day-to-day is its **operating Team** (operational owner).
- The Domain that sets direction is the **strategic owner**.
- A Product used outside its own Jurisdiction is **consumed by** that Jurisdiction. Avoid "cross-cutting" or "shared services".

## Out-of-scope for any artefact

Do not name-drop the MoJ Justice AI Unit "AI for All" portal in any spec, design doc, code, README, commit message, or PR description. Lead with the DTS problem statement instead.
