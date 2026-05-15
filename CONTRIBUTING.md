# Contributing

## Workflow

Non-trivial changes follow **brainstorm → spec → plan → execute**. See [CLAUDE.md](CLAUDE.md).

Quick fixes (typos, dependency bumps, copy edits) can go straight to a PR.

## Branches

- `main` is the integration branch — don't push to it directly, open a PR.
- Branch names: short kebab-case, e.g. `add-jurisdiction-page`, `fix-breadcrumb-focus`.

## Commits

- Lowercase, conventional-feeling subjects: `add x`, `fix y`, `update z`.
- Wrap commit bodies at ~72 chars.
- Reference the relevant spec section or plan task where applicable: `add Domain page (spec §5.4, plan T1.11)`.

## Pull requests

- **Summary** — one or two sentences on what changed and why.
- **Test plan** — bullet list of how the change was verified.
- Reference any related ADR (`docs/decisions/`) if applicable.

## Where things live

| Kind | Location |
|---|---|
| Requirements specs | `docs/superpowers/specs/` |
| Implementation plans | `docs/superpowers/plans/` |
| Architecture decision records | `docs/decisions/` |
| Operator runbooks (Phase 5+) | `docs/runbooks/` |
