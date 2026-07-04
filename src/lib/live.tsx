"use client";

// Live data from the vibelog CLI (`vibelog start`), streamed over SSE from
// /api/stream. Until a first payload arrives the hook serves the built-in
// demo data, so the dashboard works standalone (e.g. deployed on Vercel).

import { createContext, useContext, useEffect, useState } from "react";
import { NOW, SESSIONS, type Session } from "./data";

export interface LiveState {
  now: number;
  source: "mock" | "claude-code";
  sessions: Session[];
}

const LiveContext = createContext<LiveState | null>(null);

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LiveState | null>(null);
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (e) => {
      try {
        setState(JSON.parse(e.data));
      } catch {
        // half-written frame — the next tick replaces it
      }
    };
    return () => es.close();
  }, []);
  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const live = useContext(LiveContext);
  return {
    isLive: live !== null,
    now: live?.now ?? NOW,
    sessions: live?.sessions ?? SESSIONS,
  };
}
