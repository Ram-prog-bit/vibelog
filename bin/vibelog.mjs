#!/usr/bin/env node
// vibelog — local agent-session recorder + dashboard.
//
//   vibelog start          record real Claude Code sessions on this machine
//   vibelog start --mock   simulate a busy machine (demos, development)
//
// Data never leaves this machine: state lives in ~/.vibelog/state.json and the
// dashboard (Next.js, port 3232) streams it over SSE from /api/stream.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOME = os.homedir();
const DIR = process.env.VIBELOG_DIR || path.join(HOME, ".vibelog");
const STATE = path.join(DIR, "state.json");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------- project tracking (.vibelog + git) ----------
//
// A `.vibelog` file in a project directory pins a stable projectId, so every
// session run in that directory groups together regardless of how many chats
// spawned it. Small, human-readable JSON — commit it or gitignore it, your call.
// Git branch/repo come straight from git, so sessions also group by branch.

function readVibelog(dir) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, ".vibelog"), "utf8"));
    if (v && v.projectId)
      return { projectId: v.projectId, projectName: v.projectName || path.basename(dir) };
  } catch {}
  return null;
}

function ensureVibelog(dir) {
  const existing = readVibelog(dir);
  if (existing) return existing;
  const info = {
    projectId: crypto.randomUUID(),
    projectName: path.basename(dir) || "project",
    createdAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(path.join(dir, ".vibelog"), JSON.stringify(info, null, 2) + "\n");
  } catch {}
  return { projectId: info.projectId, projectName: info.projectName };
}

function gitInfoFor(dir) {
  const run = (args) => {
    try {
      const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
      return r.status === 0 ? r.stdout.trim() : "";
    } catch {
      return "";
    }
  };
  const top = run(["rev-parse", "--show-toplevel"]);
  return {
    gitBranch: run(["rev-parse", "--abbrev-ref", "HEAD"]) || "no-branch",
    gitRepo: top ? path.basename(top) : "",
  };
}

// Per-cwd .vibelog lookup for the real collector, cached — one read per unique
// working directory, not per session per tick. No git here: transcripts already
// record the branch each session ran on (see parseTranscript), so the hot path
// spawns no processes.
// ponytail: cache keyed on cwd; a .vibelog created/edited after first read is
// picked up on the next `vibelog start`, not mid-run.
const metaCache = new Map();
function metaFor(cwd) {
  if (!cwd) return {};
  if (!metaCache.has(cwd)) metaCache.set(cwd, readVibelog(cwd) || {});
  return metaCache.get(cwd);
}

// The project the dashboard header shows (the dir vibelog was started in).
let CURRENT_PROJECT = null;

// ---------- args ----------

const argv = process.argv.slice(2);
// `vibelog connect <host-ip>` is sugar for `vibelog start --connect=<host-ip>`
if (argv[0] === "connect" && argv[1]) argv.splice(0, 2, "start", `--connect=${argv[1]}`);
if (argv[0] !== "start") {
  console.log(`vibelog — local dashboard for your coding agents

Usage:
  vibelog start            record real Claude Code sessions
  vibelog start --mock     simulate agents (demo mode)
  vibelog start --port=N   dashboard port (default 3232)
  vibelog start --no-dash  collector only, no dashboard server
  vibelog start --host     team mode: open the dashboard to your LAN so
                           teammates' sessions show up here
  vibelog connect <ip>     team mode: record this machine's sessions and send
                           them to a teammate running --host (no local dashboard)

Team mode is LAN-only and unauthenticated (v1): anyone who can reach the
host's port can read every recorded session and post sessions of their own.
Use it on networks you trust; do not expose the port to the internet.`);
  process.exit(argv.length ? 1 : 0);
}
const MOCK = argv.includes("--mock");
const NO_DASH = argv.includes("--no-dash");
const HOST = argv.includes("--host");
// "<ip>" or "<ip>:<port>" of a machine running `vibelog start --host`
const CONNECT = (argv.find((a) => a.startsWith("--connect=")) ?? "").split("=")[1] || "";
const PORT = Number((argv.find((a) => a.startsWith("--port=")) ?? "").split("=")[1]) || 3232;
const MACHINE = os.hostname();

fs.mkdirSync(DIR, { recursive: true });

// Data contract with the dashboard (src/lib/live.tsx): full-state snapshots
// { now, source, sessions } where live sessions carry `phase` and every event
// a stable `seq`. state.json's mtime doubles as the CLI heartbeat.
// `totalSessions` is how many sessions exist before the MAX_SESSIONS cap, so
// the dashboard can say "showing the last 200 of 333" instead of implying 200
// is the whole story. Defaults to what's being sent when nothing was capped.
function writeState(sessions, source, totalSessions = sessions.length) {
  for (const s of sessions) s.events.forEach((e, i) => (e.seq ??= i));
  const json = JSON.stringify(
    { now: Date.now(), source, sessions, totalSessions, maxSessions: MAX_SESSIONS, project: CURRENT_PROJECT },
    (k, v) => (k.startsWith("_") ? undefined : v)
  );
  fs.writeFileSync(STATE + ".tmp", json);
  try {
    fs.renameSync(STATE + ".tmp", STATE); // atomic: the SSE route never sees half a file
  } catch {
    // ponytail: Windows throws EPERM on rename while a reader holds the file —
    // fall back to a plain write; the SSE route's JSON.parse guard skips torn reads
    try {
      fs.writeFileSync(STATE, json);
      fs.rmSync(STATE + ".tmp", { force: true });
    } catch {}
  }
}

// ---------- shared ----------

const rint = (lo, hi) => Math.floor(lo + Math.random() * (hi - lo));
const phaseFor = (events) => {
  const k = events[events.length - 1]?.kind;
  return k === "tool" ? "tool" : k === "thinking" || k === "prompt" ? "reasoning" : "writing";
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// Pricing: single source of truth in pricing.json (adding a model = one line).
// The dashboard reads the same file via src/lib/pricing.ts, so the recorder and
// the charts can never disagree. Fallback baked in so the CLI runs even if the
// file is missing.
const PRICING = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "pricing.json"), "utf8"));
  } catch {
    return {
      cacheReadMultiplier: 0.1,
      cacheWrite: { "1h": 2, "5m": 1.25 },
      models: { "claude-sonnet": { in: 3, out: 15 } },
      fallback: "claude-sonnet",
    };
  }
})();
const MODELS = Object.entries(PRICING.models);
// $/Mtok for a model. `inputTokens` selects the long-context tier when a model
// has one — none currently do (Claude 4.6+ price the full 1M window flat), but
// the hook is here so adding a tier is a pricing.json edit, not a code change.
const rateFor = (model, inputTokens = 0) => {
  const hit =
    MODELS.find(([p]) => (model || "").startsWith(p)) ??
    MODELS.find(([p]) => p === PRICING.fallback);
  const [, r] = hit;
  // highest matching threshold wins, so tiers can be listed in any order
  const tier = (r.tiers ?? [])
    .filter((t) => inputTokens > t.above)
    .sort((a, b) => b.above - a.above)[0];
  return {
    inUsd: r.in * (tier?.in ?? 1),
    outUsd: r.out * (tier?.out ?? 1),
  };
};

// Exact cost of one API response. Cache writes bill by TTL — 1h at 2x input,
// 5m at 1.25x — so a transcript that only carries the flat
// cache_creation_input_tokens is billed at the 5m rate (the API default).
// Same formula as src/lib/pricing.ts costOfUsage; keep the two in sync.
function costOfUsage(model, u) {
  const inTok =
    (u.input_tokens ?? 0) +
    (u.cache_creation_input_tokens ?? 0) +
    (u.cache_read_input_tokens ?? 0);
  const r = rateFor(model, inTok);
  const cc = u.cache_creation;
  const w1h = cc?.ephemeral_1h_input_tokens ?? 0;
  const w5m = cc ? (cc.ephemeral_5m_input_tokens ?? 0) : (u.cache_creation_input_tokens ?? 0);
  return (
    ((u.input_tokens ?? 0) * r.inUsd +
      w1h * r.inUsd * PRICING.cacheWrite["1h"] +
      w5m * r.inUsd * PRICING.cacheWrite["5m"] +
      (u.cache_read_input_tokens ?? 0) * r.inUsd * PRICING.cacheReadMultiplier +
      (u.output_tokens ?? 0) * r.outUsd) /
    1e6
  );
}

// ---------- mock collector ----------

const AGENTS = [
  { name: "claude-code", model: "claude-fable-5" },
  { name: "claude-code", model: "claude-opus-4-8" },
  { name: "ci-reviewer", model: "claude-sonnet-5" },
  { name: "docs-bot", model: "claude-haiku-4-5" },
];
// Fake but realistic projects so "group by project/branch" demos in mock mode.
const MOCK_PROJECTS = [
  { projectId: "a1c3e5f7-0001-4a00-8000-000000000001", projectName: "acme-web", gitRepo: "acme-web" },
  { projectId: "a1c3e5f7-0002-4a00-8000-000000000002", projectName: "acme-api", gitRepo: "acme-api" },
  { projectId: "a1c3e5f7-0003-4a00-8000-000000000003", projectName: "infra", gitRepo: "infra" },
];
const TITLES = [
  "Migrate billing webhooks to v2 signatures",
  "Fix flaky auth test on CI",
  "Refactor feature flags to a typed client",
  "Add rate limiting to the public API",
  "Upgrade Postgres client and fix pool leaks",
  "Write integration tests for the export pipeline",
  "Speed up cold start on the worker fleet",
  "Fix timezone bug in the invoice scheduler",
  "Trace and fix memory growth in the sync daemon",
  "Add retries with backoff to the S3 uploader",
  "Review PR #482: new caching layer",
  "Fix N+1 queries on the team members page",
  "Instrument checkout with OpenTelemetry",
  "Debug intermittent 502s behind the LB",
  "Add soft delete to workspace resources",
  "Tighten types on the events schema",
  "Harden CSP headers across the dashboard",
  "Backfill missing analytics events from June",
];
const FILES = [
  "src/billing/webhooks.ts",
  "src/auth/session.ts",
  "src/api/rate-limit.ts",
  "src/db/pool.ts",
  "src/export/pipeline.ts",
  "src/sync/daemon.ts",
  "src/storage/uploader.ts",
  "src/teams/members.tsx",
  "src/checkout/trace.ts",
  "src/middleware/csp.ts",
];
const OUTPUTS = [
  "Found the cause — the handler reads the raw body after the JSON middleware has already consumed it. Moving signature verification ahead of parsing.",
  "Tests pass locally. Running the full suite once more before writing the summary.",
  "The pool leak comes from error paths that never release the client. Wrapping acquisition in a finally block.",
  "Reproduced it. The retry wrapper swallows the original error, so the log only shows the last attempt.",
  "Two of the failures are ordering-dependent — the suite passes in isolation. Adding an explicit sort before the assertion.",
  "Renamed the flag accessor and updated all 14 call sites. Typecheck is clean.",
];

const branchFor = (title) =>
  (title.match(/PR #(\d+)/) ? "review/pr-" + title.match(/PR #(\d+)/)[1] : "") ||
  (/^(fix|debug|trace)/i.test(title) ? "fix/" : "feat/") +
    title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 2).slice(0, 3).join("-");

let seq = 1;
const nextId = () => "S-" + String(seq++).padStart(4, "0");

function mockCost(model, tIn, tOut) {
  const r = rateFor(model);
  return (tIn / 1e6) * r.inUsd + (tOut / 1e6) * r.outUsd;
}

function mockEvent(s, at) {
  const r = Math.random();
  if (r < 0.55) {
    const verb = pick(["Read", "Edit", "Grep", "Bash", "Write"]);
    const label =
      verb === "Bash"
        ? "Bash " + pick(["npm test", "npm run lint", "git diff --stat", "npm run typecheck"])
        : verb === "Grep"
          ? 'Grep "' + pick(["verifySignature", "poolSize", "retryCount", "TODO"]) + '"'
          : `${verb} ${pick(s._files)}`;
    return { at, kind: "tool", label, durMs: rint(120, 9000) };
  }
  if (r < 0.75) return { at, kind: "thinking", label: "Reasoning", tokens: rint(200, 2400) };
  if (r < 0.92)
    return { at, kind: "output", label: "Assistant", detail: pick(OUTPUTS), tokens: rint(300, 1800) };
  return { at, kind: "checkpoint", label: pick(["Commit", "Tests green", "Lint clean", "Typecheck clean"]) };
}

function mockSession(status, startedAt) {
  const a = pick(AGENTS);
  const title = pick(TITLES);
  const proj = pick(MOCK_PROJECTS);
  const s = {
    id: nextId(),
    title,
    agent: a.name,
    model: a.model,
    status,
    gitBranch: branchFor(title),
    projectId: proj.projectId,
    projectName: proj.projectName,
    gitRepo: proj.gitRepo,
    startedAt,
    durationSec: 0,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    toolCalls: 0,
    filesTouched: 0,
    tags: [pick(["backend", "frontend", "infra", "docs", "review"]), "auto"],
    events: [],
    _files: [pick(FILES), pick(FILES), pick(FILES)],
    _targetSec: rint(150, 600),
  };
  if (status !== "queued") {
    s.tokensIn = rint(2_000, 12_000);
    s.tokensOut = rint(200, 1_200);
    s.events.push({
      at: 0,
      kind: "prompt",
      label: "Task",
      detail: title + ". Work in small steps and run the tests before you finish.",
      tokens: rint(400, 3000),
    });
  }
  return s;
}

function finishMock(s, failed) {
  s.status = failed ? "failed" : "completed";
  delete s.phase;
  s.events.push(
    failed
      ? { at: s.durationSec, kind: "error", label: "Session failed", detail: "Command exited 1: tests still failing after the retry limit." }
      : { at: s.durationSec, kind: "output", label: "Summary", detail: "Done. All tests pass and the diff is limited to the files listed above.", tokens: rint(200, 900) }
  );
}

function mockHistory() {
  const done = [];
  let t = Date.now() - 1.5 * 3_600_000;
  for (let i = 0; i < 46; i++) {
    const s = mockSession(Math.random() < 0.08 ? "failed" : "completed", t);
    s.durationSec = rint(90, 5400);
    s.tokensIn = rint(8_000, 900_000);
    s.tokensOut = rint(2_000, 90_000);
    const n = rint(6, 18);
    for (let j = 1; j < n; j++)
      s.events.push(mockEvent(s, Math.max(1, Math.floor((s.durationSec * j) / n) + rint(-8, 8))));
    finishMock(s, s.status === "failed");
    s.toolCalls = s.events.filter((e) => e.kind === "tool").length;
    s.filesTouched = rint(1, 4);
    s.costUsd = mockCost(s.model, s.tokensIn, s.tokensOut);
    done.push(s);
    t -= rint(24, 1100) * 60_000; // 0.4–18 h apart → history reaches back ~3 weeks
  }
  return done;
}

function startMock() {
  const history = mockHistory();
  const live = [mockSession("live", Date.now() - rint(60, 300) * 1000), mockSession("live", Date.now() - rint(30, 120) * 1000)];
  let queued = mockSession("queued", Date.now());

  const tick = () => {
    const now = Date.now();
    for (const s of [...live]) {
      s.durationSec = Math.floor((now - s.startedAt) / 1000);
      s.tokensIn += rint(400, 4000);
      s.tokensOut += rint(30, 300);
      s.costUsd = mockCost(s.model, s.tokensIn, s.tokensOut);
      if (Math.random() < 0.5) s.events.push(mockEvent(s, s.durationSec));
      s.phase = phaseFor(s.events);
      s.toolCalls = s.events.filter((e) => e.kind === "tool").length;
      s.filesTouched = Math.min(3, 1 + Math.floor(s.toolCalls / 4));
      if (s.durationSec > s._targetSec) {
        finishMock(s, Math.random() < 0.1);
        history.unshift(s);
        live.splice(live.indexOf(s), 1);
        // the queued session takes the freed slot, a new one joins the queue
        queued.status = "live";
        queued.startedAt = now;
        queued.tokensIn = rint(2_000, 12_000);
        queued.tokensOut = rint(200, 1_200);
        queued.events.push({
          at: 0,
          kind: "prompt",
          label: "Task",
          detail: queued.title + ". Work in small steps and run the tests before you finish.",
          tokens: rint(400, 3000),
        });
        live.push(queued);
        queued = mockSession("queued", now);
      }
    }
    // occasionally a third agent comes on the air
    if (live.length === 2 && Math.random() < 0.02) live.push(mockSession("live", now));
    writeState([...live, queued, ...history], "mock");
  };

  tick();
  setInterval(tick, 1500);
  console.log(`vibelog: mock collector running — ${live.length} agents on the air`);
}

// ---------- real collector (Claude Code transcripts) ----------

const PROJECTS = process.env.VIBELOG_PROJECTS || path.join(HOME, ".claude", "projects");
const LIVE_MS = 120_000; // no writes for 2 min → session considered finished
const MAX_AGE = 30 * 864e5; // transcripts older than 30 days are not read at all
// Newest N sessions are sent to the dashboard. The dashboard is told the true
// total alongside, so the cap is stated rather than hidden.
const MAX_SESSIONS = 200;

// A session's title is the first thing the human asked for. Real prompts are
// not headlines — they open with an imperative ("Do a deep audit of the entire
// VibeLog project at …"), so strip the verb and keep the object. A pasted
// system prompt is not a title at all; those fall back to the directory.
const CMD_WORD = /^(run|fix|add|do|make|build|check|update|implement|create|write|refactor|remove|delete|move|rename|change|convert)\b[\s,:—-]*/i;
const TITLE_MAX = 60;
function titleFrom(text, cwd) {
  const dirTitle = cwd ? path.basename(cwd) + " session" : "Claude Code session";
  const flat = text.replace(/^[#*>`\s-]+/, "").replace(/\s+/g, " ").trim();
  // Long openings that never reach a full stop, and anything starting "You are",
  // are instructions to the model rather than a request from the user.
  if (!flat || /^you are\b/i.test(flat) || flat.split(".")[0].length > 120) return dirTitle;
  let t = flat;
  // stacked imperatives ("Go fix the …") strip too, but never down to a stub
  while (CMD_WORD.test(t)) {
    const rest = t.replace(CMD_WORD, "");
    if (rest.split(" ").length < 3) break;
    t = rest;
  }
  return trunc(t.charAt(0).toUpperCase() + t.slice(1), TITLE_MAX);
}

function parseTranscript(file, mtimeMs, parentId) {
  let lines;
  try {
    lines = fs.readFileSync(file, "utf8").split("\n");
  } catch {
    return null;
  }
  let firstTs = 0, lastTs = 0, model = "", branch = "", cwd = "", title = "", summary = "";
  let activeMs = 0, prevTs = 0; // work time: gaps over 5 min don't count
  let tokensIn = 0, tokensOut = 0, costUsd = 0, toolCalls = 0;
  // Terminal outcome, updated in file order (chronological). A session is a
  // clean completion iff the last thing that happened was the assistant ending
  // its turn; an interrupt or API error after that flips it to failed.
  let outcome = "";
  const events = [], pending = new Map(), files = new Set();
  // One assistant API message spans multiple JSONL lines (one per content
  // block), each repeating the same message.usage — count it once per id or
  // costs inflate ~2.4x on real transcripts.
  const billed = new Set();

  for (const line of lines) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = e.timestamp ? Date.parse(e.timestamp) : 0;
    if (ts) {
      if (!firstTs) firstTs = ts;
      // Transcripts are not strictly ordered (summary lines, resumed sessions,
      // interleaved sidechains), so a step can go backwards — without the lower
      // clamp those negative deltas subtract real work time and activeSec ends
      // up wildly short (measured: 52% of sessions understated, worst ~1e7x).
      if (prevTs) activeMs += Math.max(0, Math.min(ts - prevTs, 300_000));
      prevTs = ts;
      lastTs = ts;
    }
    if (e.gitBranch) branch = e.gitBranch;
    if (e.cwd) cwd = e.cwd;
    if (e.type === "summary" && e.summary) summary = e.summary;
    if (e.isApiErrorMessage) outcome = "error";
    const at = firstTs ? Math.max(0, Math.round((ts - firstTs) / 1000)) : 0;

    if (e.type === "user" && !e.isMeta) {
      const c = e.message?.content;
      const parts = typeof c === "string" ? [{ type: "text", text: c }] : Array.isArray(c) ? c : [];
      for (const p of parts) {
        // The interrupt marker is bookkeeping, not a prompt — record the
        // outcome and skip it, or it lands in the transcript and becomes the
        // session title ("[Request interrupted by user for tool use]").
        if (p.type === "text" && /^\[Request interrupted/i.test(p.text?.trim() ?? "")) {
          outcome = "interrupted";
          continue;
        }
        if (p.type === "tool_result" && pending.has(p.tool_use_id)) {
          const t = pending.get(p.tool_use_id);
          if (ts && t.ts) t.event.durMs = Math.max(1, ts - t.ts);
          pending.delete(p.tool_use_id);
        } else if (p.type === "text" && p.text && !/^<|^Caveat:/.test(p.text.trim())) {
          // first human turn only — titleFrom already decides what to do when
          // that turn is a system prompt, so a later one must not override it
          if (!title) title = titleFrom(p.text.trim(), cwd);
          events.push({ at, kind: "prompt", label: "Task", detail: trunc(p.text.trim(), 280) });
        }
      }
    } else if (e.type === "assistant") {
      const m = e.message ?? {};
      if (m.model && m.model !== "<synthetic>") model = m.model;
      if (m.stop_reason) outcome = m.stop_reason;
      const u = m.usage;
      if (u && !billed.has(m.id)) {
        billed.add(m.id);
        const inTok = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        tokensIn += inTok;
        tokensOut += u.output_tokens ?? 0;
        costUsd += costOfUsage(m.model, u);
      }
      for (const p of Array.isArray(m.content) ? m.content : []) {
        if (p.type === "tool_use") {
          toolCalls++;
          const inp = p.input ?? {};
          const target = inp.file_path ?? inp.notebook_path ?? inp.pattern ?? inp.command ?? inp.url ?? "";
          if (inp.file_path || inp.notebook_path) files.add(inp.file_path ?? inp.notebook_path);
          const ev = { at, kind: "tool", label: (p.name + " " + trunc(String(target), 48)).trim() };
          events.push(ev);
          pending.set(p.id, { event: ev, ts });
        } else if (p.type === "text" && p.text?.trim()) {
          events.push({ at, kind: "output", label: "Assistant", detail: trunc(p.text.trim(), 280), tokens: u?.output_tokens });
        } else if (p.type === "thinking") {
          events.push({ at, kind: "thinking", label: "Reasoning" });
        }
      }
    }
  }

  if (!model || !firstTs) return null; // empty or non-conversation file
  const live = mtimeMs > Date.now() - LIVE_MS;
  // Clean completion = the last turn was the assistant ending normally. Anything
  // else on a finished session (max_tokens, interrupt, API error, or a run that
  // stopped mid-tool) counts as a failure for the failure-rate metric.
  // ponytail: heuristic on stop_reason + interrupt markers; tighten if Claude
  // Code ever writes an explicit exit status to the transcript.
  const clean = outcome === "end_turn" || outcome === "stop_sequence";
  const status = live ? "live" : clean ? "completed" : "failed";
  events.forEach((e, i) => (e.seq = i)); // before the slice below, so ids stay stable
  const meta = metaFor(cwd); // projectId/projectName from <cwd>/.vibelog
  return {
    phase: live ? phaseFor(events) : undefined,
    // Subagent transcripts are named `agent-<hex>.jsonl`; without stripping the
    // shared prefix every one of them would collapse to the id "agent-a".
    id: path.basename(file, ".jsonl").replace(/^agent-/, "").slice(0, 8),
    // set for subagent transcripts — the session whose run spawned them. Rolled
    // up in startReal; underscore-prefixed so writeState strips it.
    _parentId: parentId,
    // A transcript's own `summary` is a human-readable title, so it wins over
    // the first-prompt heuristic. ponytail: current Claude Code builds never
    // write a summary line (0 of 325 transcripts on this machine), so in
    // practice this still falls through to titleFrom() — which already caps
    // its own output and supplies the directory fallback.
    title: summary ? trunc(summary, 72) : title || (cwd ? path.basename(cwd) + " session" : "Claude Code session"),
    agent: "claude-code",
    model,
    machine: MACHINE, // team mode: which machine recorded this
    status,
    // transcript records the branch the session actually ran on; absent or a
    // detached "HEAD" → not on a branch, so "no-branch" (matches the spec).
    gitBranch: branch && branch !== "HEAD" ? branch : "no-branch",
    // ponytail: repo label = cwd basename (the repo root in the common case);
    // avoids a git spawn per session on every tick.
    gitRepo: cwd ? path.basename(cwd) : undefined,
    projectId: meta.projectId,
    projectName: meta.projectName,
    startedAt: firstTs,
    durationSec: Math.max(1, Math.round((lastTs - firstTs) / 1000)),
    // a session resumed across days spans huge wall clock; this is time actually worked
    activeSec: Math.max(1, Math.round(activeMs / 1000)),
    tokensIn,
    tokensOut,
    costUsd,
    toolCalls,
    filesTouched: files.size,
    tags: cwd ? [path.basename(cwd)] : [],
    // keep the opening prompt plus the most recent activity
    events: events.length > 300 ? [events[0], ...events.slice(-299)] : events,
  };
}

// A project directory holds one transcript per session at the top level, plus
// the subagent transcripts that session spawned, nested underneath it:
//
//   <project>/<session-uuid>.jsonl                                  the session
//   <project>/<session-uuid>/subagents/agent-<hex>.jsonl            its subagents
//   <project>/<session-uuid>/subagents/workflows/<wf>/agent-*.jsonl deeper still
//
// So the parent of any nested transcript is the first directory under the
// project, and everything below it belongs to that session's bill. Depth is
// capped rather than unbounded — sibling dirs like tool-results/ hold no
// transcripts, and a runaway symlink shouldn't wedge the tick.
const WALK_MAX_DEPTH = 6;
function collectTranscripts(dir, parentId, depth, out) {
  if (depth > WALK_MAX_DEPTH) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // the session's own directory is named after its transcript, so the
      // parent id for everything inside it is that transcript's id
      collectTranscripts(full, parentId ?? e.name.slice(0, 8), depth + 1, out);
    } else if (e.name.endsWith(".jsonl")) {
      out.push({ file: full, parentId });
    }
  }
}

// ---------- team mode ----------
//
// One machine runs `vibelog start --host`: its dashboard binds to the LAN and
// its /api/ingest route writes each teammate's POSTed sessions to
// ~/.vibelog/remote/<machine>.json. The collector below merges those files
// into state.json, so remote sessions ride the exact same pipeline as local
// ones. Teammates run `vibelog connect <host-ip>`: a normal collector that
// POSTs its sessions to the host each tick instead of serving a dashboard.
// LAN-only, no auth in v1 — see the usage text.

const REMOTE_DIR = path.join(DIR, "remote");

// Sessions posted by teammates, labeled with their machine name. A feed whose
// file has gone quiet past the live window is a disconnected machine — its
// "live" sessions ended, we just never saw the end, so they close out as
// completed (the teammate's next connect corrects the status if it wasn't).
// ponytail: full reparse of every remote file each tick; cache by mtime if a
// big team makes this measurable.
function readRemoteSessions(now) {
  const sessions = [];
  let stamp = 0;
  let files;
  try {
    files = fs.readdirSync(REMOTE_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return { sessions, stamp }; // no remote/ dir — nobody has ever connected
  }
  for (const f of files) {
    const full = path.join(REMOTE_DIR, f);
    try {
      const st = fs.statSync(full);
      stamp = Math.max(stamp, st.mtimeMs);
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      const stale = st.mtimeMs < now - LIVE_MS;
      for (const s of data.sessions ?? []) {
        s.machine = data.machine || f.replace(/\.json$/, "");
        if (stale && s.status === "live") {
          s.status = "completed";
          delete s.phase;
        }
        sessions.push(s);
      }
    } catch {} // torn write or bad file — next tick retries
  }
  return { sessions, stamp };
}

// POST this machine's sessions to the host. Fire-and-forget with a busy flag
// so a slow host never stacks requests; errors log once a minute, not per tick.
let pushBusy = false;
let lastPushErr = 0;
async function pushToHost(sessions, totalSessions) {
  if (pushBusy) return;
  pushBusy = true;
  const target = CONNECT.includes(":") ? CONNECT : `${CONNECT}:3232`;
  try {
    const res = await fetch(`http://${target}/api/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ machine: MACHINE, sessions, totalSessions }, (k, v) =>
        k.startsWith("_") ? undefined : v
      ),
    });
    if (!res.ok) throw new Error(`host answered ${res.status}`);
  } catch (e) {
    if (Date.now() - lastPushErr > 60_000) {
      console.error(`vibelog: cannot reach host ${target} — ${e.message ?? e}`);
      lastPushErr = Date.now();
    }
  } finally {
    pushBusy = false;
  }
}

function startReal() {
  const cache = new Map(); // file -> { mtimeMs, session }
  let lastRemoteStamp = 0;
  const tick = () => {
    let changed = false;
    const now = Date.now();
    let files = [];
    try {
      for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true }))
        if (proj.isDirectory())
          collectTranscripts(path.join(PROJECTS, proj.name), undefined, 0, files);
    } catch {
      files = []; // no ~/.claude/projects yet — keep waiting
    }
    for (const { file, parentId } of files) {
      let st;
      try {
        st = fs.statSync(file);
      } catch {
        continue;
      }
      if (st.mtimeMs < now - MAX_AGE) continue;
      const c = cache.get(file);
      const isLive = st.mtimeMs > now - LIVE_MS;
      if (c && c.mtimeMs === st.mtimeMs && (c.session?.status === "live") === isLive) continue;
      // ponytail: full reparse of any changed file each tick; incremental
      // tail-parsing only matters once transcripts pass tens of MB
      const session = parseTranscript(file, st.mtimeMs, parentId);
      cache.set(file, { mtimeMs: st.mtimeMs, session });
      if (session) changed = true;
    }

    // Roll subagent cost and tokens up into the session that spawned them: that
    // run really did spend it, and a subagent is not a session a human started.
    // Built fresh from the cache every tick onto *copies* — adding to the cached
    // parent instead would re-add the same subagents on every tick.
    const parsed = [...cache.values()].map((c) => c.session).filter(Boolean);
    const tops = new Map();
    for (const s of parsed) if (!s._parentId) tops.set(s.id, { ...s, subagents: 0 });
    const orphans = [];
    for (const s of parsed) {
      if (!s._parentId) continue;
      const p = tops.get(s._parentId);
      // parent transcript aged out of the 30-day window or was deleted — show
      // the subagent on its own rather than silently dropping its cost
      if (!p) {
        orphans.push(s);
        continue;
      }
      p.costUsd += s.costUsd;
      p.tokensIn += s.tokensIn;
      p.tokensOut += s.tokensOut;
      p.toolCalls += s.toolCalls;
      p.subagents++;
    }

    // teammates' sessions (host mode) merge in ahead of the sort, so the cap
    // and the ordering treat every machine's sessions the same way
    const remote = readRemoteSessions(now);
    if (remote.stamp !== lastRemoteStamp) {
      lastRemoteStamp = remote.stamp;
      changed = true;
    }
    const all = [...tops.values(), ...orphans, ...remote.sessions].sort(
      (a, b) => b.startedAt - a.startedAt
    );
    const sessions = all.slice(0, MAX_SESSIONS);
    const anyLive = sessions.some((s) => s.status === "live");
    if (anyLive)
      for (const s of sessions)
        if (s.status === "live" && s.machine === MACHINE)
          s.durationSec = Math.max(1, Math.round((now - s.startedAt) / 1000));
    if (CONNECT && (changed || anyLive))
      pushToHost(sessions.filter((s) => s.machine === MACHINE), all.length);
    if (changed || anyLive) writeState(sessions, "claude-code", all.length);
    else {
      // heartbeat: keep state.json's mtime fresh so the dashboard can tell
      // the CLI is alive even when no transcript is changing
      try {
        fs.utimesSync(STATE, new Date(), new Date());
      } catch {
        writeState(sessions, "claude-code", all.length); // first run, no state file yet
      }
    }
  };
  tick();
  setInterval(tick, 2000);
  console.log(`vibelog: watching ${PROJECTS} for Claude Code sessions`);
}

// ---------- dashboard ----------

function startDashboard() {
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    console.log("vibelog: first run — building the dashboard (one time, takes a minute)…");
    const r = spawnSync(process.execPath, [nextBin, "build"], { cwd: ROOT, stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  // localhost by default (nothing leaves this machine); --host opens it to the
  // LAN for team mode — next would otherwise bind 0.0.0.0 on its own
  const bind = HOST ? "0.0.0.0" : "127.0.0.1";
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT), "-H", bind], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => {
    child.kill();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    child.kill();
    process.exit(0);
  });
  console.log(`vibelog: dashboard on http://localhost:${PORT}/mission`);
  if (HOST) {
    const ip = Object.values(os.networkInterfaces())
      .flat()
      .find((n) => n && n.family === "IPv4" && !n.internal)?.address;
    console.log(
      `vibelog: TEAM MODE — dashboard open to your LAN, no auth. Teammates run:\n` +
        `  vibelog connect ${ip ?? "<this-machine-ip>"}${PORT === 3232 ? "" : ":" + PORT}`
    );
  }
}

// ---------- go ----------

if (MOCK) {
  // demo header: a fake but realistic current project (no file written in mock)
  const p = readVibelog(process.cwd()) || MOCK_PROJECTS[0];
  CURRENT_PROJECT = { projectName: p.projectName, gitBranch: "feat/dashboard-polish", gitRepo: p.gitRepo };
  startMock();
} else {
  // ensure this directory has a .vibelog, then report it to the dashboard header
  const proj = ensureVibelog(process.cwd());
  const git = gitInfoFor(process.cwd());
  CURRENT_PROJECT = { projectName: proj.projectName, gitBranch: git.gitBranch, gitRepo: git.gitRepo };
  startReal();
  if (CONNECT)
    console.log(`vibelog: connected mode — sending this machine's sessions to ${CONNECT}`);
}
// connect mode is a feeder: the dashboard lives on the host machine
if (!NO_DASH && !CONNECT) startDashboard();
