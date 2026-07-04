"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { type SessionEvent } from "@/lib/data";
import { useLive } from "@/lib/live";
import { fmtUsd, fmtTokens, fmtDuration, offsetClock, timeAgo } from "@/lib/format";
import { Card, Stat, StatusLabel, TapeReel } from "@/components/ui";
import { Tape } from "@/components/tape";

function EventRow({ e, live }: { e: SessionEvent; live: boolean }) {
  const hasBody = e.detail && (e.kind === "prompt" || e.kind === "output" || e.kind === "error");
  return (
    <li className="relative pl-20">
      <span className="absolute left-0 top-0.5 font-mono text-[11px] tabular-nums text-ink-3">
        {offsetClock(e.at)}
      </span>
      {hasBody ? (
        <div
          className={`rounded-lg border p-4 ${
            e.kind === "error" ? "border-rec/30 bg-rec-soft/40" : "border-line bg-surface"
          }`}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span
              className={`font-mono text-[10px] uppercase tracking-wider ${
                e.kind === "error" ? "text-rec" : "text-ink-3"
              }`}
            >
              {e.kind === "prompt" ? "prompt · you" : e.kind === "error" ? "error" : e.label}
            </span>
            {e.tokens && (
              <span className="font-mono text-[10px] tabular-nums text-ink-3">
                {fmtTokens(e.tokens)} tok
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-ink">{e.detail}</p>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-3 py-0.5">
          <span className="font-mono text-[13px] text-ink-2">
            {e.kind === "thinking" ? (
              <span className="inline-flex items-center gap-1.5 italic text-ink-3">
                reasoning <TapeReel active={live} />
              </span>
            ) : (
              e.label
            )}
          </span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-3">
            {e.durMs ? (e.durMs / 1000).toFixed(1) + "s" : e.tokens ? fmtTokens(e.tokens) + " tok" : ""}
          </span>
        </div>
      )}
    </li>
  );
}

export function SessionClient() {
  const { id } = useParams<{ id: string }>();
  const { sessions, now } = useLive();
  // live ids only exist once the first SSE frame lands — give it a beat
  // before declaring the session missing instead of hard-404ing
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const s = sessions.find((x) => x.id === decodeURIComponent(id));
  if (!s)
    return (
      <div className="py-24 text-center text-sm text-ink-2">
        {waited ? (
          <>
            No session with id <span className="font-mono">{decodeURIComponent(id)}</span>.{" "}
            <Link href="/sessions" className="underline underline-offset-2 hover:text-ink">
              All sessions
            </Link>
          </>
        ) : (
          "Loading session…"
        )}
      </div>
    );

  const elapsed = s.status === "live" ? Math.floor((now - s.startedAt) / 1000) : s.durationSec;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/sessions"
          className="mb-4 inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={12} /> Sessions
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">{s.title}</h1>
            <div className="mt-1.5 font-mono text-[11px] text-ink-3">
              {s.id} · {s.agent} · {s.model} · {s.branch} · started {timeAgo(s.startedAt, now)}
            </div>
          </div>
          <StatusLabel status={s.status} />
        </div>
      </div>

      <Card className="p-5">
        <Tape events={s.events} durationSec={s.durationSec} live={s.status === "live"} height={72} />
      </Card>

      <section className="grid grid-cols-2 gap-6 border-b border-line pb-8 lg:grid-cols-5">
        <Stat label="Cost" value={fmtUsd(s.costUsd)} />
        <Stat label="Duration" value={fmtDuration(elapsed)} />
        <Stat label="Tokens in" value={fmtTokens(s.tokensIn)} />
        <Stat label="Tokens out" value={fmtTokens(s.tokensOut)} />
        <Stat
          label="Tool calls"
          value={String(s.toolCalls)}
          hint={`${s.filesTouched} ${s.filesTouched === 1 ? "file" : "files"} touched`}
        />
      </section>

      <section>
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          Transcript
        </h2>
        {s.events.length === 0 ? (
          <Card className="p-8 text-center text-sm text-ink-2">
            Nothing recorded yet. The transcript starts as soon as the session leaves the queue.
          </Card>
        ) : (
          <ol className="space-y-3">
            {s.events.map((e, i) => (
              <EventRow key={i} e={e} live={s.status === "live"} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
