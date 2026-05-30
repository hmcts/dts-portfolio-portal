"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageHeader } from "@/components/ui/page-header";

// Friendly error page per requirements spec §3.2 ("error states with
// a recovery action"). Logs to the App Insights stream via pino in
// production; here we just call console.error so dev sees the trace.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal] route error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[800px]">
      <PageHeader
        eyebrow="Something went wrong"
        title="The page didn't load."
        lede="It's us, not you. The error has been logged. Try again, or go back to the home page."
        actions={
          <>
            <Button variant="outline" onClick={reset}>
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </Button>
            <Link href="/">
              <Button variant="primary">Go home</Button>
            </Link>
          </>
        }
      />

      <Card className="mt-10">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-conf-low-bg)] text-[var(--color-conf-low-fg)]"
          >
            <AlertTriangle size={16} />
          </span>
          <div>
            <Eyebrow className="mb-1.5">Reference</Eyebrow>
            <p className="font-mono text-[13px] text-[var(--color-ink-soft)]">
              {error.digest ?? "no-digest"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
