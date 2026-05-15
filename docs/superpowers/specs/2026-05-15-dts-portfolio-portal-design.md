---
title: DTS Portfolio Portal — Requirements Spec
date: 2026-05-15
status: Design-ready
purpose: Define what the portal needs to be at requirements level, ready to feed a design pass. Implementation architecture is intentionally deferred to a later phase.
---

# DTS Portfolio Portal — Requirements Spec

## 1. Purpose

A single, discoverable front door for delivery information across DTS in HMCTS.

DTS delivery information lives across Ardoq (architecture), Jira (delivery), Confluence (documentation), SharePoint (records) and Miro (planning). Each is authoritative for its slice. None of them gives a person — a senior leader, a delivery team member, or a curious member of staff — one place to ask *"what is the DTS landscape, who runs what, what's coming next, and who do I talk to?"*. Today they navigate by personal networks and tribal memory. The portal makes those questions answerable from one place, without specialist knowledge of where each system lives.

The portal is **a front door, not a replacement**:

- Ardoq stays authoritative for architecture
- Jira stays authoritative for delivery tickets
- Confluence stays authoritative for documentation
- The portal carries only the **high-level** information that matters to staff who don't need the operational detail, and links out to the source tools for those who do

The portal succeeds when:

- A new starter can find which team owns any DTS product within their first day
- A senior leader can scan the next-quarter direction across all DTS Jurisdictions in under a minute
- A Domain Lead can refresh their Domain's strategic themes by uploading a markdown file in under five minutes
- A delivery team can refresh their team page and roadmap in under ten minutes, monthly

The previous attempt at building this portal failed by going too deep too early — investing in dossier-grade product detail, governance and compliance fields, RBAC and audit plumbing before nailing the high-level discovery experience. This spec deliberately stays at portfolio altitude.

## 2. Audiences

Three audiences, each with a different primary job.

### 2.1 Leadership

Senior stakeholders responsible for steering DTS direction across Jurisdictions.

**Primary job-to-be-done:** Pick a Jurisdiction, see its Domain roadmap matrix at NOW / NEXT / LATER altitude, drill into a Domain when something catches the eye.

Leadership currently has no single view of DTS activity above the level of a Jira board. They piece together a picture from meetings, slide decks and personal networks. A consistent matrix per Jurisdiction gives them the cross-cutting view that meeting recaps cannot.

### 2.2 Delivery teams

Squads who run and evolve DTS products.

**Primary job-to-be-done:** Curate their team page and their products' roadmaps so the portal stays current. Adding and updating content must be very low friction.

Without delivery teams owning their slice of the content, the portal goes stale within a quarter. The content management model has to optimise for teams' willingness to keep it fresh.

### 2.3 All staff

Everyone else in DTS and adjacent HMCTS teams.

**Primary job-to-be-done:** Find things by name. *"Who owns Common Platform?"*, *"What does Resulting Assistant do?"*, *"Which team should I contact about hearing data APIs?"* — answered by a single best result, not a wall of search results to filter.

This is the largest audience by headcount. They use the portal rarely but when they do, the question is concrete and the answer is short.

## 3. Scope

### 3.1 In scope for v1

- All DTS Jurisdictions: Crime, Civil, Family, Tribunals, Administrative
- The Product Domains, Teams and Products within those Jurisdictions
- Strategic themes per Domain (the Domain's "direction")
- Initiative chips per Product, in NOW / NEXT / LATER buckets
- A portal-wide natural-language search
- Content management via markdown file upload with AI translation and human approval

### 3.2 Out of scope for v1

| Capability | Reason |
|---|---|
| ChangeLog / per-field audit trail | The upload audit log is the only history surface in v1 |
| Per-field RBAC, editor allowlists, role plumbing | Auth plumbing deferred to architecture phase |
| Submission wizards / multi-step forms | Markdown upload is the only authoring path |
| Inline rich-text / Portable Text editor | Markdown only |
| "Draft from prose" reverse mode (AI generates stub from prose) | Deferred to v2 once template usage is observed |
| Comments, threads, @-mentions, reactions | Portal is read-heavy and broadcast-style |
| Notifications and email reminders for stale data | Defer until staleness becomes a measured problem |
| Exports (Excel / Word / PowerPoint / PDF briefings) | Source tools already export; portal is discovery, not reporting |
| Compare mode, reporting cuts, snapshots | Not part of the high-level remit |
| KPI tile strips on any page | Risks dashboard-ification — the exact failure mode of the prior attempt |
| Embedded media (videos, image galleries, attachments) | Link out to source systems for media |
| Tiering assessments, DPIA, algorithmic transparency, governance compliance fields | Governance lives where governance lives |
| Two-person (4-eyes) approval enforcement | Data model supports it; enforcement deferred. v1 permits self-approval |
| Galaxy / constellation visualisation | Killed in the prior attempt; stays killed |
| Initiative as a first-class page with its own URL | Initiatives are chips — popover and modal at most |
| Mobile-optimised experience | Desktop-primary; tablet must work; mobile acceptable but not designed for |
| Multilingual / Welsh content | UK English only in v1 |
| Git repo as canonical content store | Portal store is canonical in v1; round-trippable markdown enables a later move |
| Direct integration with Ardoq / Jira / Confluence | Link-out only |
| Anonymous / public access | Authenticated DTS staff only |
| Cross-Jurisdiction roadmap aggregations beyond the home matrix | Defer |
| In-portal admin actions creating new Jurisdictions | Jurisdictions are fixed taxonomy in v1; changes are configuration, not UI actions |

## 4. Entity model

Four entities have pages (Jurisdiction, Product Domain, Team, Product); one does not (Initiative).

```
Jurisdiction (1)
  └── Product Domain (N per Jurisdiction; strategic owner — sets direction)
        ├── Team (N per Domain; each Team belongs to exactly one Domain)
        └── Product (N per Domain)
              ├── strategic owner: this Domain
              ├── operational owner: exactly one Team in this Domain
              ├── consumed by: 0..N other Jurisdictions
              └── Initiative (chip; not a first-class page)
                    ├── time bucket: NOW | NEXT | LATER
                    ├── title (plain English, ~10 words)
                    ├── optional one-line description
                    └── optional outbound link (typically Jira or Miro)
```

### 4.1 Ownership

Two-tier ownership reflects the Product Operating Model:

- **Strategic ownership** belongs to the **Product Domain**: it sets direction, prioritises across products, and is accountable for outcomes within the Domain
- **Operational ownership** belongs to a **Team**: it runs, maintains and evolves specific products day-to-day

Implications:

- A Product card surfaces three names: the **Jurisdiction**, the **Product Domain** (strategic owner), and the **Team** (operational owner)
- A Team belongs to exactly one Product Domain
- A Product is operationally owned by exactly one Team at any point in time. Handover from one Team to another is allowed; co-ownership is not

### 4.2 Cross-Jurisdiction consumption

A Product belongs to exactly one Product Domain and therefore exactly one Jurisdiction. When a Product is *used by* other Jurisdictions, the relationship is captured as **"consumed by Jurisdiction X"**. The Product card shows the Jurisdictions that consume it; each Jurisdiction page shows a separate "Used by this Jurisdiction" section listing Products it consumes from elsewhere.

This keeps the ownership tree clean while allowing genuine cross-Jurisdiction usage to be discoverable.

### 4.3 Roadmaps — two altitudes

| Altitude | Owner | Shape | What's on it |
|---|---|---|---|
| **Domain roadmap** | Product Domain | Small set of named strategic themes | "Improve search across Crime products" — reflects the Domain's direction; not time-bucketed |
| **Product roadmap** | Team (operational) | Time-bucketed initiative chips | "Java 21 upgrade", "Welsh interpreter logic fix" — placed in NOW, NEXT or LATER |

Soft size guidance: a Domain roadmap typically has fewer than ten themes; a Product roadmap typically has fewer than six chips per time bucket. The portal does not enforce hard limits but the design should make exceeding these counts visually awkward, encouraging editorial restraint.

Initiative chips do **not** carry Jira ticket numbers, sprint references, RAG status, percent-complete or sub-task lists. Anything Jira-grade stays in Jira and is reached via an outbound link from the chip.

## 5. Pages

### 5.1 Page inventory

| # | Page | URL pattern | Primary audience | Purpose |
|---|---|---|---|---|
| 1 | Home | `/` | All | Cross-DTS NOW / NEXT / LATER roadmap matrix; portal-wide search; "Your team" shortcut if available |
| 2 | Jurisdiction | `/j/{jurisdiction-slug}` | Leadership | Roll-up for one Jurisdiction: Domain roadmap matrix, list of Domains, list of Products consumed from elsewhere |
| 3 | Product Domain | `/d/{domain-slug}` | All | Strategic themes; filter strip; Products card grid; Teams card grid |
| 4 | Team | `/t/{team-slug}` | Delivery teams curate; others read | Team description, Products operated, how to reach, what's next |
| 5 | Product | `/p/{product-slug}` | All | Stage, description, links out, roadmap chips, operating Team, consumed-by Jurisdictions |
| 6 | Search results | `/search?q=...` | All staff | LLM answer card + ranked entity matches with entity-type filter chips |

Every entity page can also be opened as a **modal-as-detail** over its parent page, preserving the parent's filters and scroll position. Modal URLs are deep-linkable — sharing a link opens the same modal-over-context for the recipient.

### 5.2 Home

**Hero region:** Portal title and one-line description.

**Search:** Always-on pill-shaped search input. Natural-language queries; `/` or `⌘K` (`Ctrl-K` on Windows) focuses it from anywhere.

**Cross-DTS roadmap matrix:**

- Rows: Product Domains grouped by Jurisdiction (each Jurisdiction is a row group with a header band)
- Columns: NOW · NEXT · LATER
- Cells: Initiative chips aggregated from the Domain's Products' roadmaps; cell content expandable when chips exceed the visible area
- Jurisdictions other than the first are collapsed by default; a "filter to your Jurisdiction" preference is remembered between visits

**"Your team" shortcut:** If the auth layer exposes the signed-in user's team membership, show a chip taking them to their Team page. If not, the shortcut is hidden and nothing breaks.

There is **no KPI tile strip** on the home (or anywhere else in v1).

### 5.3 Jurisdiction page

**Header band:** Jurisdiction name; brief description maintained by an admin.

**Domain roadmap matrix (this Jurisdiction only):**

- Rows: Product Domains within this Jurisdiction
- Columns: NOW · NEXT · LATER
- Cells: Initiative chips aggregated from Products in each Domain

**Domains in this Jurisdiction:** Card grid. Each card: Domain name, short description, count of Teams, count of Products, link to Domain page.

**Products consumed by this Jurisdiction:** Card grid of Products that originate in *other* Jurisdictions but are used by this one. Each card carries the originating Jurisdiction badge.

### 5.4 Product Domain page

**Header band:** Domain name, Jurisdiction breadcrumb, description.

**Strategic direction (Domain roadmap):** Theme cards — small, named, plain English. Maintained by the Domain.

**Filter strip:** Light filtering of Products and Teams on the page — stage, team, capability tag. Deliberately restrained.

**Teams in this Domain:** Card grid. Each card: team name, brief description, number of Products operated, link to Team page.

**Products in this Domain:** Card grid. Each card: parent Jurisdiction · Domain (eyebrow), Product name, stage pill, three-line clamped description, operating Team, last-approved-on date.

### 5.5 Team page

**Header band:** Team name; breadcrumb (Jurisdiction → Domain → Team); how-to-reach text (email, Slack channel, anything else the team curates).

**About the team:** A few paragraphs the team writes about themselves. Markdown-rendered.

**Products this team operates:** Card grid of Products with operational ownership by this Team.

**Latest activity / what's next:** A simple list of the team's most recent initiative changes across their products, derived from the audit log. No threads or comments.

### 5.6 Product page

**Header band:** Product name; breadcrumb (Jurisdiction → Domain → Product); stage pill.

**Description:** Plain prose, markdown-rendered.

**Roadmap:** NOW · NEXT · LATER strip with initiative chips. Click a chip → popover (one-line description, owner, outbound link). "More" → modal-as-detail showing the full chip.

**Outbound links:** A clearly-labelled block of source-system links: Ardoq, Jira board, Confluence space, Miro, source repo, "other". Each opens in a new tab and is labelled by destination.

**Operating Team:** Card linking to the Team page.

**Strategic Domain:** Card linking to the Domain page.

**Consumed by:** List of Jurisdictions that consume this Product, if any.

### 5.7 Search results

**Top:** The LLM answer card — the system's best single-sentence answer to the user's question, with entity citations linked.

**Below:** Ranked entity matches, grouped by entity type with filter chips: Jurisdiction · Domain · Team · Product · Initiative.

**Each match shows:** entity type icon, name, parent breadcrumb, one-line snippet of the matching content.

## 6. Cross-cutting patterns

### 6.1 Search

- Always-on search input in the top bar of every page
- `/` and `⌘K` (or `Ctrl-K` on Windows) focus the input from anywhere
- **Instant overlay** as the user types: a dropdown panel under the search bar shows the LLM answer card and the top five ranked matches; dismiss to remain on the current page
- **Deep results page** on Enter: full ranked list with entity-type filter chips (see §5.7)
- Natural-language queries are first-class: search must be capable of answering questions like *"who owns Common Platform?"* with a single best-answer card
- The same search is used everywhere; no per-page scoped variants in v1

### 6.2 Modal-as-detail

- Clicking a Team, Product or Initiative card from any surface opens it as a slide-over modal over the current page
- Filters, scroll position and search state of the underlying page are preserved
- The modal's URL is deep-linkable
- A "View as page" affordance routes to the full page for Team / Product / Domain; Initiative has no page

### 6.3 Outbound linking

- Every Product carries an outbound-links block: Ardoq, Jira board, Confluence space, Miro, source repo, "other" — whichever apply
- Every Initiative chip carries one optional outbound link
- Outbound links open in a new tab and are labelled by destination, not by URL ("Open in Jira", not "https://...")
- The portal **does not embed** content from Ardoq, Jira, Confluence or other source systems

### 6.4 Breadcrumbs

- Every entity page header carries a breadcrumb: Jurisdiction → Product Domain → Team / Product
- Each segment is clickable to navigate up
- Breadcrumbs are also shown inside modals so context is never lost

### 6.5 Sidebar nav

| Item | Behaviour |
|---|---|
| Home | The cross-DTS roadmap matrix |
| Jurisdictions | Expandable section listing all Jurisdictions; clicking one opens its Jurisdiction page |
| Add content | Opens the markdown upload screen |
| Help | Templates, format guide, FAQ |
| Profile (if signed in) | "Your team" shortcut, recent submissions, sign out |

Sidebar is collapsible. Search lives in the top bar, not the sidebar.

### 6.6 Visual language (principles)

Captured here as principles to inform the design pass — not as technology choices.

- **Tone:** calm, near-monochrome, modern SaaS — Linear / Vercel / Notion register, not GOV.UK transactional forms
- **Fonts:** Geist sans for UI; an optional humanist variable serif may be used sparingly for marquee surfaces (e.g. a Domain page header band)
- **Surfaces:** light-grey page canvas, white cards, 1px hairline borders rather than drop shadows
- **Status pills:** small soft-tinted palette (green / amber / red / blue / grey) used consistently for Product stage and AI confidence flags
- **Colour is never load-bearing alone** — every status pill carries an icon or text label
- **Eyebrow labels** (small, uppercase, tracked, muted) above page H1 and major content blocks
- **Spacing:** 8px base unit, 24–32px between sections, 20–24px card padding
- **Radius:** generous on cards (~14–16px); fully rounded on pills
- **Iconography:** one icon family with consistent stroke weight

## 7. Content management

### 7.1 Authoring model

**One markdown file per entity.** A Team has a `team.md`; a Product has a `product.md`; a Domain has a `domain.md`. To add a new Product, an author uploads a Product markdown file. To update a Team, they re-upload its Team markdown file.

**File anatomy:**

- **YAML front-matter** carries three strict identity fields: `type` (one of `team`, `product`, `domain`), `name`, and a parent reference (e.g. `domain: Court Hearing Domain A` on a Team file)
- **The body is loose markdown** organised by section headers (e.g. `# About`, `# What we operate`, `# Roadmap`, `# How to reach us`, `# Links`)
- **AI parses by section header** with tolerance for variants (*"Contact us"*, *"How to reach us"*, *"Reach us"* all map to the contact block)

**Roadmap initiatives** live inside the Product markdown under `# Roadmap`, with `## NOW`, `## NEXT`, `## LATER` subsections. To change one chip, the author re-uploads the Product markdown.

**Strategic themes** live inside the Domain markdown under `# Strategic direction`. Same pattern.

### 7.2 Templates

Three downloadable templates are linked from the upload screen and the Help page:

- `new-domain.md`
- `new-team.md`
- `new-product.md`

Each template includes the section skeleton with explanatory comments and example content. Templates are the primary remedy for the blank-page problem in v1. A "Draft from prose" reverse mode (where the author types a paragraph and AI generates a markdown stub) is deferred to v2.

### 7.3 Lifecycle

```
Markdown uploaded or pasted
        │
        ▼
Original markdown stored to append-only audit log
   (submitter, timestamp, raw bytes — never overwritten)
        │
        ▼
AI parses → draft state (not visible to readers)
        │
        ▼
Approval screen: source-left, parsed-right, AI confidence flags, inline tweaks
        │
        ▼
[Approve and Publish]   ──── approver, timestamp captured
        │
        ▼
Live · entity carries "Last approved by X on Y · version N"
```

### 7.4 The approval screen

One screen serves three flows: new entity creation, update (re-upload), and inline typo-fix.

- **Left pane:** source markdown, read-only, syntax-highlighted
- **Right pane:** extracted fields with inline edit affordances; AI confidence flags surfaced as warnings; an "I didn't know what to do with this" panel for un-parseable sections (each carries actions: *Drop · Add as note · Fix in source*)
- **For updates:** diffs against the live version are shown (e.g. "3 fields changed, 1 initiative added, 1 removed")
- **Buttons:** Cancel · Save as draft · Approve and publish

Even a single-character typo-fix routes through this screen; consistency is preferred over micro-convenience.

### 7.5 AI behaviour requirements

- AI must **show its working** — each extracted field is tagged with confidence; low-confidence fields are highlighted
- AI must **surface unrecognised content** explicitly — un-parseable sections appear as a panel rather than being silently dropped
- AI **may suggest fixes** but must not auto-apply them
- AI **fails safe** — if parsing fails completely, the upload sits in draft and the approver sees the raw markdown plus a clear failure reason
- AI parsing must be **idempotent** for identical input
- The portal must **fall back to a strict-template parser** (YAML front-matter and exact section header names) if the AI layer is unavailable; worst case is that correctly-formatted markdown is still accepted

### 7.6 Audit log

Each upload appends a record:

| Field | Source |
|---|---|
| `submission_id` | UUID |
| `entity_kind`, `entity_id` | From front-matter |
| `submitter` | From auth |
| `submitted_at` | Timestamp |
| `source_markdown_bytes` | The raw uploaded file, append-only |
| `ai_parsed_output` | The structured JSON the AI returned |
| `ai_confidence_flags` | Per-field confidence and unrecognised-content notes |
| `approver` | From auth at approval time — a separate field from submitter, ready for 4-eyes enforcement later |
| `approved_at` | Timestamp |
| `version_number` | Incremented per approved publish for that entity |
| `notes` | Optional free text the approver can add |

The audit log is **append-only**. Content is "withdrawn" by approving a new version with the relevant section removed, or by archiving the entity. History is never destroyed.

### 7.7 Capability requirements

Auth and role plumbing are deferred to the architecture phase. The spec captures who can do what *conceptually*:

| Capability | Conceptual actor |
|---|---|
| Edit a Team page; update its products' roadmap chips | A member of that Team |
| Edit a Product page (description, stage, links); update its roadmap chips | The operationally owning Team |
| Edit a Domain page; add/remove Teams in the Domain; add/remove Products in the Domain; edit Strategic Direction themes | The Domain (e.g. Domain Lead or Product Manager) |
| Admin-level edits to the Jurisdiction taxonomy | Not exposed as a portal UI action in v1 — managed as configuration |
| Submit an upload | Any authenticated user with the capability (decided by the architecture layer) |
| Approve and publish an upload | Same person (self-approval permitted in v1) or another authenticated user with capability (4-eyes-ready but not enforced) |
| Browse, search, view | Any authenticated DTS staff member |

The data model captures `submitter` and `approver` as separate fields so 4-eyes review can be enforced later without migration.

## 8. Accessibility, performance and platform

### 8.1 Accessibility

- WCAG 2.2 AA as the baseline; aim for AAA where reasonable
- Full keyboard navigation; visible focus rings on every interactive element
- Screen-reader-friendly semantic markup
- Colour-blind safe — status meaning is always carried by an icon or label, never colour alone
- Modal-as-detail must trap focus while open and restore it to the trigger on dismiss
- Accessibility is non-negotiable for HMCTS and must be tested per build, not bolted on

### 8.2 Performance

- Home page meaningful content within 2 seconds on a typical office connection
- Search overlay results visible within 500ms perceived (LLM call latency may be longer; show a "thinking…" state while the answer card resolves)
- Content is approved-and-published, so it is effectively static; aggressive caching is appropriate

### 8.3 Language

UK English. No multilingual or Welsh content in v1.

### 8.4 Device support

Desktop-primary. Tablet must work. Mobile is acceptable but not optimised in v1.

### 8.5 Authentication

The portal is authenticated DTS staff only. No anonymous or public access. The specific auth mechanism is decided in the architecture phase; the spec assumes the portal receives a signed-in user identity (email at minimum, with optional team-membership claims).

## 9. Glossary

| Term | Meaning |
|---|---|
| **DTS** | Digital and Technology Services — the part of HMCTS this portal is built for |
| **Jurisdiction** | An HMCTS business area: Crime, Civil, Family, Tribunals, Administrative |
| **Product Domain** (or **Domain**) | A grouping of Products and Teams within a Jurisdiction; sets strategic direction. Term comes from the Product Operating Model |
| **Team** | A delivery squad operating one or more Products within a single Product Domain |
| **Product** | A long-lived service or system DTS owns and runs |
| **Initiative** | A near-term piece of work appearing as a chip on a Product roadmap; placed in NOW / NEXT / LATER |
| **Strategic direction / theme** | A Domain-level statement of intent appearing on the Domain roadmap |
| **NOW / NEXT / LATER** | The three time buckets for roadmap content. NOW is in-flight; NEXT is committed for the upcoming horizon; LATER is acknowledged but unscheduled |
| **Operational owner** | The Team that runs, maintains and evolves a Product |
| **Strategic owner** | The Product Domain that sets direction for a Product |
| **Consumed by** | Relationship from a Product to one or more Jurisdictions other than its own that depend on it |
| **Audit log** | Append-only record of every content upload: source markdown, AI output, submitter, approver, version |
| **Approval screen** | The single UI surface for previewing, tweaking and publishing AI-parsed content |
