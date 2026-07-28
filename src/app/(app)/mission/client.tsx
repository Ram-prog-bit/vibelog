"use client";

import Link from "next/link";
import { ArrowUpRight, FolderGit2, GitBranch, Monitor } from "lucide-react";
import { type Session } from "@/lib/data";
import { useLive, type Mode } from "@/lib/live";
import { useConfig } from "@/lib/config";
import { fmtUsd, fmtTokens, fmtDuration, timeAgo } from "@/lib/format";
import { PageHeader, Stat, Card, StatusDot, StatusLabel, TapeReel, DemoBanner, EmptyState } from "@/components/ui";
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

// Nothing recorded on this machine — the recorder is ready, not broken.
// `onDemo` (first run only) offers the labeled demo dataset as a way to look
// around before recording anything; it never renders once real data exists.
function MissionEmpty({ onDemo }: { onDemo?: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <EmptyState
        tape
        title="Nothing on the air."
        sub="Start a Claude Code session and it shows up here."
        code="vibelog start"
        className="py-0"
      />
      {onDemo && (
        <button
          onClick={onDemo}
          className="mt-8 font-mono text-[11px] text-ink-3 underline underline-offset-2 transition-colors hover:text-ink"
        >
          or browse demo data →
        </button>
      )}
    </div>
  );
}

// First run with real recordings on disk: say what was found, one way forward.
function Welcome({
  sessions,
  total,
  onDone,
}: {
  sessions: Session[];
  total: number;
  onDone: () => void;
}) {
  const tokens = sessions.reduce((a, s) => a + s.tokensIn + s.tokensOut, 0);
  const cost = sessions.reduce((a, s) => a + s.costUsd, 0);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <span className="mb-8 grid size-10 place-items-center rounded-full border-[1.5px] border-ink">
        <span className="size-2.5 rounded-full bg-rec animate-blink" />
      </span>
      <h1 className="font-serif text-5xl tracking-tight max-sm:text-4xl">Welcome to VibeLog</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-2">
        Your flight recorder scanned this machine and found Claude Code sessions already on disk.
        Everything stays local.
      </p>
      <div className="mt-12 grid grid-cols-3 gap-10 max-sm:gap-6">
        <div>
          <div className="text-[28px] font-semibold tracking-tight tabular-nums">{total}</div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-3">
            sessions
          </div>
        </div>
        <div>
          <div className="text-[28px] font-semibold tracking-tight tabular-nums">
            {fmtTokens(tokens)}
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-3">
            tokens
          </div>
        </div>
        <div>
          <div className="text-[28px] font-semibold tracking-tight tabular-nums">
            {fmtUsd(cost)}
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-3">
            est. cost
          </div>
        </div>
      </div>
      {total > sessions.length && (
        <p className="mt-3 font-mono text-[11px] text-ink-3">
          tokens and cost cover the newest {sessions.length}
        </p>
      )}
      <button
        onClick={onDone}
        className="mt-12 inline-flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-85"
      >
        Show me my sessions <span aria-hidden>→</span>
      </button>
    </div>
  );
}

export function MissionClient() {
  const { sessions, totalSessions, now, daily, mode, isDemo, alive, graceOver, setMode, project } =
    useLive();
  const { config, save } = useConfig();
  const today = daily[daily.length - 1];
  const live = sessions.filter((s) => s.status === "live");

  // ---- first run ----
  // Until onboarded, this page never shows demo data: a brand-new user either
  // gets the welcome screen (real sessions found on disk) or the empty state.
  if (!config) return null; // config GET is a local round-trip — a frame or two
  if (!config.onboarded) {
    if (!alive && !graceOver) return null; // let live-detection settle (≤3s)
    const real = isDemo ? [] : sessions;
    if (real.length === 0)
      return (
        <MissionEmpty
          onDemo={() => {
            save({ onboarded: true });
            setMode("mock");
          }}
        />
      );
    return <Welcome sessions={real} total={totalSessions} onDone={() => save({ onboarded: true })} />;
  }

  // recording, but every recorded session was pruned or deleted
  if (!isDemo && mode === "live" && sessions.length === 0) return <MissionEmpty />;

  const weekSessions = sessions.filter(
    (s) => s.startedAt > now - 7 * 24 * 3_600_000 && s.status !== "queued"
  );
  const failRate = weekSessions.length
    ? (weekSessions.filter((s) => s.status === "failed").length / weekSessions.length) * 100
    : 0;
  const recent = sessions.filter((s) => s.status !== "live" && s.status !== "queued").slice(0, 8);
  const queued = sessions.filter((s) => s.status === "queued");

  // Team mode: sessions arrive labeled with the machine that recorded them.
  // One machine on the air is not a team — the section appears at two.
  const machines = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.machine ?? "this machine";
    (machines.get(key) ?? machines.set(key, []).get(key)!).push(s);
  }

  return (
    <div className="space-y-8">
      {isDemo && <DemoBanner />}
      <PageHeader
        title="Mission control"
        sub={new Date(now).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        right={
          <span className="inline-flex flex-wrap items-center gap-3">
            {project && (
              <span className="inline-flex items-center gap-2 font-mono text-[11px] text-ink-2">
                <span className="inline-flex items-center gap-1">
                  <FolderGit2 size={12} className="text-ink-3" />
                  {project.projectName}
                </span>
                <span className="inline-flex items-center gap-1 text-ink-3">
                  <GitBranch size={11} />
                  {project.gitBranch}
                </span>
              </span>
            )}
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
        <Stat
          label="Spend today"
          value={`${fmtUsd(today.costUsd)} est.`}
          hint="all agents · list-price estimate"
        />
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
            <Card className="flex flex-col items-start gap-3 border-dashed p-8">
              <span className="text-ink-3">
                <TapeReel active={false} />
              </span>
              <div>
                <div className="text-sm font-medium">Nothing on the air</div>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">
                  Start an agent session and it shows up here within a second. Not recording yet?
                </p>
              </div>
              <code className="rounded-md bg-code-bg px-2.5 py-1.5 font-mono text-xs text-code-fg">
                vibelog start
              </code>
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

      {machines.size > 1 && (
        <section>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Team · {machines.size} machines
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...machines.entries()].map(([name, ms]) => {
              const liveN = ms.filter((s) => s.status === "live").length;
              return (
                <Card key={name} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Monitor size={14} className="shrink-0 text-ink-3" />
                      <span className="truncate font-mono text-[13px] font-medium">{name}</span>
                    </span>
                    {liveN > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-rec">
                        <span className="size-1 rounded-full bg-rec animate-blink" />
                        {liveN} live
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-mono text-[11px] tabular-nums text-ink-2">
                    {ms.length} {ms.length === 1 ? "session" : "sessions"} ·{" "}
                    {fmtUsd(ms.reduce((a, s) => a + s.costUsd, 0))} est.
                  </div>
                  <ul className="mt-3 space-y-1 border-t border-line pt-3">
                    {ms.slice(0, 3).map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-xs">
                        <StatusDot status={s.status} />
                        <Link
                          href={`/sessions/${s.id}`}
                          className="min-w-0 truncate text-ink-2 hover:text-ink hover:underline underline-offset-2"
                        >
                          {s.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </section>
      )}

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
                    {/* on a 320px card status + cost + age left the title ~90px
                        ("Refactor feat…"); age is the least useful of the three */}
                    <td className="whitespace-nowrap py-2.5 pl-2 pr-4 text-right font-mono text-[11px] tabular-nums text-ink-3 max-sm:hidden">
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
            Spend, last 30 days (est.)
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
