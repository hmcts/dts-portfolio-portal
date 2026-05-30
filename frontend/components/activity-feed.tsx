import Link from "next/link";
import {
  Activity,
  Plus,
  ArrowRightLeft,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ActivityEntry } from "@/lib/entities";

// "Latest approved changes across DTS" feed per requirements spec §5.2.
// Pulls from the audit log; each entry links back to the affected
// entity. Append-only — we never edit history (§7.6).

const KIND_ICONS: Record<ActivityEntry["kind"], LucideIcon> = {
  "roadmap-update": Activity,
  "new-chip": Plus,
  "stage-change": ArrowRightLeft,
  "theme-update": Lightbulb,
};

const KIND_LABELS: Record<ActivityEntry["kind"], string> = {
  "roadmap-update": "Roadmap update",
  "new-chip": "New chip",
  "stage-change": "Stage change",
  "theme-update": "Theme update",
};

function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 60) return `${Math.floor(diffDays / 7)} weeks ago`;
  return then.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <p className="text-[var(--color-muted)]">
          No recent activity yet — content lands as it's approved through the
          markdown lifecycle.
        </p>
      </Card>
    );
  }
  return (
    <Card padding={false}>
      <ul role="list" className="divide-y divide-[var(--color-border)]">
        {entries.map((entry) => {
          const Icon = KIND_ICONS[entry.kind];
          return (
            <li key={entry.id}>
              {/* Whole row is a single click target — navigates to the
                  affected entity's page. Replaces the previous
                  text-only inline link on the subject word. */}
              <Link
                href={entry.subjectHref}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-sunk)] focus-visible:bg-[var(--color-surface-sunk)]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunk)] text-[var(--color-muted)]"
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-[var(--color-ink)]">
                    {entry.subject}
                    <span className="font-normal text-[var(--color-ink-soft)]">
                      {" "}
                      — {entry.description}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                    {KIND_LABELS[entry.kind]} · {entry.approver} ·{" "}
                    {formatRelative(entry.approvedAt)}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
