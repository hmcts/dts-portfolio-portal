import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  getDailySearchVolume,
  getUnclickedQueries,
  getZeroResultQueries,
} from "@/lib/search/analytics";

// Search relevance dashboard per Phase 3 task 3.7. Three sections:
//
//   1. Daily volume     — queries + clicks per day, last 14 days
//   2. Zero-result queries — what the corpus is missing
//   3. Queries with answers but zero clicks — relevance triage
//
// Read-only. Phase 4 task 4.6 will gate this route to an "ops" role.

export const metadata: Metadata = {
  title: "Search analytics · DTS Portfolio Portal",
  robots: { index: false, follow: false },
};

const DAYS_BACK = 14;

export default async function SearchAnalyticsPage() {
  const [volume, zero, unclicked] = await Promise.all([
    getDailySearchVolume(DAYS_BACK),
    getZeroResultQueries(DAYS_BACK),
    getUnclickedQueries(DAYS_BACK),
  ]);

  const totals = volume.reduce(
    (acc, d) => ({
      queries: acc.queries + d.queries,
      clicks: acc.clicks + d.clicks,
    }),
    { queries: 0, clicks: 0 },
  );
  const ctr = totals.queries === 0 ? 0 : totals.clicks / totals.queries;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Ops · Search"
        title="Search relevance"
        lede="What people are looking for, what they couldn't find, and what they found but didn't open. Use the zero-result list to plug content gaps; use the unclicked list to triage ranking."
      />

      <Section eyebrow={`Trailing ${DAYS_BACK} days`} heading="Activity">
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Tile label="Total queries" value={fmt(totals.queries)} />
            <Tile label="Result clicks" value={fmt(totals.clicks)} />
            <Tile
              label="Click-through rate"
              value={`${(ctr * 100).toFixed(1)}%`}
              hint="Clicks per query, across all queries (including zero-result)."
            />
          </div>
        </Card>
      </Section>

      <Section
        eyebrow="Content gaps"
        heading={`Zero-result queries (${zero.length})`}
      >
        <Card>
          {zero.length === 0 ? (
            <p className="text-[14px] text-[var(--color-muted)]">
              No zero-result queries in the last {DAYS_BACK} days.
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <Th>Query</Th>
                  <Th align="right">Occurrences</Th>
                  <Th align="right">Last seen</Th>
                </tr>
              </thead>
              <tbody>
                {zero.map((q) => (
                  <tr
                    key={q.query}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <Td>
                      <span className="font-mono">{q.query}</span>
                    </Td>
                    <Td align="right">{fmt(q.occurrences)}</Td>
                    <Td align="right">{fmtDate(q.lastSeenAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Section>

      <Section
        eyebrow="Relevance triage"
        heading={`Queries with answers but zero clicks (${unclicked.length})`}
      >
        <Card>
          {unclicked.length === 0 ? (
            <p className="text-[14px] text-[var(--color-muted)]">
              Every answered query in the last {DAYS_BACK} days got at least
              one click.
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <Th>Query</Th>
                  <Th align="right">Occurrences</Th>
                  <Th align="right">Top result count</Th>
                  <Th align="right">Last seen</Th>
                </tr>
              </thead>
              <tbody>
                {unclicked.map((q) => (
                  <tr
                    key={q.query}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <Td>
                      <span className="font-mono">{q.query}</span>
                    </Td>
                    <Td align="right">{fmt(q.occurrences)}</Td>
                    <Td align="right">{fmt(q.topResultCount)}</Td>
                    <Td align="right">{fmtDate(q.lastSeenAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Section>
    </div>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <Eyebrow className="mb-1">{label}</Eyebrow>
      <div className="text-[24px] font-semibold text-[var(--color-ink)]">
        {value}
      </div>
      {hint ? (
        <p className="mt-1 text-[12px] text-[var(--color-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      scope="col"
      className={
        "px-3 py-2 text-[12px] font-medium uppercase tracking-wide " +
        (align === "right" ? "text-right" : "text-left")
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td
      className={
        "px-3 py-2 text-[var(--color-ink)] " +
        (align === "right" ? "text-right tabular-nums" : "text-left")
      }
    >
      {children}
    </td>
  );
}
