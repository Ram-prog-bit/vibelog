"use client";

import { useState } from "react";
import { fmtUsd, fmtTokens } from "@/lib/format";

// serializable formatter keys — server pages can't pass functions across
export type Fmt = "usd" | "tokens" | "sessions";
const FMTS: Record<Fmt, (v: number) => string> = {
  usd: fmtUsd,
  tokens: fmtTokens,
  sessions: (v) => Math.round(v) + " sessions",
};

// One shared tooltip pattern: charts are wrapped in a relative container and
// report hover through setTip; the tooltip is plain HTML above the SVG.

export interface Tip {
  x: number; // 0..1 across the chart
  title: string;
  value: string;
}

function TipBox({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-md border border-line bg-surface px-2.5 py-1.5 shadow-sm"
      style={{
        left: `${tip.x * 100}%`,
        transform: `translate(${tip.x > 0.8 ? "-100%" : tip.x < 0.2 ? "0" : "-50%"}, -100%)`,
      }}
    >
      <div className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-ink-3">
        {tip.title}
      </div>
      <div className="whitespace-nowrap text-sm font-medium tabular-nums">{tip.value}</div>
    </div>
  );
}

export function Sparkline({
  points,
  labels,
  fmt,
  height = 56,
}: {
  points: number[];
  labels: string[];
  fmt: Fmt;
  height?: number;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [idx, setIdx] = useState<number | null>(null);
  const W = 400;
  const H = height;
  const max = Math.max(...points) * 1.1 || 1;
  const min = 0;
  const px = (i: number) => (i / (points.length - 1)) * W;
  const py = (v: number) => H - 4 - ((v - min) / (max - min)) * (H - 8);
  const d = points.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join("");

  return (
    <div className="relative">
      <TipBox tip={tip} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        style={{ height }}
        preserveAspectRatio="none"
        onMouseLeave={() => {
          setTip(null);
          setIdx(null);
        }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
          const c = Math.max(0, Math.min(points.length - 1, i));
          setIdx(c);
          setTip({ x: c / (points.length - 1), title: labels[c], value: FMTS[fmt](points[c]) });
        }}
      >
        {idx !== null && (
          <line
            x1={px(idx)}
            x2={px(idx)}
            y1={0}
            y2={H}
            stroke="var(--color-line-2)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path d={d} fill="none" stroke="var(--color-ink)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        {idx !== null && (
          <circle cx={px(idx)} cy={py(points[idx])} r={3.5} fill="var(--color-ink)" stroke="var(--color-surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  );
}

export function BarChart({
  points,
  labels,
  fmt,
  height = 160,
}: {
  points: number[];
  labels: string[];
  fmt: Fmt;
  height?: number;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [idx, setIdx] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const pad = { t: 8, b: 18 };
  const max = Math.max(...points) * 1.08 || 1;
  const bw = W / points.length;
  const py = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const grid = [0.5, 1].map((f) => max * f * 0.9);

  return (
    <div className="relative">
      <TipBox tip={tip} />
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        {grid.map((g) => (
          <g key={g}>
            <line x1={0} x2={W} y1={py(g)} y2={py(g)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={0} y={py(g) - 4} className="fill-ink-3" fontSize={9} fontFamily="var(--font-mono)">
              {FMTS[fmt](g)}
            </text>
          </g>
        ))}
        <line x1={0} x2={W} y1={H - pad.b} y2={H - pad.b} stroke="var(--color-line-2)" strokeWidth={1} />
        {points.map((v, i) => (
          <g key={i}>
            <rect
              x={i * bw + 2}
              width={Math.max(2, bw - 4)}
              y={py(v)}
              height={Math.max(1, H - pad.b - py(v))}
              rx={2}
              fill={idx === i ? "var(--color-ink)" : "var(--color-ink-2)"}
            />
            <rect
              x={i * bw}
              width={bw}
              y={0}
              height={H}
              fill="transparent"
              onMouseEnter={() => {
                setIdx(i);
                setTip({ x: (i + 0.5) / points.length, title: labels[i], value: FMTS[fmt](v) });
              }}
              onMouseLeave={() => {
                setIdx(null);
                setTip(null);
              }}
            />
          </g>
        ))}
        {labels.map((l, i) =>
          (i % 7 === 0 && i < labels.length - 3) || i === labels.length - 1 ? (
            <text
              key={i}
              x={i === labels.length - 1 ? W : i * bw + bw / 2}
              y={H - 5}
              textAnchor={i === labels.length - 1 ? "end" : "middle"}
              className="fill-ink-3"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              {l}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

// Horizontal p50→p95 latency ranges on a log scale, directly labeled.
export function LatencyRanges({
  rows,
}: {
  rows: { tool: string; p50: number; p95: number; calls: number }[];
}) {
  const min = 0.1;
  const max = 20;
  const x = (v: number) => (Math.log(v / min) / Math.log(max / min)) * 100;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.tool} className="grid grid-cols-[72px_1fr_88px] items-center gap-3">
          <div className="font-mono text-xs text-ink-2">{r.tool}</div>
          <div className="relative h-5">
            <div className="absolute inset-y-2 left-0 right-0 rounded bg-wash" />
            <div
              className="absolute inset-y-2 rounded bg-ink-3/60"
              style={{ left: `${x(r.p50)}%`, width: `${Math.max(1, x(r.p95) - x(r.p50))}%` }}
            />
            <div
              className="absolute top-1 bottom-1 w-[3px] rounded-full bg-ink"
              style={{ left: `${x(r.p50)}%` }}
            />
          </div>
          <div className="text-right font-mono text-[11px] tabular-nums text-ink-2">
            {r.p50.toFixed(r.p50 < 1 ? 2 : 1)}s · {r.p95.toFixed(1)}s
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[72px_1fr_88px] gap-3">
        <div />
        <div className="relative h-4 font-mono text-[10px] text-ink-3">
          {[0.1, 1, 10].map((v) => (
            <span key={v} className="absolute" style={{ left: `${x(v)}%` }}>
              {v}s
            </span>
          ))}
        </div>
        <div className="text-right font-mono text-[10px] text-ink-3">p50 · p95</div>
      </div>
    </div>
  );
}
