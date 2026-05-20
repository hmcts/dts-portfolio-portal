import { Download, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { UploadForm } from "./upload-form";

// Upload screen per requirements spec §7.1. Accepts either a dropped
// markdown file or pasted markdown. Routes through the server action
// in ./actions.ts which identity-parses, AI-parses, and writes to
// the append-only audit log. Phase 2 task 2.6 wires the approval
// screen on top of the returned submission ID.

// Surfaced inline on this page so first-time contributors can grab
// a starter without bouncing to /help. The same three files live in
// public/templates/ and are downloadable from /help as well.
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

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader
        eyebrow="Add content"
        title="Upload a markdown file"
        lede="To add or update a Team, Product or Domain, drop in its markdown file (or paste the content). An AI helper parses the body; the original bytes are stored append-only for audit; you review and approve the parsed fields before publishing."
      />

      <Section eyebrow="Start here" heading="Download a starter template">
        <p className="mb-3 text-[13px] text-[var(--color-muted)]">
          Each template carries the canonical section headers and an
          example. Fill in your content, then upload below — the AI
          helper handles the rest.
        </p>
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
              <a
                href={`/templates/${t.slug}.md`}
                download
                className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-ink)] hover:bg-[var(--color-surface-sunk)]"
              >
                <Download size={12} aria-hidden="true" />
                Download template
              </a>
            </Card>
          ))}
        </div>
      </Section>

      <Section eyebrow="Upload" heading="Drop your markdown file">
        <UploadForm />
      </Section>
    </div>
  );
}
