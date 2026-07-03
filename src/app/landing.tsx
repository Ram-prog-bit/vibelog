"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { SESSIONS, type SessionEvent } from "@/lib/data";
import { fmtUsd, fmtTokens } from "@/lib/format";
import { Tape } from "@/components/tape";
import { BarChart } from "@/components/charts";
import { ThemeToggle } from "@/components/theme-toggle";
import { DAILY } from "@/lib/data";

// ---- hand-authored tapes for the hero and the "shapes" section ----

const tick = (at: number, kind: SessionEvent["kind"], label: string): SessionEvent => ({
  at,
  kind,
  label,
});

const HERO_EVENTS: SessionEvent[] = [
  tick(0, "prompt", "Fix timezone bug in the invoice scheduler"),
  tick(9, "thinking", "Reasoning"),
  tick(16, "tool", "Read src/invoices/scheduler.ts"),
  tick(24, "tool", "Grep \"toLocaleString\""),
  tick(31, "tool", "Read src/invoices/format.ts"),
  tick(40, "output", "Found it — wall-clock times stored without zone info"),
  tick(52, "tool", "Edit src/invoices/scheduler.ts"),
  tick(60, "tool", "Edit src/invoices/format.ts"),
  tick(67, "tool", "Bash npm test -- invoices"),
  tick(83, "checkpoint", "Tests green"),
  tick(90, "tool", "Bash npm run typecheck"),
  tick(101, "checkpoint", "Typecheck clean"),
  tick(108, "tool", "Edit src/invoices/scheduler.test.ts"),
  tick(116, "tool", "Bash npm test -- invoices"),
  tick(129, "checkpoint", "Tests green"),
  tick(137, "output", "Done — timestamps are UTC end to end now"),
  tick(144, "checkpoint", "Commit"),
];

const SHAPES: { name: string; caption: string; events: SessionEvent[]; dur: number }[] = [
  {
    name: "A healthy run",
    caption: "Steady rhythm — read, edit, test, commit. You can stop watching this one.",
    dur: 120,
    events: [
      tick(0, "prompt", "Prompt"),
      tick(10, "tool", "Read"),
      tick(18, "tool", "Edit"),
      tick(26, "tool", "Bash npm test"),
      tick(36, "checkpoint", "Tests green"),
      tick(44, "tool", "Read"),
      tick(52, "tool", "Edit"),
      tick(60, "tool", "Bash npm test"),
      tick(70, "checkpoint", "Tests green"),
      tick(80, "tool", "Edit"),
      tick(88, "tool", "Bash npm test"),
      tick(98, "checkpoint", "Tests green"),
      tick(110, "output", "Summary"),
    ],
  },
  {
    name: "A stuck run",
    caption: "The long silence after minute one is a hung test suite. Worth interrupting.",
    dur: 120,
    events: [
      tick(0, "prompt", "Prompt"),
      tick(8, "tool", "Read"),
      tick(14, "tool", "Edit"),
      tick(20, "tool", "Bash npm test"),
      tick(112, "output", "…still waiting on the suite"),
    ],
  },
  {
    name: "A failing run",
    caption: "Retries piling into red at the end. The transcript says why.",
    dur: 120,
    events: [
      tick(0, "prompt", "Prompt"),
      tick(12, "tool", "Read"),
      tick(20, "tool", "Edit"),
      tick(28, "tool", "Bash npm test"),
      tick(40, "error", "3 tests failing"),
      tick(50, "tool", "Edit"),
      tick(58, "tool", "Bash npm test"),
      tick(70, "error", "3 tests failing"),
      tick(80, "tool", "Edit"),
      tick(88, "tool", "Bash npm test"),
      tick(100, "error", "Retry limit reached"),
      tick(112, "error", "Session failed"),
    ],
  },
];

// ---- animated hero tape ----

const HERO_KIND: Record<string, { h: number; color: string; w: number }> = {
  prompt: { h: 1, color: "var(--color-ink)", w: 2.5 },
  output: { h: 0.78, color: "var(--color-ink)", w: 2 },
  tool: { h: 0.55, color: "var(--color-ink-2)", w: 1.75 },
  thinking: { h: 0.32, color: "var(--color-ink-3)", w: 1.75 },
  checkpoint: { h: 0.55, color: "var(--color-ink)", w: 1.75 },
  error: { h: 1, color: "var(--color-rec)", w: 2.5 },
};

function HeroTape() {
  const W = 920;
  const H = 120;
  const base = H - 22;
  const dur = 160;
  const px = (at: number) => 8 + (at / dur) * (W - 16);

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(26,26,28,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 font-mono text-[11px] text-ink-3">
          <span className="inline-flex items-center gap-1.5 uppercase tracking-wider text-rec">
            <motion.span
              className="size-1.5 rounded-full bg-rec"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            rec
          </span>
          <span>S-0998 · claude-code · claude-fable-5 · fix/invoice-tz</span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-ink-3">
          02:24 · 41.2k tok · $1.87
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        {Array.from({ length: 33 }, (_, i) => (
          <line
            key={i}
            x1={8 + (i / 32) * (W - 16)}
            x2={8 + (i / 32) * (W - 16)}
            y1={base + 6}
            y2={base + 10}
            stroke="var(--color-line-2)"
            strokeWidth={1}
          />
        ))}
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--color-line-2)" strokeWidth={1} />
        {HERO_EVENTS.map((e, i) => {
          const k = HERO_KIND[e.kind];
          const x = px(e.at);
          const h = k.h * (H - 40);
          return (
            <motion.line
              key={i}
              x1={x}
              x2={x}
              y1={base}
              y2={base - h}
              stroke={k.color}
              strokeWidth={k.w}
              strokeLinecap="round"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ transformOrigin: `${x}px ${base}px` }}
              transition={{ delay: 0.5 + i * 0.09, duration: 0.35, ease: "easeOut" }}
            />
          );
        })}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 + HERO_EVENTS.length * 0.09, duration: 0.4 }}
        >
          <line
            x1={px(152)}
            x2={px(152)}
            y1={10}
            y2={base}
            stroke="var(--color-rec)"
            strokeWidth={1.5}
          />
          <circle cx={px(152)} cy={10} r={3.5} fill="var(--color-rec)" />
        </motion.g>
      </svg>
      <div className="mt-3 flex justify-between font-mono text-[10px] tabular-nums text-ink-3">
        <span>00:00</span>
        <span>the last event — “Done, timestamps are UTC end to end” — landed 4s ago</span>
        <span>02:40</span>
      </div>
    </div>
  );
}

// ---- shared section reveal ----

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function Landing() {
  const sample = SESSIONS.find((s) => s.status === "live") ?? SESSIONS[0];

  return (
    <div className="min-h-screen bg-paper">
      {/* nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-full border-[1.5px] border-ink">
            <span className="size-1.5 rounded-full bg-rec" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">VibeLog</span>
        </Link>
        <div className="flex items-center gap-4 text-[13px]">
          <Link href="/docs" className="text-ink-2 hover:text-ink">
            Docs
          </Link>
          <ThemeToggle />
          <Link
            href="/mission"
            className="rounded-md bg-ink px-3.5 py-1.5 font-medium text-paper transition-opacity hover:opacity-85"
          >
            Open workspace
          </Link>
        </div>
      </nav>

      {/* hero */}
      <header className="mx-auto max-w-5xl px-6 pt-16 pb-20 md:pt-24">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3"
        >
          Local-first agent tracking
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="mt-5 max-w-3xl text-[44px] font-semibold leading-[1.04] tracking-[-0.02em] md:text-[64px]"
        >
          Your agents,{" "}
          <em className="font-serif font-normal italic tracking-normal">on the record</em>.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.16 }}
          className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2"
        >
          VibeLog records every agent session — prompts, tool calls, output, cost — to your own
          disk, and makes it readable. A flight recorder for the work you delegate.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.24 }}
          className="mt-8 flex flex-wrap items-center gap-4"
        >
          <Link
            href="/mission"
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-85"
          >
            Open mission control <ArrowRight size={14} />
          </Link>
          <Link href="/docs" className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
            Read the docs
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-16"
        >
          <HeroTape />
        </motion.div>
      </header>

      {/* shapes */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <Reveal>
            <h2 className="max-w-2xl text-[28px] font-semibold leading-tight tracking-[-0.01em] md:text-[36px]">
              Read a session&apos;s <em className="font-serif font-normal italic">shape</em> before
              its words.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
              Every session renders as a tape. After a day with VibeLog you stop reading transcripts
              first — you glance at the strip and know which of your agents needs you.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {SHAPES.map((s) => (
              <Reveal key={s.name}>
                <div className="rounded-lg border border-line bg-paper p-5">
                  <Tape events={s.events} durationSec={s.dur} height={56} legend={false} />
                </div>
                <h3 className="mt-4 text-sm font-medium">{s.name}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{s.caption}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* feature rows */}
      <section className="mx-auto max-w-5xl space-y-24 px-6 py-24">
        <Reveal className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
              Mission control
            </p>
            <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.01em]">
              Everything on the air, one screen.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Live sessions with their tapes, the queue behind them, and today&apos;s spend — the
              whole fleet at a glance. When something needs you, it&apos;s red; when nothing does,
              the page is quiet.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-1 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{sample.title}</div>
                <div className="mt-0.5 font-mono text-[10px] text-ink-3">
                  {sample.id} · {sample.agent} · {sample.model}
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-2">
                <span className="size-1.5 rounded-full bg-rec animate-blink" /> recording
              </span>
            </div>
            <Tape
              events={sample.events}
              durationSec={sample.durationSec}
              live
              height={52}
              legend={false}
              className="mt-3"
            />
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] tabular-nums text-ink-2">
              <span className="whitespace-nowrap">{fmtTokens(sample.tokensIn + sample.tokensOut)} tok</span>
              <span className="whitespace-nowrap">{fmtUsd(sample.costUsd)} so far</span>
            </div>
          </div>
        </Reveal>

        <Reveal className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div className="order-last md:order-first">
            <div className="rounded-xl border border-line bg-surface p-5 font-mono text-[12px] leading-relaxed">
              <div className="grid grid-cols-[44px_1fr] gap-x-3 gap-y-1.5 text-ink-2">
                <span className="tabular-nums text-ink-3">00:16</span>
                <span>Read src/invoices/scheduler.ts</span>
                <span className="tabular-nums text-ink-3">00:24</span>
                <span>Grep &quot;toLocaleString&quot;</span>
                <span className="tabular-nums text-ink-3">00:40</span>
                <span className="rounded-md border border-line bg-paper px-2.5 py-1.5 font-sans text-[12.5px] text-ink">
                  Found it — the scheduler stores wall-clock times without zone info. Switching to
                  UTC timestamps and converting at render.
                </span>
                <span className="tabular-nums text-ink-3">00:52</span>
                <span>Edit src/invoices/scheduler.ts</span>
                <span className="tabular-nums text-ink-3">01:07</span>
                <span>Bash npm test -- invoices</span>
                <span className="tabular-nums text-ink-3">01:23</span>
                <span className="text-ink">◆ Tests green</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
              Transcripts
            </p>
            <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.01em]">
              The full transcript, byte for byte.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Every prompt, every tool call with its wall-clock time, every line the model wrote
              back. When a run goes sideways at 2am, the answer is in the log — not in your
              scrollback.
            </p>
          </div>
        </Reveal>

        <Reveal className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
              Analytics
            </p>
            <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.01em]">
              Know what your agents cost.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Spend per day, per model, per session. Tool latency at p50 and p95. Costs are computed
              from recorded token counts at rates you control — so the number is yours, not a bill
              you find out about later.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
                Daily spend
              </span>
              <span className="font-mono text-[11px] tabular-nums text-ink-2">last 30 days</span>
            </div>
            <BarChart
              points={DAILY.map((d) => d.costUsd)}
              labels={DAILY.map((d) => d.date)}
              fmt="usd"
              height={140}
            />
          </div>
        </Reveal>
      </section>

      {/* principles */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <Reveal>
            <h2 className="text-[28px] font-semibold tracking-[-0.01em]">
              Local-first is the feature.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {[
              {
                t: "Your disk, not our cloud",
                d: "Recordings live in ~/.vibelog on the machine that ran the agent. VibeLog works on a plane, in an air-gapped lab, and after we're gone.",
              },
              {
                t: "Plain files",
                d: "One NDJSON file per session, header first, one event per line. Parse it with a shell one-liner; grep it like anything else you own.",
              },
              {
                t: "No telemetry",
                d: "The workspace binds to localhost and makes no outbound requests. The only person who knows what your agents did is you.",
              },
            ].map((p) => (
              <Reveal key={p.t}>
                <h3 className="text-sm font-medium">{p.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{p.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* closer */}
      <section className="mx-auto max-w-5xl px-6 py-28 text-center">
        <Reveal>
          <p className="mx-auto max-w-2xl text-[34px] leading-[1.15] tracking-[-0.01em] md:text-[44px]">
            <span className="font-semibold">Stop scrolling terminal history.</span>{" "}
            <em className="font-serif italic text-ink-2">Start keeping records.</em>
          </p>
          <Link
            href="/mission"
            className="mt-10 inline-flex items-center gap-1.5 rounded-md bg-ink px-5 py-3 text-sm font-medium text-paper transition-opacity hover:opacity-85"
          >
            Open mission control <ArrowRight size={14} />
          </Link>
          <p className="mt-4 font-mono text-[11px] text-ink-3">
            free while in beta · no account · npm install -g vibelog
          </p>
        </Reveal>
      </section>

      {/* footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-[13px] text-ink-2">
          <div className="flex items-center gap-2">
            <span className="grid size-4 place-items-center rounded-full border-[1.5px] border-ink">
              <span className="size-1 rounded-full bg-rec" />
            </span>
            <span className="font-medium text-ink">VibeLog</span>
            <span className="font-mono text-[11px] text-ink-3">0.4.2 · MIT</span>
          </div>
          <div className="flex gap-6">
            <Link href="/docs" className="hover:text-ink">
              Docs
            </Link>
            <Link href="/mission" className="hover:text-ink">
              Workspace
            </Link>
            <Link href="/settings" className="hover:text-ink">
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
