import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getServerApiClient } from "@/lib/api-client-server";
import { buildDayRows, summarise } from "./aggregations";
import type { DailyParseMetric } from "@/lib/ai-parser/metrics";

// AI cost dashboard per Phase 2 task 2.13. Renders the last 14
// days of AI parse activity broken down by source (Azure OpenAI vs
// strict-template fallback), with token totals and a today-vs-budget
// pill at the top.
//
// Auth: Phase 4 task 4.6 will gate this route to an "ops" role. For
// now we rely on the route being unlinked from the main nav and on
// the eventual gateway.

export const metadata: Metadata = {
  title: "AI cost · DTS Portfolio Portal",
  // Don't index the ops surface even if it's accidentally exposed.
  robots: { index: false, follow: false },
};

const DAYS_BACK = 14;

// --- API response shapes (snake_case from the Python backend) ---

interface ApiDailyParseMetric {
  day: string;
  source: string;
  parse_count: number;
  success_count: number;
  failure_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  avg_latency_ms: number;
}

interface ApiAiParseMetricsSummary {
  today_tokens: number;
  budget_tokens_per_day: number | null;
  exceeded: boolean;
  total_parses: number;
  total_successes: number;
  total_failures: number;
  total_tokens: number;
  daily_metrics: ApiDailyParseMetric[];
}

export default async function AiCostPage() {
  const api = await getServerApiClient();
  const summary = await api.get<ApiAiParseMetricsSummary>(
    "/api/ops/ai-parse-metrics",
  );

  // Map the snake_case API response to the camelCase shapes the
  // aggregation helpers expect (they were written against the Prisma
  // DailyParseMetric type).
  const rows: DailyParseMetric[] = summary.daily_metrics.map((m) => ({
    day: m.day,
    source: m.source,
    parseCount: m.parse_count,
    successCount: m.success_count,
    failureCount: m.failure_count,
    promptTokens: m.prompt_tokens,
    completionTokens: m.completion_tokens,
    totalTokens: m.total_tokens,
    avgLatencyMs: m.avg_latency_ms,
  }));

  const budget = {
    budgetTokensPerDay: summary.budget_tokens_per_day,
    todayTokens: summary.today_tokens,
    exceeded: summary.exceeded,
  };

  const days = buildDayRows(rows);
  const totals = summarise(rows);

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Ops · AI cost"
        title="AI parsing activity"
        lede="Per-day breakdown of AI parse invocations. Counts come from every upload + every re-parse during approval, including failed parses. Used to spot runaway spend before the invoice arrives."
      />

      <Section eyebrow="Today" heading="Budget pulse">
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Tile label="Today's tokens" value={fmt(budget.todayTokens)} />
            <Tile
              label="Budget (tokens / day)"
              value={
                budget.budgetTokensPerDay === null
                  ? "Not set"
                  : fmt(budget.budgetTokensPerDay)
              }
              hint={
                budget.budgetTokensPerDay === null
                  ? "Set AI_PARSE_BUDGET_TOKENS_PER_DAY to enable the alert."
                  : undefined
              }
            />
            <Tile
              label="Status"
              value={budget.exceeded ? "Budget exceeded" : "Within budget"}
              tone={budget.exceeded ? "alert" : "ok"}
            />
          </div>
        </Card>
      </Section>

      <Section
        eyebrow={`Trailing ${DAYS_BACK} days`}
        heading="Daily parses by source"
      >
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Tile label="Total parses" value={fmt(totals.parses)} />
            <Tile label="Successful" value={fmt(totals.successes)} />
            <Tile label="Failed" value={fmt(totals.failures)} />
            <Tile label="Total tokens" value={fmt(totals.totalTokens)} />
          </div>
        </Card>

        <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <Th>Day</Th>
                <Th>Source</Th>
                <Th align="right">Parses</Th>
                <Th align="right">Successful</Th>
                <Th align="right">Failed</Th>
                <Th align="right">Prompt tok.</Th>
                <Th align="right">Completion tok.</Th>
                <Th align="right">Total tok.</Th>
                <Th align="right">Avg latency (ms)</Th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-[var(--color-muted)]"
                    colSpan={9}
                  >
                    No parses recorded in the last {DAYS_BACK} days.
                  </td>
                </tr>
              ) : (
                days.map((d) => (
                  <tr
                    key={`${d.day}-${d.source}`}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <Td>{d.day}</Td>
                    <Td>
                      <Eyebrow>{d.source}</Eyebrow>
                    </Td>
                    <Td align="right">{fmt(d.parseCount)}</Td>
                    <Td align="right">{fmt(d.successCount)}</Td>
                    <Td align="right">{fmt(d.failureCount)}</Td>
                    <Td align="right">{fmt(d.promptTokens)}</Td>
                    <Td align="right">{fmt(d.completionTokens)}</Td>
                    <Td align="right">{fmt(d.totalTokens)}</Td>
                    <Td align="right">{Math.round(d.avgLatencyMs)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "alert";
}) {
  return (
    <div>
      <Eyebrow className="mb-1">{label}</Eyebrow>
      <div
        className={
          tone === "alert"
            ? "text-[24px] font-semibold text-[var(--color-alert,#a31621)]"
            : "text-[24px] font-semibold text-[var(--color-ink)]"
        }
      >
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
        "px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide " +
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
        "px-4 py-2 text-[var(--color-ink)] " +
        (align === "right" ? "text-right tabular-nums" : "text-left")
      }
    >
      {children}
    </td>
  );
}
