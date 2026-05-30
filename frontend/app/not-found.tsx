import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";

// Friendly 404 per requirements spec §3.2 (empty states are in scope;
// fancier 404 experiences are not). Keeps the AppShell chrome around
// the message so reviewers stay oriented after a typo'd URL.

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[800px]">
      <PageHeader
        eyebrow="Not found"
        title="We couldn't find that page."
        lede="The link might be out of date, or the entity may have been renamed. Try the home page, or use the sidebar to jump to a Jurisdiction."
        actions={
          <Link href="/">
            <Button variant="primary">
              <Home size={14} aria-hidden="true" />
              Go home
            </Button>
          </Link>
        }
      />

      <Card className="mt-10">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunk)] text-[var(--color-muted)]"
          >
            <Compass size={16} />
          </span>
          <div>
            <Eyebrow className="mb-1.5">If you arrived here from a link</Eyebrow>
            <p className="text-[14px] text-[var(--color-ink-soft)]">
              The entity slug might have changed when its markdown was
              re-uploaded. The audit log keeps the previous slug — the
              site-search picks up the new URL within a few seconds of the
              approve-and-publish event.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
