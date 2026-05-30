"use client";

import { useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Upload as UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { uploadMarkdownAction, type UploadActionResult } from "./actions";

// Upload form per spec §7.1–§7.6. Either drop a file or paste markdown
// into the textarea — the server action accepts either. After a
// successful upload, the form shows a result panel with the
// submission ID; the approval screen (Phase 2 task 2.6) is linked
// from there once it lands.

export function UploadForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<UploadActionResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      const res = await uploadMarkdownAction(fd);
      setResult(res);
    });
  }

  function onDropFile(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(dropped);
      fileInputRef.current.files = dt.files;
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
      <Card>
        <Eyebrow className="mb-2">Option 1 · Drop a file</Eyebrow>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDropFile}
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragging
              ? "border-[var(--color-ink)] bg-[var(--color-surface-sunk)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)]"
          }`}
        >
          <UploadIcon
            size={20}
            aria-hidden="true"
            className="text-[var(--color-muted)]"
          />
          <p className="text-[14px] font-medium text-[var(--color-ink)]">
            Drag a markdown file here, or browse
          </p>
          <label className="block max-w-full text-[13px] text-[var(--color-ink-soft)]">
            <span className="sr-only">Markdown file</span>
            <input
              ref={fileInputRef}
              type="file"
              name="markdownFile"
              aria-label="Markdown file to upload"
              accept=".md,.markdown,text/markdown,text/plain"
              className="file:mr-3 file:rounded-[var(--radius-pill)] file:border file:border-[var(--color-border-strong)] file:bg-[var(--color-surface)] file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-[var(--color-ink)] hover:file:bg-[var(--color-surface-sunk)]"
            />
          </label>
        </div>
      </Card>

      <Card>
        <Eyebrow className="mb-2">Option 2 · Paste markdown</Eyebrow>
        <p className="mb-2 text-[13px] text-[var(--color-muted)]">
          Useful when you've already drafted in another tool. Front-matter
          must include `type`, `name`, and a parent reference — see the
          templates on the <Link href="/help" className="underline">Help page</Link>.
        </p>
        <textarea
          ref={textInputRef}
          name="markdownText"
          rows={12}
          aria-label="Markdown content"
          placeholder={`---\ntype: team\nname: Your Team\ndomain: parent-domain-slug\n---\n\n# About\n\n...`}
          className="block w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-border-strong)]"
        />
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--color-muted)]">
          We store the original bytes append-only and run an AI parse;
          you review the parsed fields before publishing.
        </p>
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload and parse"}
        </Button>
      </div>

      {result ? <ResultPanel result={result} /> : null}
    </form>
  );
}

function ResultPanel({ result }: { result: UploadActionResult }) {
  if (!result.ok) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-conf-low-bg)] text-[var(--color-conf-low-fg)]"
          >
            <AlertTriangle size={16} />
          </span>
          <div>
            <Eyebrow className="mb-1.5">Upload rejected</Eyebrow>
            <p className="text-[14px] text-[var(--color-ink-soft)]">
              {result.error}
            </p>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-stage-live-bg)] text-[var(--color-stage-live-fg)]"
        >
          <CheckCircle2 size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow className="mb-1.5">Submission queued · awaiting approval</Eyebrow>
          <p className="text-[14px] text-[var(--color-ink)]">
            Stored as <span className="font-medium">{result.entityKind}</span>{" "}
            "{result.entityName}". Source SHA-256{" "}
            <code className="font-mono text-[12px] text-[var(--color-muted)]">
              {result.sourceMarkdownSha.slice(0, 12)}…
            </code>
          </p>
          <p className="mt-2 text-[13px] text-[var(--color-muted)]">
            Parse source: {result.parseSource}
            {result.parseOk ? null : ` — failed: ${result.parseReason}`}
          </p>
          <p className="mt-3 text-[13px] text-[var(--color-ink-soft)]">
            The approval screen lands in Phase 2 task 2.6. Submission ID{" "}
            <code className="font-mono text-[12px]">{result.submissionId}</code>{" "}
            will route there once the screen is wired.
          </p>
        </div>
      </div>
    </Card>
  );
}
