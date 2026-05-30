---
# Identity front-matter (required, strict).
# `type` must be exactly "product".
# `name` is the human-readable Product name shown across the portal.
# `domain` references the strategic-owner Domain — the Domain that
# sets direction for this Product. Either a slug (e.g. "case-outcomes")
# or the human name ("Case Outcomes Domain") is accepted at upload
# time; the approver picks the canonical slug.
#
# The operating Team (day-to-day owner) is set separately at approve
# time, not in front-matter.
type: product
name: Outcomes Event Stream
domain: Case Outcomes Domain
---

<!--
  Markdown body — strict-template structure per requirements spec §7.5.
  The three H1 sections below are recognised by the fallback parser.
  `# Roadmap` must contain `## NOW`, `## NEXT` and `## LATER` H2
  subsections in that order. Delete these HTML comments before saving
  if you prefer.
-->

# About

<!--
  One short paragraph. What the Product does, who uses it, and the
  shape it takes (service, platform, library). Portfolio-altitude —
  link out for architectural detail.
-->

The Outcomes Event Stream is the Kafka-backed pipeline that carries
structured hearing-outcome events from courtroom systems to downstream
consumers: enforcement, reporting, and the national case index.
Currently live for Crown Court verdicts; Magistrates rolling out
through 2026.

# Roadmap

<!--
  Three time buckets — NOW, NEXT, LATER. Each bucket is a bullet list.
  A line starting with `- ` is the initiative title; indented lines
  fold into its description.

  Keep titles short and outcome-shaped ("X is true") rather than
  task-shaped ("Do Y"). The home page surfaces these as roadmap chips.
-->

## NOW

- Magistrates outcomes live in production
  Roll the event stream out across all magistrates' courts, starting
  with the South-East region.
- Bridge-free reporting pilot
  Run the national reporting consumer off the event stream for one
  region in parallel with the legacy bridge.

## NEXT

- Retire the legacy outcomes bridge
  Cut the SOAP bridge over to read-only once the event stream covers
  100% of in-scope hearing types.
- Youth court outcomes
  Extend the schema to cover youth-court-specific outcomes and roll
  out to youth courts.

## LATER

- Tribunals outcomes
  Explore extending the same stream to tribunal outcomes once the
  Crime jurisdiction is fully migrated.

# Links

<!--
  Outbound links to where the operational detail actually lives.
  Markdown link syntax — one per line.
-->

- [Product Confluence page](https://confluence.example.gov.uk/display/OES)
- [Source repository](https://github.com/example-gov/outcomes-event-stream)
- [Schema documentation](https://schemas.example.gov.uk/outcomes/v2)
