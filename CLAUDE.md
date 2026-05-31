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
2. **Architecture is locked at the design level.** The stack is decided in [`docs/superpowers/specs/2026-05-19-azure-stack-design.md`](docs/superpowers/specs/2026-05-19-azure-stack-design.md). Phase 0 ADRs ratify these decisions; they do not re-litigate them. Defer to the stack-design spec; if a new question genuinely arises that the spec doesn't answer, surface it and update the spec, don't quietly invent an answer.

## Stack summary (post Group K cutover)

- **Frontend**: Next.js App Router + TypeScript, standalone output, multi-stage Dockerfile.
- **Backend**: FastAPI + Python 3.12+, SQLModel (Pydantic + SQLAlchemy 2.0) + Alembic. Owns all DB access; no Prisma.
- **Containers**: two images (frontend + backend) + Caddy reverse proxy, managed in one Docker Compose file.
- **Database**: Postgres. Migrations live in `backend/alembic/`. The `pnpm db:*` commands no longer exist.

## Engineering standards

These hold across both repos (`dts-portfolio-portal` and `dts-portfolio-portal-infra`). When they conflict with default Claude behaviour, these win.

### Code in the open

The app repo is public; the infra repo is internal with intent to publish. Default to "what does someone outside HMCTS infer from this?" for every file.

- No secrets in code or commit history. `.env*` files are gitignored; pre-commit `gitleaks` enforces.
- No connection strings with passwords. Use Microsoft Entra authentication for every service that supports it; the SDK pattern is `DefaultAzureCredential`.
- No hardcoded subscription IDs, tenant IDs, object IDs — variables read from GitHub Secrets at apply time.
- No internal hostnames, IPs, or stakeholder names in code, comments, fixtures, or commit messages.
- No real PII in seed data, fixtures, or test data. Use plausible-but-fictional HMCTS-flavoured names.
- Jira ticket references in commit messages are fine (`PORT-1234`); paste content from internal systems is not.
- Issues, PRs, and discussions are assumed public — don't paste error messages containing real data or internal hostnames.

### Test-driven development

Untested code is not done. CI gates a coverage threshold; failing tests block merges.

- Tests precede code. Red → green → refactor on every change.
- Coverage threshold: 80% line / 70% branch initially; tightened over time.
- Prefer pure functions for parsing, validation, ranking, formatting — pushed to the edges, easy to test in isolation. I/O (DB, AOAI, HTTP) goes behind thin adapters.
- Small testable units. If a function doesn't fit on a screen, split it.
- Integration tests against real services where reasonable — DB tests run against a service Postgres in CI per `db-migration-check.yml` and `tests.yml`.

### Reuse over re-invention

`hmcts/courtstranscribe` is the precedent for DTS-side patterns: versioning, CHANGELOG generation, ACR push, secrets scanning, deploy tags, two-Terraform-roots structure, Makefile plan/apply pattern.

- When courtstranscribe has a precedent, copy it. Adapt only with a documented reason in a comment that points at the constraint that drove the adaptation.
- Resist "improvements" that drift from the reference. A patch that improves *and* drifts is a patch that costs sync overhead later. Prefer to upstream improvements to courtstranscribe.

### Two-repo topology

- This repo (`hmcts/dts-portfolio-portal`) — **public** — carries the Next.js frontend, FastAPI Python backend, Alembic migrations, Dockerfiles, CI workflows, and docs.
- `hmcts/dts-portfolio-portal-infra` — **internal** — carries Terraform (`infrastructure/` + `platform/` roots) and the deploy workflows triggered via cross-repo `repository_dispatch`.
- The cross-repo dispatch step is **gated by repo variable `INFRA_DISPATCH_ENABLED`**, default `false`. Flipping to `true` is a manual action once the Azure estate is provisioned.
- Never put Terraform in the app repo. Never put app code in the infra repo.

### Secrets handling

Per the global `~/.claude/CLAUDE.md` secrets section, with project additions:

- Never read full secret values into the assistant's context. Consume via subprocess (`set -a; source .env.local; set +a; <command>`).
- Secrets live in Azure Key Vault, referenced from Terraform by name only (`data "azurerm_key_vault_secret"`).
- Runtime resolution is via the App Service user-assigned managed identity. No keys to leak because there are no keys.
- `.env.example` only is committed; real `.env*` files are gitignored.

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
