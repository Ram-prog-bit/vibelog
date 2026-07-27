import type { Session, SessionEvent } from "./data";
import { fmtDuration, fmtUsd6 } from "./format";

// Client-side export: files are generated from the sessions already in the
// browser (the SSE data) and downloaded via a Blob — no server round-trip.

// ---- CSV: one row per session, opens in Excel (BOM + CRLF + quoted cells) ----

const CSV_HEADER = [
  "id",
  "title",
  "status",
  "model",
  "agent",
  "machine",
  "project",
  "git_branch",
  "date",
  "duration_sec",
  "tokens_in",
  "tokens_out",
  "cost_usd",
  "tool_calls",
  "files_touched",
];

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function toCSV(sessions: Session[]) {
  const rows = sessions.map((s) => [
    s.id,
    s.title,
    s.status,
    s.model,
    s.agent,
    s.machine ?? "",
    s.projectName ?? s.gitRepo ?? "",
    s.gitBranch,
    new Date(s.startedAt).toISOString(),
    s.activeSec ?? s.durationSec,
    s.tokensIn,
    s.tokensOut,
    s.costUsd,
    s.toolCalls,
    s.filesTouched,
  ]);
  // the BOM (U+FEFF) makes Excel read UTF-8 instead of guessing the local codepage
  const BOM = String.fromCharCode(0xfeff);
  return BOM + [CSV_HEADER, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

// ---- JSON: full session data, same shape as state.json sessions ----

export function toJSONExport(sessions: Session[]) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), sessions }, null, 2);
}

// ---- Markdown: human-readable summary, changelog-friendly ----

const mdDate = (epoch: number) =>
  new Date(epoch).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

function mdSession(s: Session) {
  const lines = [
    `## Session: ${s.title}`,
    `${mdDate(s.startedAt)} · ${s.model} · ${fmtUsd6(s.costUsd)} est. · ${fmtDuration(
      s.activeSec ?? s.durationSec
    )}`,
    "",
    "### What happened",
  ];
  const prompt = s.events.find((e) => e.kind === "prompt" && e.detail);
  if (prompt) lines.push(`**Prompt:** ${prompt.detail}`, "");
  const tools = s.events.filter((e) => e.kind === "tool");
  if (tools.length) {
    // "Read ×12 · Edit ×5 · Bash ×7" — the shape of the work, not 300 rows
    const byVerb = new Map<string, number>();
    for (const t of tools) {
      const verb = t.label.split(" ")[0];
      byVerb.set(verb, (byVerb.get(verb) ?? 0) + 1);
    }
    lines.push(
      `Tool calls (${s.toolCalls}): ` +
        [...byVerb.entries()].map(([v, n]) => `${v} ×${n}`).join(" · "),
      ""
    );
  }
  const finale = [...s.events]
    .reverse()
    .find((e): e is SessionEvent => (e.kind === "output" || e.kind === "error") && !!e.detail);
  if (finale) lines.push(...finale.detail!.split("\n").map((l) => `> ${l}`), "");
  lines.push(
    `_Status: ${s.status} · branch ${s.gitBranch}` +
      (s.machine ? ` · ${s.machine}` : "") +
      ` · ${s.filesTouched} ${s.filesTouched === 1 ? "file" : "files"} touched · ` +
      `${(s.tokensIn + s.tokensOut).toLocaleString("en-US")} tokens_`
  );
  return lines.join("\n");
}

export function toMarkdown(sessions: Session[]) {
  return sessions.map(mdSession).join("\n\n---\n\n") + "\n";
}

// ---- formats + download ----

export const FORMATS = {
  csv: { label: "CSV", ext: "csv", mime: "text/csv;charset=utf-8", make: toCSV },
  json: { label: "JSON", ext: "json", mime: "application/json", make: toJSONExport },
  md: { label: "Markdown", ext: "md", mime: "text/markdown;charset=utf-8", make: toMarkdown },
} as const;
export type ExportFormat = keyof typeof FORMATS;

export function downloadExport(sessions: Session[], format: ExportFormat, basename: string) {
  const f = FORMATS[format];
  const url = URL.createObjectURL(new Blob([f.make(sessions)], { type: f.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${basename}.${f.ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
