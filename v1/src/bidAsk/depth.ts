/**
 * Pure depth-ladder differencing and reference-price recovery for `bid_ask` depth.
 * Mirrors oracle_api's `depth_bins` and its price-impact inversion.
 */

import type { DepthBin, DepthLevel, DepthSide } from "./types.js";

/** E6 scale used by `priceImpactE6` on the wire. Shared with `./impact.js`. */
export const E6 = 1_000_000n;

/** Result of {@link toDepthBins}: the usable marginal bins, plus where the ladder went bad. */
export interface DepthBinsResult {
  /** Marginal bins differenced from the valid prefix of the ladder. */
  bins: DepthBin[];
  /**
   * The first level whose `cumulativeVolume` decreased relative to the previous kept level, if
   * any — the ladder is malformed from this point on, so `bins` stops just before it. `null`
   * means the whole ladder was consumed without hitting such a level.
   */
  truncatedAtLevel: DepthLevel | null;
}

/**
 * Convert a side's cumulative depth levels into marginal per-bin deltas.
 *
 * Mirrors the server's `depth_bins` exactly:
 * - skips a level whose `cumulativeInputVolume` does not strictly increase over the
 *   previous kept level (a repeated/stale boundary);
 * - stops (rather than throwing) at a level whose `cumulativeVolume` (output) decreased across
 *   kept levels — the ladder must be non-decreasing, so a decrease means the payload is malformed
 *   from that point on. The server (`score_depth_leg`) returns as soon as a fill's remaining
 *   amount hits zero and never reads past that point, so a malformed level the fill never reaches
 *   must not fail a request the server would have completed — see `truncatedAtLevel` and the
 *   callers in `./impact.js`, which only surface an error when the fill actually needs to cross it;
 * - KEEPS zero-output bins. Callers that walk the ladder (e.g. `computePriceImpactExactIn`)
 *   decide whether to skip them, and must do so WITHOUT consuming their input.
 */
export function toDepthBins(levels: readonly DepthLevel[]): DepthBinsResult {
  const bins: DepthBin[] = [];
  let previousInput = 0n;
  let previousOutput = 0n;

  for (const level of levels) {
    const { cumulativeInputVolume: cumulativeInput, cumulativeVolume: cumulativeOutput } = level;

    if (cumulativeInput <= previousInput) {
      continue;
    }
    if (cumulativeOutput < previousOutput) {
      return { bins, truncatedAtLevel: level };
    }

    bins.push({
      input: cumulativeInput - previousInput,
      output: cumulativeOutput - previousOutput,
      level,
    });
    previousInput = cumulativeInput;
    previousOutput = cumulativeOutput;
  }

  return { bins, truncatedAtLevel: null };
}

/**
 * Recover the pre-trade, fee-adjusted pool reference price (Q64.64, token1-per-token0) from
 * one depth level, by inverting the server's price-impact formula:
 *
 * `ask: ref = level.price * E6 / (E6 + impactE6)`
 * `bid: ref = level.price * E6 / (E6 - impactE6)`
 *
 * This recovers a ladder-consistent reference price from an ordinary depth level, without the
 * cost of an `?debug=true` request (which bypasses the server's cache). It is NOT the same
 * number as `debug.poolBid`/`poolAsk`: those come from `pool_pricing::compute_pool_bid_ask`,
 * which does not apply the notional fee, while `level.price` is `sell_price_with_fees`/
 * `buy_price_with_fees`, which does — the two differ by the whole notional fee whenever
 * `notionalFeeE8 != 0`.
 *
 * `level.price` is guaranteed `> 0n` by `parseBidAskResponse` (see `./parse.js`). `impactE6` is
 * signed and can be negative. Floor division means the recovered value is off by at most 1 wei
 * from the true reference. Exposed (not inlined into the impact walk) so callers can audit it
 * directly.
 */
export function computeReferencePriceX64(level: DepthLevel, side: DepthSide): bigint {
  const { price, priceImpactE6: impactE6 } = level;
  const denominator = side === "ask" ? E6 + impactE6 : E6 - impactE6;

  if (denominator <= 0n) {
    throw new Error(
      `cannot recover reference price for binIdx=${level.binIdx}: denominator <= 0 (side=${side}, impactE6=${impactE6})`,
    );
  }

  const reference = (price * E6) / denominator;
  if (reference <= 0n) {
    throw new Error(`recovered reference price is <= 0 for binIdx=${level.binIdx} (side=${side})`);
  }
  return reference;
}
