// Pricing computation layer. The rates live in one place — ../../pricing.json,
// where adding a model is one line. The CLI collector (bin/vibelog.mjs) reads
// the same JSON, so dashboard and recorder can never disagree on a number.
import PRICING from "../../pricing.json";

const MODELS = Object.entries(PRICING.models) as [string, { in: number; out: number }][];
const CACHE_READ = PRICING.cacheReadMultiplier; // cache-read tokens are cheap
const CACHE_WRITE = PRICING.cacheWriteMultiplier; // cache-write tokens cost a premium

/** $/Mtok rate for a model, matched by id prefix (most specific line wins). */
export function rateFor(model: string) {
  const hit = MODELS.find(([p]) => (model || "").startsWith(p));
  const [, r] = hit ?? MODELS.find(([p]) => p === PRICING.fallback)!;
  return { inUsd: r.in, outUsd: r.out };
}

export interface Usage {
  input: number;
  cacheCreate: number;
  cacheRead: number;
  output: number;
}

/**
 * Exact cost of one API response, list price with the cache-read discount and
 * cache-write premium applied. Full float precision — round only at display.
 */
export function costOfUsage(model: string, u: Usage) {
  const { inUsd, outUsd } = rateFor(model);
  return (
    (u.input * inUsd +
      u.cacheCreate * inUsd * CACHE_WRITE +
      u.cacheRead * inUsd * CACHE_READ +
      u.output * outUsd) /
    1e6
  );
}

/** Simple in/out cost, no cache split — used for mock/demo sessions. */
export function costOf(model: string, tokensIn: number, tokensOut: number) {
  const { inUsd, outUsd } = rateFor(model);
  return (tokensIn / 1e6) * inUsd + (tokensOut / 1e6) * outUsd;
}
