// Pricing computation layer. The rates live in one place — ../../pricing.json,
// where adding a model is one line. The CLI collector (bin/vibelog.mjs) reads
// the same JSON, so dashboard and recorder can never disagree on a number.
import PRICING from "../../pricing.json";

interface Tier {
  above: number; // input tokens; the tier applies above this threshold
  in?: number;
  out?: number;
}
interface Rate {
  in: number;
  out: number;
  tiers?: Tier[];
}

const MODELS = Object.entries(PRICING.models) as [string, Rate][];
const CACHE_READ = PRICING.cacheReadMultiplier; // cache-read tokens are cheap
const CACHE_WRITE = PRICING.cacheWrite; // by TTL: 1h costs 2x input, 5m costs 1.25x

/**
 * $/Mtok rate for a model, matched by id prefix (most specific line wins).
 * `inputTokens` selects the long-context tier for models that have one — none
 * currently do (Claude 4.6+ price the full 1M window flat), so this is a no-op
 * until a tier is added to pricing.json.
 */
export function rateFor(model: string, inputTokens = 0) {
  const hit = MODELS.find(([p]) => (model || "").startsWith(p));
  const [, r] = hit ?? MODELS.find(([p]) => p === PRICING.fallback)!;
  // highest matching threshold wins, so tiers can be listed in any order
  const tier = (r.tiers ?? [])
    .filter((t) => inputTokens > t.above)
    .sort((a, b) => b.above - a.above)[0];
  return { inUsd: r.in * (tier?.in ?? 1), outUsd: r.out * (tier?.out ?? 1) };
}

export interface Usage {
  input: number;
  /** cache writes split by the TTL they were written with */
  cacheCreate1h: number;
  cacheCreate5m: number;
  cacheRead: number;
  output: number;
}

/**
 * Exact cost of one API response, list price with the cache-read discount and
 * the per-TTL cache-write premium applied. Full float precision — round only at
 * display. Mirrors costOfUsage in bin/vibelog.mjs; keep the two in sync.
 */
export function costOfUsage(model: string, u: Usage) {
  const inputTokens = u.input + u.cacheCreate1h + u.cacheCreate5m + u.cacheRead;
  const { inUsd, outUsd } = rateFor(model, inputTokens);
  return (
    (u.input * inUsd +
      u.cacheCreate1h * inUsd * CACHE_WRITE["1h"] +
      u.cacheCreate5m * inUsd * CACHE_WRITE["5m"] +
      u.cacheRead * inUsd * CACHE_READ +
      u.output * outUsd) /
    1e6
  );
}

/** Simple in/out cost, no cache split — used for mock/demo sessions. */
export function costOf(model: string, tokensIn: number, tokensOut: number) {
  const { inUsd, outUsd } = rateFor(model, tokensIn);
  return (tokensIn / 1e6) * inUsd + (tokensOut / 1e6) * outUsd;
}
