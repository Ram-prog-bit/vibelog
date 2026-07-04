#!/usr/bin/env node
// Money-path guard: pins pricing.json rates + the cost formula so a bad edit
// can't silently ship wrong bills. Run: node bin/pricing.check.mjs
// ponytail: pins the config and one worked example; it does not re-import the
// collector's copy of the formula — keep the two arithmetic lines in sync.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = JSON.parse(fs.readFileSync(path.join(ROOT, "pricing.json"), "utf8"));

const rate = (m) => {
  const hit =
    Object.entries(P.models).find(([p]) => m.startsWith(p)) ??
    Object.entries(P.models).find(([p]) => p === P.fallback);
  return hit[1];
};
const cost = (m, u) => {
  const r = rate(m);
  return (
    (u.in * r.in +
      u.cacheWrite * r.in * P.cacheWriteMultiplier +
      u.cacheRead * r.in * P.cacheReadMultiplier +
      u.out * r.out) /
    1e6
  );
};

// Rates are sane and the discount/premium point the right way.
assert.equal(P.cacheReadMultiplier, 0.1, "cache reads should be 0.1x input");
assert.equal(P.cacheWriteMultiplier, 1.25, "cache writes should be 1.25x input");
for (const [m, r] of Object.entries(P.models)) {
  assert.ok(r.in > 0 && r.out > 0, `${m}: rates must be positive`);
  assert.ok(r.out >= r.in, `${m}: output should not be cheaper than input`);
}

// Prefix match resolves dated variants (claude-sonnet-4-6 -> claude-sonnet).
assert.equal(rate("claude-sonnet-4-6").in, 3, "dated variant should match by prefix");
assert.equal(rate("who-knows").in, rate(P.fallback).in, "unknown model -> fallback");

// One worked example, to 6 dp. opus @ $15 in / $75 out:
//   1M new in ($15) + 2M cache-read (2*15*0.1=$3) + 0.5M out (0.5*75=$37.5) = $55.50
assert.equal(
  cost("claude-opus-4-8", { in: 1e6, cacheWrite: 0, cacheRead: 2e6, out: 5e5 }).toFixed(6),
  "55.500000",
  "opus worked example"
);

console.log("pricing.check: OK —", Object.keys(P.models).length, "models priced");
