"use client";

import Link from "next/link";
import {
  DAILY,
  TOOL_LATENCY,
  MOCK_SUMMARY,
  computeDaily,
  computeModelSplit,
  computeToolLatency,
  computeSummary,
} from "@/lib/data";
import { useLive } from "@/lib/live";
import { fmtUsd, fmtUsd6, fmtTokens, fmtPct } from "@/lib/format";
import { PageHeader, Stat, Card } from "@/components/ui";
import { BarChart, Sparkline, LatencyRanges } from "@/components/charts";

const fmtSecs = (s: number) => (s >= 10 ? s.toFixed(1) : s.toFixed(2)) + "s";

export function AnalyticsClient() {
  const { sessions, now, isLive } = useLive();
  const daily = isLive ? computeDaily(sessions, now) : DAILY;
  const modelSplit = computeModelSplit(sessions);
  const toolLatency = isLive ? computeToolLatency(sessions) : TOOL_LATENCY;
  const sum = isLive ? computeSummary(sessions, now) : MOCK_SUMMARY;
  const maxModel = Math.max(1e-9, ...modelSplit.map((m) => m.costUsd));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        sub="Cost and performance across every agent on this machine · last 30 days"
      />

      <section className="grid grid-cols-2 gap-6 border-b border-line pb-8 lg:grid-cols-3">
        <Stat label="Total spend" value={fmtUsd(sum.totalSpend)} />
        <Stat label="Sessions" value={sum.totalSessions.toLocaleString("en-US")} />
        <Stat label="Avg cost / session" value={fmtUsd6(sum.avgCostUsd)} />
        <Stat label="Tokens" value={fmtTokens(sum.totalTokens)} />
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
          Daily spend
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
            Spend by model
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
              Costs are computed from recorded token counts at list price. Set your own rates in{" "}
              <Link href="/settings" className="underline underline-offset-2 hover:text-ink">
                Settings
              </Link>
              .
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
              Wall-clock time per tool call, log scale. Bash usually dominates because it runs your
              test suite.
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
