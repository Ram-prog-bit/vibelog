import { NOW } from "./data";

export function fmtUsd(v: number) {
  return v >= 100 ? "$" + Math.round(v).toLocaleString("en-US") : "$" + v.toFixed(2);
}

// Per-session cost — precision scaled to magnitude: sub-cent sessions need six
// decimals to be visible at all; dollar sessions read best at cents.
export function fmtUsd6(v: number) {
  if (v === 0) return "$0";
  if (v < 0.01) return "$" + v.toFixed(6);
  if (v < 1) return "$" + v.toFixed(4);
  if (v < 1000) return "$" + v.toFixed(2);
  return "$" + Math.round(v).toLocaleString("en-US");
}

export function fmtPct(v: number) {
  return (v * 100).toFixed(1) + "%";
}

export function fmtTokens(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "k";
  return String(v);
}

export function fmtDuration(sec: number) {
  if (sec < 60) return sec + "s";
  const m = Math.floor(sec / 60);
  if (m < 60) return m + "m " + Math.floor(sec % 60) + "s";
  return Math.floor(m / 60) + "h " + (m % 60) + "m";
}

export function timeAgo(epoch: number, now = NOW) {
  const s = Math.max(0, Math.floor((now - epoch) / 1000));
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  return d + "d ago";
}

export function clock(epoch: number) {
  return new Date(epoch).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function dateShort(epoch: number) {
  return new Date(epoch).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Offset from session start. mm:ss under an hour, h:mm:ss past it — a resumed
// session used to render as "79:08" or "1422:07", which reads as nonsense.
export function offsetClock(sec: number) {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor(t / 60) % 60;
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
