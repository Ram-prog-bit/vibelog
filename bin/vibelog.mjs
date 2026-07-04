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
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOME = os.homedir();
const DIR = process.env.VIBELOG_DIR || path.join(HOME, ".vibelog");
const STATE = path.join(DIR, "state.json");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------- args ----------

const argv = process.argv.slice(2);
if (argv[0] !== "start") {
  console.log(`vibelog — local dashboard for your coding agents

Usage:
  vibelog start            record real Claude Code sessions
  vibelog start --mock     simulate agents (demo mode)
  vibelog start --port=N   dashboard port (default 3232)
  vibelog start --no-dash  collector only, no dashboard server`);
  process.exit(argv.length ? 1 : 0);
}
const MOCK = argv.includes("--mock");
const NO_DASH = argv.includes("--no-dash");
const PORT = Number((argv.find((a) => a.startsWith("--port=")) ?? "").split("=")[1]) || 3232;

fs.mkdirSync(DIR, { recursive: true });

// Data contract with the dashboard (src/lib/live.tsx): full-state snapshots
// { now, source, sessions } where live sessions carry `phase` and every event
// a stable `seq`. state.json's mtime doubles as the CLI heartbeat.
function writeState(sessions, source) {
  for (const s of sessions) s.events.forEach((e, i) => (e.seq ??= i));
  const json = JSON.stringify({ now: Date.now(), source, sessions }, (k, v) =>
    k.startsWith("_") ? undefined : v
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

// $/Mtok list prices; matched by model-id prefix
const PRICING = [
  ["claude-fable-5", 20, 90],
  ["claude-opus-4-8", 15, 75],
  ["claude-opus", 15, 75],
  ["claude-sonnet", 3, 15],
  ["claude-haiku", 1, 5],
];
const rateFor = (model) => {
  const [, inUsd, outUsd] = PRICING.find(([p]) => (model || "").startsWith(p)) ?? PRICING[3];
  return { inUsd, outUsd };
};

// ---------- mock collector ----------

const AGENTS = [
  { name: "claude-code", model: "claude-fable-5" },
  { name: "claude-code", model: "claude-opus-4-8" },
  { name: "ci-reviewer", model: "claude-sonnet-5" },
  { name: "docs-bot", model: "claude-haiku-4-5" },
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
  const s = {
    id: nextId(),
    title,
    agent: a.name,
    model: a.model,
    status,
    branch: branchFor(title),
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

const PROJECTS = path.join(HOME, ".claude", "projects");
const LIVE_MS = 120_000; // no writes for 2 min → session considered finished
const MAX_AGE = 30 * 864e5;

function parseTranscript(file, mtimeMs) {
  let lines;
  try {
    lines = fs.readFileSync(file, "utf8").split("\n");
  } catch {
    return null;
  }
  let firstTs = 0, lastTs = 0, model = "", branch = "", cwd = "", title = "", summary = "";
  let tokensIn = 0, tokensOut = 0, costUsd = 0, toolCalls = 0;
  const events = [], pending = new Map(), files = new Set();

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
      lastTs = ts;
    }
    if (e.gitBranch) branch = e.gitBranch;
    if (e.cwd) cwd = e.cwd;
    if (e.type === "summary" && e.summary) summary = e.summary;
    const at = firstTs ? Math.max(0, Math.round((ts - firstTs) / 1000)) : 0;

    if (e.type === "user" && !e.isMeta) {
      const c = e.message?.content;
      const parts = typeof c === "string" ? [{ type: "text", text: c }] : Array.isArray(c) ? c : [];
      for (const p of parts) {
        if (p.type === "tool_result" && pending.has(p.tool_use_id)) {
          const t = pending.get(p.tool_use_id);
          if (ts && t.ts) t.event.durMs = Math.max(1, ts - t.ts);
          pending.delete(p.tool_use_id);
        } else if (p.type === "text" && p.text && !/^<|^Caveat:/.test(p.text.trim())) {
          if (!title) title = p.text.trim().split("\n")[0];
          events.push({ at, kind: "prompt", label: "Task", detail: trunc(p.text.trim(), 280) });
        }
      }
    } else if (e.type === "assistant") {
      const m = e.message ?? {};
      if (m.model && m.model !== "<synthetic>") model = m.model;
      const u = m.usage;
      if (u) {
        const inTok = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        tokensIn += inTok;
        tokensOut += u.output_tokens ?? 0;
        const r = rateFor(m.model);
        costUsd +=
          ((u.input_tokens ?? 0) * r.inUsd +
            (u.cache_creation_input_tokens ?? 0) * r.inUsd * 1.25 +
            (u.cache_read_input_tokens ?? 0) * r.inUsd * 0.1 +
            (u.output_tokens ?? 0) * r.outUsd) /
          1e6;
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
  events.forEach((e, i) => (e.seq = i)); // before the slice below, so ids stay stable
  return {
    phase: live ? phaseFor(events) : undefined,
    id: path.basename(file, ".jsonl").slice(0, 8),
    title: trunc(summary || title || (cwd ? path.basename(cwd) : "Claude Code session"), 72),
    agent: "claude-code",
    model,
    status: live ? "live" : "completed",
    branch: branch || "-",
    startedAt: firstTs,
    durationSec: Math.max(1, Math.round((lastTs - firstTs) / 1000)),
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

function startReal() {
  const cache = new Map(); // file -> { mtimeMs, session }
  const tick = () => {
    let changed = false;
    const now = Date.now();
    let files = [];
    try {
      for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true }))
        if (proj.isDirectory())
          for (const f of fs.readdirSync(path.join(PROJECTS, proj.name)))
            if (f.endsWith(".jsonl")) files.push(path.join(PROJECTS, proj.name, f));
    } catch {
      files = []; // no ~/.claude/projects yet — keep waiting
    }
    for (const file of files) {
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
      const session = parseTranscript(file, st.mtimeMs);
      cache.set(file, { mtimeMs: st.mtimeMs, session });
      if (session) changed = true;
    }
    const sessions = [...cache.values()]
      .map((c) => c.session)
      .filter(Boolean)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 200);
    const anyLive = sessions.some((s) => s.status === "live");
    if (anyLive)
      for (const s of sessions)
        if (s.status === "live") s.durationSec = Math.max(1, Math.round((now - s.startedAt) / 1000));
    if (changed || anyLive) writeState(sessions, "claude-code");
    else {
      // heartbeat: keep state.json's mtime fresh so the dashboard can tell
      // the CLI is alive even when no transcript is changing
      try {
        fs.utimesSync(STATE, new Date(), new Date());
      } catch {
        writeState(sessions, "claude-code"); // first run, no state file yet
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
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
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
}

// ---------- go ----------

if (MOCK) startMock();
else startReal();
if (!NO_DASH) startDashboard();
