#!/usr/bin/env node
// Money-path guard for the real collector: a fixture transcript with the
// duplicate-usage shape Claude Code actually writes (one JSONL line per
// content block, same message.id + usage repeated) must bill each message
// once, and the title must come from the first task-like prompt line.
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
const usage = { input_tokens: 1000, cache_creation_input_tokens: 2000, cache_read_input_tokens: 4000, output_tokens: 500 };
const lines = [
  { type: "user", timestamp: iso(t0), cwd: "C:\\work\\demo", gitBranch: "main",
    message: { content: "Session name:\nFix the flaky auth test on CI\nThen run the suite." } },
  // one API message split across two lines — usage repeats, bill it ONCE
  { type: "assistant", timestamp: iso(t0 + 5000),
    message: { id: "msg_1", model: "claude-opus-4-8", usage, stop_reason: null,
      content: [{ type: "thinking", thinking: "…" }] } },
  { type: "assistant", timestamp: iso(t0 + 6000),
    message: { id: "msg_1", model: "claude-opus-4-8", usage, stop_reason: "end_turn",
      content: [{ type: "text", text: "Done — test passes." }] } },
];
const FIXTURE = path.join(PROJ, "abcd1234-check.jsonl");
fs.writeFileSync(FIXTURE, lines.map((l) => JSON.stringify(l)).join("\n"));
fs.utimesSync(FIXTURE, new Date(t0), new Date(t0 + 6000)); // old mtime -> finished, not live

const env = { ...process.env, VIBELOG_DIR: path.join(TMP, "state"), VIBELOG_PROJECTS: path.join(TMP, "projects") };
const child = spawn(process.execPath, [path.join(ROOT, "bin", "vibelog.mjs"), "start", "--no-dash"], { env, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
child.kill();

const state = JSON.parse(fs.readFileSync(path.join(TMP, "state", "state.json"), "utf8"));
fs.rmSync(TMP, { recursive: true, force: true });
const s = state.sessions.find((x) => x.id === "abcd1234");
assert.ok(s, "fixture session parsed");
assert.equal(s.tokensIn, 7000, "usage billed once per message.id (in)");
assert.equal(s.tokensOut, 500, "usage billed once per message.id (out)");
// opus 15/75: (1000*15 + 2000*15*1.25 + 4000*15*0.1 + 500*75)/1e6
assert.equal(s.costUsd.toFixed(6), "0.096000", "cost formula + dedupe");
assert.equal(s.title, "Fix the flaky auth test on CI", "title skips header lines");
assert.equal(s.status, "completed", "end_turn -> completed");
console.log("collector.check: OK — dedupe, cost, title, status");
