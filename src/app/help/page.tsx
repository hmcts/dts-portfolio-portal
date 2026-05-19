import { Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";

// Help page placeholder per requirements spec §6.5 — landing for the
// sidebar "Help & templates" link. The downloadable templates land
// in Phase 2 Task 2.10 alongside the upload flow.

const TEMPLATES = [
  {
    slug: "new-domain",
    title: "new-domain.md",
    description:
      "Section skeleton for a new Product Domain: identity front-matter plus Strategic direction headings.",
  },
  {
    slug: "new-team",
    title: "new-team.md",
    description:
      "Section skeleton for a new Team: About, What we operate, Latest activity, How to reach us.",
  },
  {
    slug: "new-product",
    title: "new-product.md",
    description:
      "Section skeleton for a new Product: description, roadmap (NOW / NEXT / LATER), outbound links.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Help & templates"
        title="Templates for adding content"
        lede="Pick the template that matches the entity you're creating. Each is a markdown file with the section skeleton, comments and an example to make the first edit obvious."
      />

      <Section eyebrow="Templates" heading="Download a starter">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TEMPLATES.map((t) => (
            <Card key={t.slug}>
              <Eyebrow className="mb-1.5">Markdown</Eyebrow>
              <div className="flex items-start justify-between gap-3">
                <div className="font-mono text-[14px] font-medium text-[var(--color-ink)]">
                  {t.title}
                </div>
                <FileText
                  size={16}
                  aria-hidden="true"
                  className="text-[var(--color-muted)]"
                />
              </div>
              <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
                {t.description}
              </p>
              <button
                type="button"
                disabled
                className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-sunk)] px-3 py-1.5 text-[13px] text-[var(--color-muted)]"
              >
                <Download size={12} aria-hidden="true" />
                Phase 2 — coming soon
              </button>
            </Card>
          ))}
        </div>
      </Section>

      <Section eyebrow="FAQ" heading="What this portal is and isn't">
        <Card>
          <div className="space-y-4 text-[14px] text-[var(--color-ink-soft)]">
            <p>
              <strong className="text-[var(--color-ink)]">It's a front door.</strong>{" "}
              The portal carries the high-level shape of DTS — what runs, who runs
              it, what's coming next. Operational detail still lives in Ardoq,
              Jira and Confluence; this is the front door over those tools.
            </p>
            <p>
              <strong className="text-[var(--color-ink)]">Content is markdown.</strong>{" "}
              You add or update a Team, Product or Domain by uploading a
              markdown file. An AI helper parses it; a human approves it; the
              page lives.
            </p>
            <p>
              <strong className="text-[var(--color-ink)]">Append-only audit.</strong>{" "}
              Every upload is kept verbatim alongside the AI parse output and
              the approver — even after later edits. History is never
              rewritten.
            </p>
          </div>
        </Card>
      </Section>
    </div>
  );
}
