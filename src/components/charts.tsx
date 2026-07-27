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
    // No -translate-y-full here: Tailwind v4 compiles it to the `translate`
    // property, which composes with the inline `transform` below instead of
    // being overridden by it — the tip ended up a full box-height too high,
    // floating clear of the chart and over whatever card sat above it.
    <div
      className="pointer-events-none absolute -top-1 z-10 rounded-md border border-line bg-surface px-2.5 py-1.5 shadow-sm"
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
  // preserveAspectRatio="none" stretches x independently of y, so a circle
  // drawn in user units renders as an ellipse. Track the render width and
  // squeeze the marker's rx back by the same factor.
  const [renderW, setRenderW] = useState(0);
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
          setRenderW(r.width);
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
          <ellipse
            cx={px(idx)}
            cy={py(points[idx])}
            rx={3.5 * (renderW ? W / renderW : 1)}
            ry={3.5}
            fill="var(--color-ink)"
            stroke="var(--color-surface)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
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
  const pad = { t: 14, b: 6 };
  const max = Math.max(...points) * 1.08 || 1;
  const bw = W / points.length;
  const py = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const grid = [0.5, 1].map((f) => max * f * 0.9);
  // The viewBox scales to fill the container, so anything drawn inside it in
  // user units scales too: SVG <text> at fontSize 9 read as 15px at 1440 and
  // 5px at 390. Axis labels are HTML positioned by percentage instead — same
  // place at every width, always the size they say they are.
  const pct = (v: number) => `${(py(v) / H) * 100}%`;
  const showLabel = (i: number) =>
    (i % 7 === 0 && i < labels.length - 3) || i === labels.length - 1;

  return (
    <div className="relative">
      <TipBox tip={tip} />
      {/* own stacking context so the % offsets below track the plot, not the
          plot plus the date row underneath it */}
      <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        {grid.map((g) => (
          <line
            key={g}
            x1={0}
            x2={W}
            y1={py(g)}
            y2={py(g)}
            stroke="var(--color-line)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={0}
          x2={W}
          y1={H - pad.b}
          y2={H - pad.b}
          stroke="var(--color-line-2)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
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
      </svg>
      {grid.map((g) => (
        <span
          key={g}
          className="pointer-events-none absolute left-0 -translate-y-full pb-0.5 font-mono text-[10px] text-ink-3"
          style={{ top: pct(g) }}
        >
          {FMTS[fmt](g)}
        </span>
      ))}
      </div>
      <div className="relative mt-1 h-3.5 font-mono text-[10px] text-ink-3">
        {labels.map((l, i) =>
          showLabel(i) ? (
            <span
              key={i}
              // first label anchors left and last anchors right, or half of it
              // falls outside the container and gets clipped ("un 27")
              className="absolute whitespace-nowrap"
              style={{
                left: `${((i + 0.5) / points.length) * 100}%`,
                transform:
                  i === labels.length - 1
                    ? "translateX(-100%)"
                    : i === 0
                      ? "translateX(0)"
                      : "translateX(-50%)",
              }}
            >
              {l}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

// Horizontal p50→p95 latency ranges on a log scale, directly labeled.
export function LatencyRanges({
  rows,
}: {
  rows: { tool: string; p50: number; p95: number; calls: number }[];
}) {
  // log scale sized to the data — real p95s range from 0.04s (Read) to minutes
  // (Bash waiting on a test suite), so fixed bounds clip both ends. The upper
  // bound tracks the data: a hard 20s floor spent 60% of the axis on empty
  // decades whenever the slowest tool was quick, squeezing every range into an
  // unreadable sliver at the right edge.
  // Both bounds track the data. Fixed ones (0.02s–20s) spent most of the axis
  // on empty decades: every range collapsed into a sliver at one edge.
  const lo = Math.min(1, ...rows.map((r) => r.p50));
  const min = Math.max(0.01, lo / 2.5);
  const max = Math.max(1, ...rows.map((r) => r.p95)) * 1.15;
  const x = (v: number) =>
    Math.min(100, Math.max(0, (Math.log(Math.max(v, min) / min) / Math.log(max / min)) * 100));
  const ticks = [0.1, 1, 10, 100].filter((v) => v > min && v < max * 0.7);
  // MCP tools have very long ids (mcp__plugin_…__browser_evaluate); left
  // unchecked they wrap to three lines and collide with the bars.
  const short = (t: string) => (t.length > 40 ? t.slice(0, 39) + "…" : t);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div
          key={r.tool}
          className="grid grid-cols-[minmax(0,84px)_1fr_76px] items-center gap-2 sm:grid-cols-[minmax(0,150px)_1fr_88px] sm:gap-3"
        >
          <div className="truncate font-mono text-xs text-ink-2" title={r.tool}>
            {short(r.tool)}
          </div>
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
      <div className="grid grid-cols-[minmax(0,84px)_1fr_76px] gap-2 sm:grid-cols-[minmax(0,150px)_1fr_88px] sm:gap-3">
        <div />
        <div className="relative h-4 font-mono text-[10px] text-ink-3">
          {/* centred on the tick, except the outermost pair — left-anchored at
              0% and right-anchored at 100% they stay inside the track instead
              of running into their neighbour ("0.1s10s" at 390px) */}
          {ticks.map((v, i) => (
            <span
              key={v}
              className="absolute whitespace-nowrap"
              style={{
                left: `${x(v)}%`,
                transform:
                  i === ticks.length - 1 && x(v) > 90
                    ? "translateX(-100%)"
                    : x(v) < 5
                      ? "translateX(0)"
                      : "translateX(-50%)",
              }}
            >
              {v}s
            </span>
          ))}
        </div>
        <div className="text-right font-mono text-[10px] text-ink-3">p50 · p95</div>
      </div>
    </div>
  );
}
