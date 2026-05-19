---
# Identity front-matter (required, strict).
# `type` must be exactly "domain".
# `name` is the human-readable Domain name shown across the portal.
# `jurisdiction` must be one of: crime, civil, family, tribunals, administrative.
type: domain
name: Case Outcomes Domain
jurisdiction: crime
---

<!--
  Markdown body — strict-template structure per requirements spec §7.5.
  The two H1 sections below are recognised by the fallback parser.
  The AI parser (when available) is more tolerant on heading wording,
  but keeping these exact headings guarantees a clean parse either way.
  Delete these HTML comments before saving if you prefer.
-->

# About

<!--
  One or two short paragraphs. What this Domain is responsible for, who
  it serves, and the shape of the work. Keep it portfolio-altitude —
  no roadmaps, ticket numbers, or release notes. Link out to Confluence
  for the detail.
-->

The Case Outcomes Domain owns the tools and integrations that capture
what happened at the end of a hearing — verdicts, sentences, results —
and propagate them downstream to enforcement, reporting and the
national case index. It works closely with the Courtroom & Hearings
Domain upstream and with Enforcement consumers downstream.

# Strategic direction

<!--
  A bullet list of the themes this Domain is pursuing this year.
  Each bullet is a short title; lines indented under it become the
  description. Keep to 3–6 themes. These appear on the Domain page as
  the "Strategic direction" panel.
-->

- Cut clerk keystrokes per outcome
  Halve the manual data entry between verdict and downstream notification
  by reusing structured data already captured in the hearing.
- Make outcomes machine-readable end-to-end
  Replace the remaining PDF and free-text hand-offs with structured
  events so enforcement systems can act without re-keying.
- Retire the legacy outcomes bridge
  Decommission the 2014-era bridge once the new event stream covers
  100% of in-scope hearing types.
