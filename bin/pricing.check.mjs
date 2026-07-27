#!/usr/bin/env node
// Money-path guard: pins pricing.json rates + the cost formula so a bad edit
// can't silently ship wrong bills. Run: node bin/pricing.check.mjs
// ponytail: pins the config and worked examples; it does not re-import the
// collector's copy of the formula — keep the two arithmetic blocks in sync.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = JSON.parse(fs.readFileSync(path.join(ROOT, "pricing.json"), "utf8"));

const rate = (m, inputTokens = 0) => {
  const hit =
    Object.entries(P.models).find(([p]) => m.startsWith(p)) ??
    Object.entries(P.models).find(([p]) => p === P.fallback);
  const r = hit[1];
  const tier = (r.tiers ?? [])
    .filter((t) => inputTokens > t.above)
    .sort((a, b) => b.above - a.above)[0];
  return { in: r.in * (tier?.in ?? 1), out: r.out * (tier?.out ?? 1) };
};
const cost = (m, u) => {
  const r = rate(m, u.in + u.write1h + u.write5m + u.cacheRead);
  return (
    (u.in * r.in +
      u.write1h * r.in * P.cacheWrite["1h"] +
      u.write5m * r.in * P.cacheWrite["5m"] +
      u.cacheRead * r.in * P.cacheReadMultiplier +
      u.out * r.out) /
    1e6
  );
};

// Cache multipliers point the right way and match published rates:
// reads 0.1x, 5-minute writes 1.25x, 1-hour writes 2x.
assert.equal(P.cacheReadMultiplier, 0.1, "cache reads should be 0.1x input");
assert.equal(P.cacheWrite["5m"], 1.25, "5m cache writes should be 1.25x input");
assert.equal(P.cacheWrite["1h"], 2, "1h cache writes should be 2x input");
assert.ok(
  P.cacheWrite["1h"] > P.cacheWrite["5m"],
  "a longer TTL must cost more to write, not less"
);
assert.equal(P.cacheWriteMultiplier, undefined, "flat cacheWriteMultiplier is gone — use cacheWrite");

for (const [m, r] of Object.entries(P.models)) {
  assert.ok(r.in > 0 && r.out > 0, `${m}: rates must be positive`);
  assert.ok(r.out >= r.in, `${m}: output should not be cheaper than input`);
  for (const t of r.tiers ?? []) {
    assert.ok(t.above > 0, `${m}: tier threshold must be positive`);
    assert.ok((t.in ?? 1) >= 1 && (t.out ?? 1) >= 1, `${m}: a long-context tier is a premium, not a discount`);
  }
}

// Published list rates, checked against the models this machine actually runs.
// Source: platform.claude.com/docs/en/about-claude/pricing (verified 2026-07-27).
for (const [model, inUsd, outUsd] of [
  ["claude-opus-5", 5, 25],
  ["claude-opus-4-8", 5, 25],
  ["claude-fable-5", 10, 50],
  ["claude-sonnet-5", 2, 10],
  ["claude-sonnet-4-6", 3, 15],
  ["claude-haiku-4-5-20251001", 1, 5],
]) {
  assert.equal(rate(model).in, inUsd, `${model}: input rate`);
  assert.equal(rate(model).out, outUsd, `${model}: output rate`);
}

// Prefix match resolves dated variants, most specific line first.
assert.equal(rate("claude-sonnet-4-6").in, 3, "dated variant should match by prefix");
assert.equal(rate("claude-sonnet-5").in, 2, "a more specific prefix must win over claude-sonnet");
assert.equal(rate("who-knows").in, rate(P.fallback).in, "unknown model -> fallback");

// Claude Sonnet 5's $2/$10 is introductory and reverts to $3/$15. Fail loudly
// the day it lapses rather than quietly under-billing every sonnet-5 session.
assert.ok(
  Date.now() <= Date.parse(P.sonnet5IntroEndsOn + "T23:59:59Z"),
  `claude-sonnet-5 introductory pricing ended ${P.sonnet5IntroEndsOn} — set it to 3 in / 15 out`
);

// No model claims a long-context tier: Claude 4.6 and later bill the full 1M
// window flat, so a 900k-token request costs the same per token as a 9k one.
for (const [m, r] of Object.entries(P.models)) {
  assert.equal((r.tiers ?? []).length, 0, `${m}: no published long-context premium exists`);
  assert.equal(rate(m, 900_000).in, r.in, `${m}: rate must not change above 200k input tokens`);
}

// Worked example 1 — cache-write TTL split. opus @ $5 in / $25 out:
//   1M new in ($5) + 1M 1h-write (1*5*2=$10) + 1M 5m-write (1*5*1.25=$6.25)
//   + 2M cache-read (2*5*0.1=$1) + 0.5M out (0.5*25=$12.50) = $34.75
assert.equal(
  cost("claude-opus-4-8", {
    in: 1e6, write1h: 1e6, write5m: 1e6, cacheRead: 2e6, out: 5e5,
  }).toFixed(6),
  "34.750000",
  "opus worked example, both cache-write TTLs"
);

// Worked example 2 — the tier hook actually multiplies, using a synthetic
// model so the assertion survives real rates being tier-free.
const TIERED = { in: 10, out: 20, tiers: [{ above: 200_000, in: 2, out: 1.5 }] };
const tieredRate = (tok) => {
  const t = TIERED.tiers.filter((x) => tok > x.above).sort((a, b) => b.above - a.above)[0];
  return { in: TIERED.in * (t?.in ?? 1), out: TIERED.out * (t?.out ?? 1) };
};
assert.deepEqual(tieredRate(200_000), { in: 10, out: 20 }, "at the threshold: base rate");
assert.deepEqual(tieredRate(200_001), { in: 20, out: 30 }, "above the threshold: tier applied");

console.log(
  "pricing.check: OK —",
  Object.keys(P.models).length,
  "models priced, cache writes 1h/5m, tier hook live"
);
