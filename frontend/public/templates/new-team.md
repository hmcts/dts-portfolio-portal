---
# Identity front-matter (required, strict).
# `type` must be exactly "team".
# `name` is the human-readable Team name shown across the portal.
# `domain` references the parent Product Domain. Either a slug (e.g.
# "case-outcomes") or the human name ("Case Outcomes Domain") is
# accepted at upload time; the approver picks the canonical slug.
type: team
name: Outcomes Platform Team
domain: Case Outcomes Domain
---

<!--
  Markdown body — strict-template structure per requirements spec §7.5.
  The four H1 sections below are recognised by the fallback parser.
  Delete these HTML comments before saving if you prefer.
-->

# About

<!--
  Two or three short sentences. What this Team does day-to-day, the
  shape of the team, and what they're known for. Portfolio-altitude —
  no sprint goals, ticket numbers or standup notes.
-->

The Outcomes Platform Team builds and runs the event stream that carries
hearing outcomes from courtroom systems to downstream consumers. A
cross-functional team of eight, embedded in the Case Outcomes Domain,
on a two-year mission to retire the legacy outcomes bridge.

# What we operate

<!--
  A short paragraph (or bullet list) naming the Products this Team is
  the *operating Team* for — the day-to-day operational owners. These
  are the Products that will show this Team in the "Operated by" slot
  on the Product page. Don't list Products you only consume.
-->

- Outcomes Event Stream — the Kafka-backed pipeline carrying structured
  outcome events to enforcement, reporting, and the national case index.
- Outcomes Bridge (legacy) — the SOAP bridge being decommissioned as
  the event stream takes over.

# How to reach us

<!--
  Where to find the team. A Slack channel is usually enough; add a
  shared inbox or on-call rotation pointer if useful. No personal
  email addresses — the portal is public to all HMCTS staff.
-->

We hang out in #team-outcomes-platform on Slack. For non-urgent
questions, drop a note in the channel; for incidents touching the
outcomes stream, page us via the standard DTS on-call rotation.

# Links

<!--
  Outbound links to where the operational detail actually lives.
  Markdown link syntax — one per line. Common destinations: Confluence
  team page, Jira project board, GitHub org, runbook.
-->

- [Team Confluence space](https://confluence.example.gov.uk/display/OPT)
- [Jira board](https://jira.example.gov.uk/secure/RapidBoard.jspa?projectKey=OPT)
- [Runbook](https://runbooks.example.gov.uk/outcomes-platform)
