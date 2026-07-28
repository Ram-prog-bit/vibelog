"use client";

import Link from "next/link";
import {
  TOOL_LATENCY,
  TOOL_WAIT_CUTOFF_SEC,
  MOCK_SUMMARY,
  computeModelSplit,
  computeToolLatency,
  computeSummary,
} from "@/lib/data";
import { useLive } from "@/lib/live";
import { fmtUsd, fmtUsd6, fmtTokens, fmtPct } from "@/lib/format";
import { PageHeader, Stat, Card, DemoBanner, EmptyState } from "@/components/ui";
import { BarChart, Sparkline, LatencyRanges } from "@/components/charts";

const fmtSecs = (s: number) => (s >= 10 ? s.toFixed(1) : s.toFixed(2)) + "s";

export function AnalyticsClient() {
  const { sessions, totalSessions, now, daily, isLive, isDemo } = useLive();
  const modelSplit = computeModelSplit(sessions);
  const toolLatency = isLive ? computeToolLatency(sessions) : TOOL_LATENCY;
  const sum = isLive ? computeSummary(sessions, now) : MOCK_SUMMARY;
  const maxModel = Math.max(1e-9, ...modelSplit.map((m) => m.costUsd));

  // recording, nothing recorded yet — charts with all-zero axes read as broken
  if (isLive && sessions.length === 0)
    return (
      <div className="space-y-8">
        <PageHeader
          title="Analytics"
          sub="Cost and performance across every agent on this machine"
        />
        <EmptyState
          title="No data yet."
          sub="Analytics appear after your first session completes."
          className="min-h-[50vh] justify-center"
        />
      </div>
    );

  return (
    <div className="space-y-8">
      {isDemo && <DemoBanner />}
      <PageHeader
        title="Analytics"
        sub={`Cost and performance across every agent on this machine · last 30 days${
          totalSessions > sessions.length
            ? ` · newest ${sessions.length} of ${totalSessions} sessions`
            : ""
        }`}
      />

      <section className="grid grid-cols-2 gap-6 border-b border-line pb-8 lg:grid-cols-3">
        <Stat
          label="Total spend"
          value={`${fmtUsd(sum.totalSpend)} est.`}
          hint="list-price estimate, last 30 days"
        />
        <Stat label="Sessions" value={sum.totalSessions.toLocaleString("en-US")} />
        <Stat label="Avg cost / session" value={fmtUsd6(sum.avgCostUsd)} />
        <Stat label="Tokens" value={fmtTokens(sum.totalTokens)} hint="in + out, cache reads included" />
        <Stat
          label="Failure rate"
          value={fmtPct(sum.failureRate)}
          hint={`${sum.failed} of ${sum.finished} finished sessions`}
        />
        <Stat
          label="Tool latency p50 / p95"
          value={`${fmtSecs(sum.toolP50)} / ${fmtSecs(sum.toolP95)}`}
        />
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          Daily spend (est.)
        </h2>
        <Card className="p-5">
          <BarChart
            points={daily.map((d) => d.costUsd)}
            labels={daily.map((d) => d.date)}
            fmt="usd"
            height={180}
          />
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Spend by model (est.)
          </h2>
          <Card className="space-y-4 p-5">
            {modelSplit.map((m) => (
              <div key={m.model}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs text-ink">{m.model}</span>
                  <span className="font-mono text-[11px] tabular-nums text-ink-2">
                    {fmtUsd(m.costUsd)} · {m.sessions} sessions
                  </span>
                </div>
                <div className="h-2 rounded bg-wash">
                  <div
                    className="h-full rounded bg-ink"
                    style={{ width: `${Math.max(1.5, (m.costUsd / maxModel) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {modelSplit.length === 0 && (
              <p className="text-sm text-ink-2">No sessions recorded yet.</p>
            )}
            <p className="border-t border-line pt-3 text-xs text-ink-2">
              Every spend figure on this page is an estimate: recorded token counts priced at
              published list rates, which is not what a Max or Pro subscription actually bills. It
              covers the last 30 days only — not all time — and at most the newest{" "}
              {sessions.length} sessions, each including the subagents it spawned. The rates are in{" "}
              <Link href="/settings" className="underline underline-offset-2 hover:text-ink">
                Settings
              </Link>
              , edited via pricing.json.
            </p>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Tool latency
          </h2>
          <Card className="p-5">
            {toolLatency.length > 0 ? (
              <LatencyRanges rows={toolLatency} />
            ) : (
              <p className="text-sm text-ink-2">No tool timings recorded yet.</p>
            )}
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-2">
              Wall-clock time per tool call, log scale — top 10 tools by volume. Tools whose p95
              exceeds {TOOL_WAIT_CUTOFF_SEC}s are left out: they were waiting on you, not on a
              model.
            </p>
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Tokens per day
          </h2>
          <Card className="p-5">
            <Sparkline
              points={daily.map((d) => d.tokens)}
              labels={daily.map((d) => d.date)}
              fmt="tokens"
              height={72}
            />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-3">
              <span>{daily[0].date}</span>
              <span>{daily[daily.length - 1].date}</span>
            </div>
          </Card>
        </div>
        <div>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Sessions per day
          </h2>
          <Card className="p-5">
            <Sparkline
              points={daily.map((d) => d.sessions)}
              labels={daily.map((d) => d.date)}
              fmt="sessions"
              height={72}
            />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-3">
              <span>{daily[0].date}</span>
              <span>{daily[daily.length - 1].date}</span>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
