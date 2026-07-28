"use client";

// Client side of ~/.vibelog/config.json: one GET on mount, saves are POSTed
// immediately (no save button anywhere). `saved` pulses true for 2s after a
// successful write so forms can show a quiet confirmation.

import { useCallback, useEffect, useRef, useState } from "react";
import DEFAULTS from "../../config.defaults.json";

export type Config = typeof DEFAULTS;

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let on = true;
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => on && setConfig(c))
      // API unreachable (static preview) — fall back to defaults so pages render
      .catch(() => on && setConfig({ ...DEFAULTS }));
    return () => {
      on = false;
    };
  }, []);

  const save = useCallback((patch: Partial<Config>) => {
    setConfig((c) => (c ? { ...c, ...patch } : c)); // optimistic; POST confirms
    fetch("/api/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    })
      .then((r) => {
        if (!r.ok) return;
        setSaved(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setSaved(false), 2000);
      })
      .catch(() => {});
  }, []);

  return { config, save, saved };
}
