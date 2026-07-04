import { NOW } from "./data";

export function fmtUsd(v: number) {
  return v >= 100 ? "$" + Math.round(v).toLocaleString("en-US") : "$" + v.toFixed(2);
}

// Per-session cost — financial precision. Real sessions run fractions of a cent
// to a few dollars, so show 6 decimals until the number is large enough not to.
export function fmtUsd6(v: number) {
  if (v === 0) return "$0";
  return v >= 1000 ? "$" + Math.round(v).toLocaleString("en-US") : "$" + v.toFixed(6);
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

export function offsetClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}
