"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DAILY, computeDaily, type Session } from "@/lib/data";
import { useLive, type Mode } from "@/lib/live";
import { fmtUsd, fmtTokens, fmtDuration, timeAgo } from "@/lib/format";
import { PageHeader, Stat, Card, StatusLabel, TapeReel } from "@/components/ui";
import { Tape } from "@/components/tape";
import { Sparkline } from "@/components/charts";

// Prefer the phase the CLI reports; derive from the last event for demo data.
function phaseOf(s: Session) {
  const p =
    s.phase ??
    (s.events[s.events.length - 1]?.kind === "tool"
      ? "tool"
      : s.events[s.events.length - 1]?.kind === "thinking"
        ? "reasoning"
        : "writing");
  return p === "tool" ? "running tools" : p;
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <span className="inline-flex overflow-hidden rounded border border-line font-mono text-[10px] uppercase tracking-wider">
      {(["mock", "live"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={`px-2 py-[3px] transition-colors ${
            mode === m ? "bg-wash text-ink" : "text-ink-3 hover:text-ink-2"
          } ${m === "live" ? "border-l border-line" : ""}`}
        >
          {m}
        </button>
      ))}
    </span>
  );
}

export function MissionClient() {
  const { sessions, now, isLive, mode, alive, setMode } = useLive();
  const daily = isLive ? computeDaily(sessions, now) : DAILY;
  const today = daily[daily.length - 1];
  const live = sessions.filter((s) => s.status === "live");
  const weekSessions = sessions.filter(
    (s) => s.startedAt > now - 7 * 24 * 3_600_000 && s.status !== "queued"
  );
  const failRate = weekSessions.length
    ? (weekSessions.filter((s) => s.status === "failed").length / weekSessions.length) * 100
    : 0;
  const recent = sessions.filter((s) => s.status !== "live" && s.status !== "queued").slice(0, 8);
  const queued = sessions.filter((s) => s.status === "queued");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mission control"
        sub={new Date(now).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        right={
          <span className="inline-flex flex-wrap items-center gap-3">
            {mode === "live" && !alive && (
              <span className="font-mono text-[10px] text-ink-3">
                run <span className="text-ink-2">vibelog start</span> to connect
              </span>
            )}
            <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-2">
              <span className="size-1.5 rounded-full bg-rec animate-blink" />
              {live.length} recording
            </span>
            <ModeToggle mode={mode} setMode={setMode} />
          </span>
        }
      />

      <section className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
        <Stat label="Spend today" value={fmtUsd(today.costUsd)} hint="across all agents" />
        <Stat label="Sessions today" value={String(today.sessions)} hint={`${queued.length} queued`} />
        <Stat label="Tokens today" value={fmtTokens(today.tokens)} hint="in + out" />
        <Stat label="Failure rate" value={failRate.toFixed(1) + "%"} hint="last 7 days" />
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          On the air
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {live.map((s) => (
            <Link key={s.id} href={`/sessions/${s.id}`} className="group">
              <Card className="relative p-5 transition-colors group-hover:border-line-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium">{s.title}</div>
                    <div className="mt-1 font-mono text-[11px] text-ink-3">
                      {s.id} · {s.agent} · {s.model}
                    </div>
                  </div>
                  <StatusLabel status={s.status} />
                </div>
                <Tape
                  events={s.events}
                  durationSec={s.durationSec}
                  live
                  height={56}
                  legend={false}
                  className="mt-4"
                />
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] tabular-nums text-ink-2">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-3">
                    <TapeReel />
                    {phaseOf(s)}
                  </span>
                  <span className="whitespace-nowrap">
                    {fmtDuration(Math.floor((now - s.startedAt) / 1000))} elapsed
                  </span>
                  <span className="whitespace-nowrap">{fmtTokens(s.tokensIn + s.tokensOut)} tok</span>
                  <span className="whitespace-nowrap">{fmtUsd(s.costUsd)} so far</span>
                </div>
              </Card>
            </Link>
          ))}
          {live.length === 0 && (
            <Card className="border-dashed p-8 text-sm text-ink-2">
              Nothing on the air. Start an agent session and it shows up here within a second.
            </Card>
          )}
          {queued.map((s) => (
            <Card key={s.id} className="relative border-dashed p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium text-ink-2">{s.title}</div>
                  <div className="mt-1 font-mono text-[11px] text-ink-3">
                    {s.id} · {s.agent} · waiting for a free slot
                  </div>
                </div>
                <StatusLabel status="queued" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              Recent sessions
            </h2>
            <Link
              href="/sessions"
              className="inline-flex items-center gap-0.5 text-xs text-ink-2 hover:text-ink"
            >
              All sessions <ArrowUpRight size={12} />
            </Link>
          </div>
          <Card>
            <table className="w-full text-sm">
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="group border-b border-line last:border-0">
                    <td className="py-0 pl-4 pr-2 align-middle">
                      <StatusLabel status={s.status} />
                    </td>
                    <td className="max-w-0 w-full truncate px-2 py-2.5">
                      <Link
                        href={`/sessions/${s.id}`}
                        className="hover:underline underline-offset-2"
                      >
                        {s.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-[11px] tabular-nums text-ink-3">
                      {fmtUsd(s.costUsd)}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-2 pr-4 text-right font-mono text-[11px] tabular-nums text-ink-3">
                      {timeAgo(s.startedAt, now)}
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-ink-2">
                      No finished sessions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Spend, last 30 days
          </h2>
          <Card className="p-4">
            <Sparkline
              points={daily.map((d) => d.costUsd)}
              labels={daily.map((d) => d.date)}
              fmt="usd"
              height={64}
            />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-3">
              <span>{daily[0].date}</span>
              <span>{daily[daily.length - 1].date}</span>
            </div>
            <div className="mt-3 border-t border-line pt-3 text-xs text-ink-2">
              {fmtUsd(daily.reduce((a, d) => a + d.costUsd, 0))} this month ·{" "}
              <Link href="/analytics" className="underline underline-offset-2 hover:text-ink">
                breakdown
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
