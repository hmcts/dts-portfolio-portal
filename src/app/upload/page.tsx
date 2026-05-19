import { Upload, FileText } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";

// Add-content placeholder per requirements spec §6.5. Real upload UI
// lands in Phase 2 (Tasks 2.5–2.7). Until then this page sets
// expectations and links to the Help page for templates.

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Add content"
        title="Upload a markdown file"
        lede="To add or update a Team, Product or Domain, drop in its markdown file. An AI helper parses it; you approve the parsed fields before the page goes live."
      />

      <Section eyebrow="Upload area" heading="Drop a markdown file here">
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunk)] px-6 py-12 text-center">
            <Upload
              size={24}
              aria-hidden="true"
              className="text-[var(--color-muted)]"
            />
            <p className="text-[14px] font-medium text-[var(--color-ink)]">
              Drag-and-drop the upload flow lands in Phase 2.
            </p>
            <p className="max-w-md text-[13px] text-[var(--color-muted)]">
              The acceptance criteria, audit log, approval screen and
              capability checks are specified in Phase 2 tasks 2.1 through
              2.10 of the implementation plan. Until then this page is a
              placeholder.
            </p>
          </div>
        </Card>
      </Section>

      <Section eyebrow="Templates" heading="Before you upload">
        <Card>
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunk)] text-[var(--color-muted)]"
            >
              <FileText size={16} />
            </span>
            <div>
              <p className="text-[14px] text-[var(--color-ink-soft)]">
                If you're starting from a blank page, grab one of the three
                markdown templates from the{" "}
                <Link
                  href="/help"
                  className="font-medium text-[var(--color-ink)] hover:underline"
                >
                  Help & templates
                </Link>{" "}
                page (Domain / Team / Product).
              </p>
            </div>
          </div>
        </Card>
      </Section>
    </div>
  );
}
