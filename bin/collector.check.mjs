#!/usr/bin/env node
// Money-path guard for the real collector. Four things a bad edit must not
// break: (1) one API message billed once even though Claude Code writes it as
// several JSONL lines, (2) cache writes billed by their TTL, (3) subagent
// transcripts found in the nested dirs and rolled into the session that spawned
// them, (4) a subagent whose parent is gone still counted, on its own.
// Run: node bin/collector.check.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "vibelog-check-"));
const PROJ = path.join(TMP, "projects", "test-proj");
fs.mkdirSync(PROJ, { recursive: true });

const t0 = Date.now() - 10 * 60_000; // 10 min ago -> finished, not live
const iso = (ms) => new Date(ms).toISOString();
const old = (f) => fs.utimesSync(f, new Date(t0), new Date(t0 + 6000));
const write = (f, lines) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, lines.map((l) => JSON.stringify(l)).join("\n"));
  old(f);
};

const usage = { input_tokens: 1000, cache_creation_input_tokens: 2000, cache_read_input_tokens: 4000, output_tokens: 500 };
const lines = [
  { type: "user", timestamp: iso(t0), cwd: "C:\\work\\demo", gitBranch: "main",
    message: { content: "Fix the flaky auth test on CI.\nThen run the suite." } },
  // one API message split across two lines — usage repeats, bill it ONCE
  { type: "assistant", timestamp: iso(t0 + 5000),
    message: { id: "msg_1", model: "claude-opus-4-8", usage, stop_reason: null,
      content: [{ type: "thinking", thinking: "…" }] } },
  { type: "assistant", timestamp: iso(t0 + 6000),
    message: { id: "msg_1", model: "claude-opus-4-8", usage, stop_reason: "end_turn",
      content: [{ type: "text", text: "Done — test passes." }] } },
];
write(path.join(PROJ, "abcd1234-check.jsonl"), lines);

// second fixture: a pasted system prompt is not a title — falls back to <dir> session
write(path.join(PROJ, "beef5678-check.jsonl"), [
  { ...lines[0], cwd: "C:\\work\\demo", message: { content: "You are an expert reviewer. Read the diff and report every defect you find, ranked by severity." } },
  lines[1], lines[2],
]);

// A subagent of abcd1234, nested the way Claude Code writes them, with its cache
// write on a 1-hour TTL (2x input) rather than the 5-minute default (1.25x).
const subUsage = {
  input_tokens: 100,
  cache_creation_input_tokens: 1000,
  cache_creation: { ephemeral_1h_input_tokens: 1000, ephemeral_5m_input_tokens: 0 },
  cache_read_input_tokens: 0,
  output_tokens: 200,
};
const subLines = [
  { type: "user", timestamp: iso(t0 + 1000), cwd: "C:\\work\\demo", message: { content: "Search the repo for retry markers." } },
  { type: "assistant", timestamp: iso(t0 + 2000),
    message: { id: "msg_sub", model: "claude-opus-4-8", usage: subUsage, stop_reason: "end_turn",
      content: [{ type: "text", text: "Found three." }] } },
];
write(path.join(PROJ, "abcd1234-check", "subagents", "agent-11111111aaa.jsonl"), subLines);

// A subagent whose parent transcript does not exist — its cost is real money and
// must survive as its own session rather than vanish.
write(path.join(PROJ, "ffff9999-none", "subagents", "agent-deadbeef000.jsonl"), lines);

const env = { ...process.env, VIBELOG_DIR: path.join(TMP, "state"), VIBELOG_PROJECTS: path.join(TMP, "projects") };
const child = spawn(process.execPath, [path.join(ROOT, "bin", "vibelog.mjs"), "start", "--no-dash"], { env, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
child.kill();

const state = JSON.parse(fs.readFileSync(path.join(TMP, "state", "state.json"), "utf8"));
fs.rmSync(TMP, { recursive: true, force: true });

// --- parent session, with its subagent rolled in -----------------------------
const s = state.sessions.find((x) => x.id === "abcd1234");
assert.ok(s, "fixture session parsed");
// parent 7000 in / 500 out, subagent 1100 in / 200 out
assert.equal(s.tokensIn, 8100, "subagent tokens roll into the parent (in)");
assert.equal(s.tokensOut, 700, "subagent tokens roll into the parent (out)");
assert.equal(s.subagents, 1, "parent reports how many subagents it absorbed");
// parent, opus @ $5/$25, 5m-default write: (1000*5 + 2000*5*1.25 + 4000*5*0.1 + 500*25)/1e6 = 0.032
// subagent, 1h write at 2x:                (100*5  + 1000*5*2                  + 200*25)/1e6 = 0.0155
assert.equal(s.costUsd.toFixed(6), "0.047500", "cost = dedupe + TTL-aware cache writes + rollup");

// --- the subagent is absorbed, not double-counted as its own row -------------
assert.ok(!state.sessions.some((x) => x.id === "11111111"), "rolled-up subagent is not also its own session");

// --- orphaned subagent survives, with a non-colliding id ---------------------
const orphan = state.sessions.find((x) => x.id === "deadbeef");
assert.ok(orphan, "subagent with no parent transcript still counted");
assert.equal(orphan.costUsd.toFixed(6), "0.032000", "orphan keeps its own cost");
assert.ok(
  !state.sessions.some((x) => x.id.startsWith("agent-")),
  "subagent ids strip the shared `agent-` prefix, or they all collide"
);

// --- titles, status, and the honesty counters --------------------------------
assert.equal(s.title, "The flaky auth test on CI. Then run the suite.", "title strips the command verb");
assert.equal(s.status, "completed", "end_turn -> completed");
const sys = state.sessions.find((x) => x.id === "beef5678");
assert.ok(sys, "system-prompt fixture parsed");
assert.equal(sys.title, "demo session", "'You are …' falls back to <dir> session");
assert.equal(state.totalSessions, state.sessions.length, "uncapped run reports the true total");
assert.ok(state.maxSessions > 0, "the cap is reported so the dashboard can name it");

console.log("collector.check: OK — dedupe, cache TTL, subagent rollup, orphans, title, status");
