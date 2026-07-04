"use client";

import { useState } from "react";
import type { SessionEvent, EventKind } from "@/lib/data";
import { offsetClock } from "@/lib/format";

// The session tape: a flight-recorder strip of one agent session.
// Encoding is height + shade + shape (legend below), never color alone.
const KIND: Record<EventKind, { h: number; color: string; name: string }> = {
  prompt: { h: 1, color: "var(--color-ink)", name: "prompt" },
  output: { h: 0.78, color: "var(--color-ink)", name: "output" },
  tool: { h: 0.55, color: "var(--color-ink-2)", name: "tool call" },
  thinking: { h: 0.32, color: "var(--color-ink-3)", name: "reasoning" },
  checkpoint: { h: 0.55, color: "var(--color-ink)", name: "checkpoint" },
  error: { h: 1, color: "var(--color-rec)", name: "error" },
};

export function Tape({
  events,
  durationSec,
  live = false,
  height = 64,
  legend = true,
  className = "",
}: {
  events: SessionEvent[];
  durationSec: number;
  live?: boolean;
  height?: number;
  legend?: boolean;
  className?: string;
}) {
  const [tip, setTip] = useState<{ x: number; label: string; t: string } | null>(null);
  const W = 720;
  const H = height;
  const base = H - 12;
  const px = (at: number) => 6 + (at / Math.max(1, durationSec)) * (W - 12);

  return (
    <div className={className}>
      <div className="relative">
        {tip && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-md border border-line bg-surface px-2.5 py-1.5 shadow-sm"
            style={{
              left: `${tip.x * 100}%`,
              transform: `translate(${tip.x > 0.75 ? "-100%" : tip.x < 0.15 ? "0" : "-50%"}, -100%)`,
            }}
          >
            <div className="whitespace-nowrap font-mono text-[10px] text-ink-3">{tip.t}</div>
            <div className="max-w-64 truncate whitespace-nowrap text-xs font-medium">
              {tip.label}
            </div>
          </div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" onMouseLeave={() => setTip(null)}>
          {/* sprocket ruler */}
          {Array.from({ length: 25 }, (_, i) => (
            <line
              key={i}
              x1={6 + (i / 24) * (W - 12)}
              x2={6 + (i / 24) * (W - 12)}
              y1={base + 5}
              y2={base + 8}
              stroke="var(--color-line-2)"
              strokeWidth={1}
            />
          ))}
          <line x1={0} x2={W} y1={base} y2={base} stroke="var(--color-line-2)" strokeWidth={1} />
          {events.map((e, i) => {
            const k = KIND[e.kind];
            const x = px(e.at);
            const h = k.h * (H - 24);
            return (
              <g key={i}>
                {e.kind === "checkpoint" ? (
                  <rect
                    x={x - 3}
                    y={base - h - 3}
                    width={6}
                    height={6}
                    transform={`rotate(45 ${x} ${base - h})`}
                    fill={k.color}
                  />
                ) : null}
                <line
                  x1={x}
                  x2={x}
                  y1={base}
                  y2={base - h}
                  stroke={k.color}
                  strokeWidth={e.kind === "prompt" || e.kind === "error" ? 2.5 : 1.75}
                  strokeLinecap="round"
                  pathLength={live ? 1 : undefined}
                  strokeDasharray={live ? 1 : e.kind === "error" ? "3 2.5" : undefined}
                  style={
                    live
                      ? { animation: `tape-draw 0.5s ease-out both`, animationDelay: `${(x / W) * 0.5}s` }
                      : undefined
                  }
                />
                <rect
                  x={x - 5}
                  y={0}
                  width={10}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() =>
                    setTip({ x: x / W, label: e.label, t: offsetClock(e.at) + " · " + k.name })
                  }
                />
              </g>
            );
          })}
          {live && (
            <g>
              <line
                x1={W - 6}
                x2={W - 6}
                y1={base}
                y2={8}
                stroke="var(--color-rec)"
                strokeWidth={1.5}
              />
              <circle
                cx={W - 6}
                cy={8}
                r={3.5}
                fill="none"
                stroke="var(--color-rec)"
                strokeWidth={1.5}
                style={{ animation: "playhead-pulse 1.8s ease-out infinite" }}
              />
              <circle cx={W - 6} cy={8} r={3.5} fill="var(--color-rec)" className="animate-blink" />
            </g>
          )}
        </svg>
      </div>
      {legend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">
          {(["prompt", "output", "tool", "thinking", "checkpoint", "error"] as EventKind[]).map(
            (kind) => {
              const k = KIND[kind];
              return (
                <span key={kind} className="inline-flex items-center gap-1.5">
                  <svg width={10} height={12} aria-hidden>
                    {kind === "checkpoint" ? (
                      <rect x={2.5} y={3.5} width={5} height={5} transform="rotate(45 5 6)" fill={k.color} />
                    ) : (
                      <line
                        x1={5}
                        x2={5}
                        y1={11}
                        y2={11 - k.h * 9}
                        stroke={k.color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeDasharray={kind === "error" ? "2 2" : undefined}
                      />
                    )}
                  </svg>
                  {k.name}
                </span>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
