"use client";

// Live data contract with the vibelog CLI (`vibelog start`):
//   - The CLI writes ~/.vibelog/state.json — { now, source, sessions } — every
//     tick. Live sessions carry `phase` (reasoning | writing | tool) and every
//     event a stable `seq`, so the tape can append spikes without re-animating.
//   - /api/stream re-broadcasts it as SSE `message` frames, plus an `hb`
//     frame each second carrying state.json's mtime. The CLI touches the file
//     every tick, so a fresh mtime means it is actually running — a stale
//     state.json from a previous run does not count as live.
//
// Mode: defaults to LIVE; if no CLI is detected within 3s the dashboard falls
// back to the built-in demo data (MOCK) and returns to LIVE when a CLI
// appears. A manual toggle (useLive().setMode) overrides the automatics.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DAILY,
  NOW,
  SESSIONS,
  computeDaily,
  shiftDaily,
  shiftSessions,
  type DayStat,
  type Session,
} from "./data";

export interface CurrentProject {
  projectName: string;
  gitBranch: string;
  gitRepo?: string;
}

export interface LiveState {
  now: number;
  source: "mock" | "claude-code";
  sessions: Session[];
  /** sessions on disk in the window, before the cap `sessions` was sliced to */
  totalSessions?: number;
  maxSessions?: number;
  project?: CurrentProject | null; // the dir vibelog was started in
}

export type Mode = "mock" | "live";

interface Ctx {
  state: LiveState | null;
  alive: boolean; // CLI heartbeat seen in the last 8s
  manual: Mode | null; // user's explicit toggle choice, null = automatic
  graceOver: boolean; // the 3s detection window has passed
  clock: number; // real wall clock once mounted; NOW during prerender/hydration
  setManual: (m: Mode) => void;
}

const LiveContext = createContext<Ctx>({
  state: null,
  alive: false,
  manual: null,
  graceOver: true,
  clock: NOW,
  setManual: () => {},
});

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LiveState | null>(null);
  const [alive, setAlive] = useState(false);
  const [manual, setManual] = useState<Mode | null>(null);
  const [graceOver, setGraceOver] = useState(false);
  // Starts at the demo anchor so server markup and the first client render
  // match, then jumps to the real clock. Ticking keeps "3m ago" honest on a
  // dashboard left open.
  const [clock, setClock] = useState(NOW);

  useEffect(() => {
    // deferred, not synchronous: hydration has to finish against the anchor
    // before the clock jumps, or the markup and the first render disagree
    const sync = () => setClock(Date.now());
    const first = setTimeout(sync, 0);
    const tick = setInterval(sync, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setGraceOver(true), 3000);
    const es = new EventSource("/api/stream");
    es.onmessage = (e) => {
      try {
        setState(JSON.parse(e.data));
      } catch {
        // half-written frame — the next tick replaces it
      }
    };
    es.addEventListener("hb", (e) =>
      setAlive(Number((e as MessageEvent).data) > Date.now() - 8_000)
    );
    es.onerror = () => setAlive(false);
    return () => {
      clearTimeout(t);
      es.close();
    };
  }, []);

  return (
    <LiveContext.Provider value={{ state, alive, manual, graceOver, clock, setManual }}>
      {children}
    </LiveContext.Provider>
  );
}

export function useLive() {
  const { state, alive, manual, graceOver, clock, setManual } = useContext(LiveContext);
  const mode: Mode = manual ?? (alive || !graceOver ? "live" : "mock");
  // Manual LIVE shows whatever real data we have (even a stale last state);
  // automatic LIVE requires a heartbeat so a stale file never masquerades as live.
  const real = mode === "live" && (alive || manual === "live") ? state : null;
  const isLive = mode === "live" && (real !== null || manual === "live");

  const shift = clock - NOW;
  const demoSessions = useMemo(() => shiftSessions(SESSIONS, shift), [shift]);
  const demoDaily = useMemo(() => shiftDaily(DAILY, shift), [shift]);

  const now = real?.now ?? clock;
  const sessions = real?.sessions ?? (isLive ? [] : demoSessions);
  const daily: DayStat[] = isLive ? computeDaily(sessions, now) : demoDaily;

  return {
    isLive,
    mode,
    // Everything on screen is simulated: either the built-in demo set, or a
    // CLI running `vibelog start --mock`. The second case used to show fake
    // sessions and fake money under a LIVE chip with no warning at all.
    isDemo: mode === "mock" || real?.source === "mock",
    alive,
    setMode: setManual,
    now,
    sessions,
    daily,
    // What the CLI actually holds vs what it sent. The dashboard shows the
    // newest `sessions.length` of `totalSessions`; when they differ, the pages
    // say so rather than presenting a capped list as a complete one.
    totalSessions: real?.totalSessions ?? sessions.length,
    project: real?.project ?? null,
  };
}
