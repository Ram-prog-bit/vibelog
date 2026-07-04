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

import { createContext, useContext, useEffect, useState } from "react";
import { NOW, SESSIONS, type Session } from "./data";

export interface CurrentProject {
  projectName: string;
  gitBranch: string;
  gitRepo?: string;
}

export interface LiveState {
  now: number;
  source: "mock" | "claude-code";
  sessions: Session[];
  project?: CurrentProject | null; // the dir vibelog was started in
}

export type Mode = "mock" | "live";

interface Ctx {
  state: LiveState | null;
  alive: boolean; // CLI heartbeat seen in the last 8s
  manual: Mode | null; // user's explicit toggle choice, null = automatic
  graceOver: boolean; // the 3s detection window has passed
  setManual: (m: Mode) => void;
}

const LiveContext = createContext<Ctx>({
  state: null,
  alive: false,
  manual: null,
  graceOver: true,
  setManual: () => {},
});

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LiveState | null>(null);
  const [alive, setAlive] = useState(false);
  const [manual, setManual] = useState<Mode | null>(null);
  const [graceOver, setGraceOver] = useState(false);

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
    <LiveContext.Provider value={{ state, alive, manual, graceOver, setManual }}>
      {children}
    </LiveContext.Provider>
  );
}

export function useLive() {
  const { state, alive, manual, graceOver, setManual } = useContext(LiveContext);
  const mode: Mode = manual ?? (alive || !graceOver ? "live" : "mock");
  // Manual LIVE shows whatever real data we have (even a stale last state);
  // automatic LIVE requires a heartbeat so a stale file never masquerades as live.
  const real = mode === "live" && (alive || manual === "live") ? state : null;
  const isLive = mode === "live" && (real !== null || manual === "live");
  return {
    isLive,
    mode,
    alive,
    setMode: setManual,
    now: real?.now ?? NOW,
    sessions: real?.sessions ?? (isLive ? [] : SESSIONS),
    project: real?.project ?? null,
  };
}
