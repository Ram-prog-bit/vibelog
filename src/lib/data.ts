// Mock data for VibeLog. Everything is deterministic — a fixed clock and a
// seeded PRNG — so server and client render identically.

export const NOW = new Date("2026-07-03T17:42:00").getTime();

export type SessionStatus = "live" | "completed" | "failed" | "queued";
export type EventKind =
  | "prompt"
  | "thinking"
  | "tool"
  | "output"
  | "error"
  | "checkpoint";

export interface SessionEvent {
  at: number; // seconds from session start
  kind: EventKind;
  label: string;
  detail?: string;
  durMs?: number;
  tokens?: number;
}

export interface Session {
  id: string;
  title: string;
  agent: string;
  model: string;
  status: SessionStatus;
  branch: string;
  startedAt: number; // epoch ms
  durationSec: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  toolCalls: number;
  filesTouched: number;
  tags: string[];
  events: SessionEvent[];
}

// ponytail: mulberry32 — deterministic, good enough for mock data
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260703);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const AGENTS = [
  { name: "claude-code", model: "claude-fable-5", desc: "Terminal agent on this machine" },
  { name: "claude-code", model: "claude-opus-4-8", desc: "Terminal agent on this machine" },
  { name: "ci-reviewer", model: "claude-sonnet-5", desc: "Reviews every PR on push" },
  { name: "docs-bot", model: "claude-haiku-4-5", desc: "Keeps reference docs in sync" },
  { name: "triage", model: "claude-sonnet-5", desc: "Labels and routes new issues" },
];

const TITLES = [
  "Migrate billing webhooks to v2 signatures",
  "Fix flaky auth test on CI",
  "Refactor feature flags to a typed client",
  "Add rate limiting to the public API",
  "Upgrade Postgres client and fix pool leaks",
  "Write integration tests for the export pipeline",
  "Remove dead code behind old onboarding flag",
  "Speed up cold start on the worker fleet",
  "Add pagination to the audit log endpoint",
  "Fix timezone bug in the invoice scheduler",
  "Convert settings forms to server actions",
  "Trace and fix memory growth in the sync daemon",
  "Add retries with backoff to the S3 uploader",
  "Split the monolith deploy into two stages",
  "Review PR #482: new caching layer",
  "Review PR #479: search index rebuild",
  "Label incoming issues from the weekend",
  "Regenerate API reference for v3.2",
  "Backfill missing analytics events from June",
  "Harden CSP headers across the dashboard",
  "Fix N+1 queries on the team members page",
  "Add dark mode tokens to the design system",
  "Instrument checkout with OpenTelemetry",
  "Clean up orphaned rows in the jobs table",
  "Port the CLI config parser to TOML",
  "Debug intermittent 502s behind the LB",
  "Add soft delete to workspace resources",
  "Rewrite the changelog generator",
  "Tighten types on the events schema",
  "Fix broken anchors in the docs sidebar",
];

const FILES = [
  "src/billing/webhooks.ts",
  "src/auth/session.ts",
  "src/flags/client.ts",
  "src/api/rate-limit.ts",
  "src/db/pool.ts",
  "src/export/pipeline.ts",
  "src/workers/start.ts",
  "src/audit/log.ts",
  "src/invoices/scheduler.ts",
  "src/settings/actions.ts",
  "src/sync/daemon.ts",
  "src/storage/uploader.ts",
  "src/search/index.ts",
  "docs/reference/api.md",
  "src/analytics/events.ts",
  "src/middleware/csp.ts",
  "src/teams/members.tsx",
  "src/theme/tokens.css",
  "src/checkout/trace.ts",
  "src/jobs/cleanup.ts",
];

function branchFor(title: string) {
  const m = title.match(/PR #(\d+)/);
  if (m) return "review/pr-" + m[1];
  const prefix = /^(fix|debug|trace)/i.test(title)
    ? "fix/"
    : /docs|reference|changelog/i.test(title)
      ? "docs/"
      : /speed|cold start|n\+1|memory/i.test(title)
        ? "perf/"
        : "feat/";
  const slug = title
    .toLowerCase()
    .replace(/^(fix|debug|add|write|remove|upgrade|convert|trace and fix|speed up)\s+/i, "")
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter((w) => !["the", "to", "a", "an", "on", "in", "of", "for", "with", "from"].includes(w))
    .slice(0, 3)
    .join("-");
  return prefix + slug;
}

// Per-Mtok pricing used to make costs hang together with token counts
const PRICING: Record<string, { inUsd: number; outUsd: number }> = {
  "claude-fable-5": { inUsd: 20, outUsd: 90 },
  "claude-opus-4-8": { inUsd: 15, outUsd: 75 },
  "claude-sonnet-5": { inUsd: 3, outUsd: 15 },
  "claude-haiku-4-5": { inUsd: 1, outUsd: 5 },
};

export function costOf(model: string, tokensIn: number, tokensOut: number) {
  const p = PRICING[model] ?? PRICING["claude-sonnet-5"];
  return (tokensIn / 1e6) * p.inUsd + (tokensOut / 1e6) * p.outUsd;
}

const OUTPUTS = [
  "Found the cause — the handler reads the raw body after the JSON middleware has already consumed it. Moving signature verification ahead of parsing.",
  "Tests pass locally. Running the full suite once more before writing the summary.",
  "The pool leak comes from error paths that never release the client. Wrapping acquisition in a finally block.",
  "Renamed the flag accessor and updated all 14 call sites. Typecheck is clean.",
  "The scheduler stores wall-clock times without zone info. Switching to UTC timestamps and converting at render.",
  "Two of the failures are ordering-dependent — the suite passes in isolation. Adding an explicit sort before the assertion.",
  "The diff is getting wide; splitting the rename into its own commit so the behavior change stays reviewable.",
  "Reproduced it. The retry wrapper swallows the original error, so the log only shows the last attempt.",
];

function genEvents(
  seedTitle: string,
  durationSec: number,
  failed: boolean,
  live = false
): SessionEvent[] {
  const events: SessionEvent[] = [];
  const n = 6 + Math.floor(rand() * 14);
  // each session works a small, stable set of files — focused runs read as real
  const sessFiles = Array.from({ length: 3 }, () => pick(FILES));
  const outputs = [...OUTPUTS];
  const takeOutput = () =>
    outputs.length ? outputs.splice(Math.floor(rand() * outputs.length), 1)[0] : "Continuing.";
  events.push({
    at: 0,
    kind: "prompt",
    label: "Task",
    detail: seedTitle + ". Work in small steps and run the tests before you finish.",
    tokens: Math.floor(between(400, 3000)),
  });
  for (let i = 1; i < n; i++) {
    const at = Math.floor((durationSec * i) / n + between(-8, 8));
    const r = rand();
    if (r < 0.5) {
      const verb = pick(["Read", "Edit", "Grep", "Bash", "Write"]);
      const file = pick(sessFiles);
      const label =
        verb === "Bash"
          ? "Bash " + pick(["npm test", "npm run lint", "git diff --stat", "npm run typecheck"])
          : verb === "Grep"
            ? 'Grep "' + pick(["verifySignature", "FLAG_", "poolSize", "retryCount", "TODO"]) + '"'
            : `${verb} ${file}`;
      events.push({
        at: Math.max(1, at),
        kind: "tool",
        label,
        durMs: Math.floor(between(120, 9000)),
      });
    } else if (r < 0.65) {
      events.push({
        at: Math.max(1, at),
        kind: "thinking",
        label: "Reasoning",
        tokens: Math.floor(between(200, 2400)),
      });
    } else if (r < 0.85) {
      events.push({
        at: Math.max(1, at),
        kind: "output",
        label: "Assistant",
        detail: takeOutput(),
        tokens: Math.floor(between(300, 1800)),
      });
    } else {
      events.push({
        at: Math.max(1, at),
        kind: "checkpoint",
        label: pick(["Commit", "Tests green", "Lint clean", "Typecheck clean"]),
      });
    }
  }
  if (live) {
    return events.sort((a, b) => a.at - b.at);
  }
  if (failed) {
    events.push({
      at: durationSec - 2,
      kind: "error",
      label: "Session failed",
      detail: pick([
        "Command exited 1: 3 tests failing in export/pipeline.test.ts after retry limit reached.",
        "Context limit reached before the task completed. Resume with a narrower scope.",
        "Permission denied: the session tried to write outside the workspace root.",
      ]),
    });
  } else {
    events.push({
      at: durationSec - 2,
      kind: "output",
      label: "Summary",
      detail:
        "Done. " +
        pick([
          "All tests pass and the diff is limited to the files listed above.",
          "Changes are committed on the working branch with a summary in the message body.",
          "The fix is verified end to end; notes on the tradeoffs are in the final message.",
        ]),
      tokens: Math.floor(between(200, 900)),
    });
  }
  return events.sort((a, b) => a.at - b.at);
}

function agentFor(title: string) {
  if (title.startsWith("Review PR")) return AGENTS[2];
  if (title.startsWith("Label")) return AGENTS[4];
  if (/docs|reference|changelog/i.test(title)) return AGENTS[3];
  return rand() < 0.5 ? AGENTS[0] : AGENTS[1];
}

function makeSession(i: number, startedAt: number, status: SessionStatus): Session {
  const title = TITLES[i % TITLES.length];
  const agent = agentFor(title);
  const queued = status === "queued";
  const durationSec = status === "live" ? Math.floor((NOW - startedAt) / 1000) : queued ? 0 : Math.floor(between(90, 5400));
  const tokensIn = queued ? 0 : Math.floor(between(8_000, 900_000));
  const tokensOut = queued ? 0 : Math.floor(between(2_000, 90_000));
  const events = queued ? [] : genEvents(title, durationSec, status === "failed", status === "live");
  return {
    id: "S-" + String(1000 - i).padStart(4, "0"),
    title,
    agent: agent.name,
    model: agent.model,
    status,
    branch: branchFor(title),
    startedAt,
    durationSec,
    tokensIn,
    tokensOut,
    costUsd: queued ? 0 : costOf(agent.model, tokensIn, tokensOut),
    toolCalls: events.filter((e) => e.kind === "tool").length,
    filesTouched: events.length === 0 ? 0 : Math.max(
      1,
      new Set(
        events
          .filter((e) => e.kind === "tool")
          .map((e) => e.label.match(/src\/\S+|docs\/\S+/)?.[0])
          .filter(Boolean)
      ).size
    ),
    tags: [pick(["backend", "frontend", "infra", "docs", "review"]), pick(["auto", "manual"])],
    events,
  };
}

function build(): Session[] {
  const sessions: Session[] = [];
  // two live, one queued, then history reaching back ~30 days
  sessions.push(makeSession(0, NOW - 14 * MIN, "live"));
  sessions.push(makeSession(1, NOW - 42 * MIN, "live"));
  sessions.push(makeSession(2, NOW - 2 * MIN, "queued"));
  let t = NOW - 1.2 * HOUR;
  for (let i = 3; i < 64; i++) {
    const status: SessionStatus = rand() < 0.07 ? "failed" : "completed";
    sessions.push(makeSession(i, t, status));
    t -= between(0.4, 18) * HOUR;
  }
  return sessions;
}

export const SESSIONS: Session[] = build();

export const LIVE = SESSIONS.filter((s) => s.status === "live");

export function sessionById(id: string) {
  return SESSIONS.find((s) => s.id === id);
}

// ---- aggregates for dashboard + analytics ----

export interface DayStat {
  date: string; // "Jun 21"
  epoch: number;
  costUsd: number;
  sessions: number;
  tokens: number;
  failures: number;
}

export const DAILY: DayStat[] = (() => {
  const days: DayStat[] = [];
  for (let d = 29; d >= 0; d--) {
    const dayStart = NOW - d * DAY;
    const inDay = SESSIONS.filter(
      (s) => s.startedAt >= dayStart - DAY / 2 && s.startedAt < dayStart + DAY / 2
    );
    const date = new Date(dayStart).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    // pad sparse generated days with a deterministic baseline so charts read well
    const base = 0.6 + ((d * 7919) % 23) / 6;
    days.push({
      date,
      epoch: dayStart,
      costUsd: base + inDay.reduce((a, s) => a + s.costUsd, 0),
      sessions: 2 + ((d * 31) % 7) + inDay.length,
      tokens: Math.floor(base * 400_000) + inDay.reduce((a, s) => a + s.tokensIn + s.tokensOut, 0),
      failures: (d * 13) % 9 === 0 ? 1 : 0,
    });
  }
  return days;
})();

export const MODEL_SPLIT = Object.keys(PRICING)
  .map((model) => {
    const of = SESSIONS.filter((s) => s.model === model);
    return {
      model,
      sessions: of.length,
      costUsd: of.reduce((a, s) => a + s.costUsd, 0),
      tokens: of.reduce((a, s) => a + s.tokensIn + s.tokensOut, 0),
    };
  })
  .filter((m) => m.sessions > 0)
  .sort((a, b) => b.costUsd - a.costUsd);

export const TOOL_LATENCY = [
  { tool: "Read", p50: 0.18, p95: 0.9, calls: 1841 },
  { tool: "Grep", p50: 0.22, p95: 1.1, calls: 1210 },
  { tool: "Edit", p50: 0.35, p95: 1.6, calls: 986 },
  { tool: "Bash", p50: 2.1, p95: 14.8, calls: 774 },
  { tool: "Write", p50: 0.4, p95: 1.9, calls: 312 },
  { tool: "WebFetch", p50: 1.8, p95: 7.2, calls: 141 },
];
