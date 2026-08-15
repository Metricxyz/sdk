/**
 * Pure price-impact computation over a parsed `bid_ask` depth ladder.
 * Mirrors oracle_api's `score_depth_leg`/`score_depth_leg_exact_out`.
 */

import { Q64 } from "../constants.js";
import { ceilDiv } from "../utils/liquidityMath.js";
import { E6, computeReferencePriceX64, toDepthBins } from "./depth.js";
import { isQuoteUnavailable } from "./parse.js";
import type { BidAskQuote, DepthBin, DepthLevel, DepthSide, PriceImpactResult } from "./types.js";

/**
 * Average fill impact must be of the same order as `marginalPriceImpactE6` — the LAST crossed
 * level's own wire impact, which is multiplier-independent and so a free cross-check on whether
 * the caller's `token0ScaleMultiplier`/`token1ScaleMultiplier` are plausible. For a monotone
 * ladder the average of the crossed bins' marginal impacts can't exceed the largest of them (the
 * last one) by more than rounding slack — theory puts the ratio at <= 1; `3` leaves generous
 * headroom for that theory being approximate (the first crossed bin isn't exactly 0 impact).
 *
 * A wrong/swapped multiplier is off by a whole decimal-scale factor (1e6-1e12 for realistic
 * token pairs), which lands priceImpactE6 many orders of magnitude outside this band — measured:
 *
 * | multipliers                  | priceImpactE6 (honest ladder, wire impact ~2000) |
 * |-------------------------------|--------------------------------------------------|
 * | correct `(1n, 10n**12n)`      | `2000n`                                          |
 * | swapped `(10n**12n, 1n)`       | throws in the `ratio === 0n` guard above          |
 * | `(1n, 1n)`                     | throws in the `ratio === 0n` guard above          |
 * | WBTC(8)/DAI(18) `(1n, 1n)`     | `-9994989992766850n` (~-1e10 x E6)               |
 */
const IMPACT_PLAUSIBILITY_RELATIVE_TOLERANCE = 3n;

/**
 * Additive floor for the plausibility check above, covering the case where
 * `marginalPriceImpactE6` is itself 0 or small: a purely relative bound can't distinguish "a tiny
 * average impact" from "a corrupted one" when multiplying a near-zero marginal by any tolerance
 * still yields a near-zero ceiling. `2 * E6` (200 percentage points) is generous enough that it
 * never fires on a legitimate fill — the existing test suite's single-bin fixtures routinely
 * reuse placeholder `price`/`priceImpactE6` values that don't reflect the bin's own marginal rate
 * (they exist to test rounding/skip mechanics, not impact correctness), and the largest average
 * impact any of those legitimately produces against a `0` marginal is exactly `E6` (100%, an
 * ask-side execution price at 2x the placeholder reference). `2 * E6` clears that with margin
 * while remaining ~10 orders of magnitude below the WBTC/DAI corruption case above — a
 * wrong/swapped scale multiplier is never merely "somewhat" off, so there is no realistic
 * corrupted case this floor would let through.
 */
const IMPACT_PLAUSIBILITY_ABSOLUTE_FLOOR_E6 = 2n * E6;

function absBigint(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/**
 * Select a fill side's depth levels from a quote. `zeroForOne` swaps sell token0 into the
 * pool's bids; `!zeroForOne` swaps sell token1 into the pool's asks. Extracted once here — the
 * server duplicates this selection at every call site that picks a leg's side by `zeroForOne`.
 */
function selectDepthLevels(quote: BidAskQuote, zeroForOne: boolean): readonly DepthLevel[] {
  if (!quote.depth) {
    throw new Error(
      "quote.depth is null; request the bid_ask endpoint without depth=false (depth defaults to true)",
    );
  }
  return zeroForOne ? quote.depth.bids : quote.depth.asks;
}

function assertQuoteUsable(quote: BidAskQuote): void {
  if (isQuoteUnavailable(quote)) {
    throw new Error(
      `quote is unavailable: no usable price right now (priceProviderStatus=${quote.priceProviderStatus})`,
    );
  }
}

function assertPositive(value: bigint, field: string): void {
  if (value <= 0n) {
    throw new Error(`${field} must be > 0`);
  }
}

/**
 * Sum the amount picked by `pick` over bins that actually produced output — mirrors the walk's
 * own skip-without-consuming rule for zero-output bins, so "available" means what a fill could
 * actually draw from this ladder.
 */
function sumAvailable(bins: readonly DepthBin[], pick: (bin: DepthBin) => bigint): bigint {
  return bins.reduce((sum, bin) => (bin.output > 0n ? sum + pick(bin) : sum), 0n);
}

/**
 * Build the error for a fill that could not be completed against the ladder. Distinguishes
 * three causes so a caller doesn't misread a `feed_down`/no-liquidity side as "you asked for too
 * much": a genuinely malformed tail the fill needed to cross, a side with no usable depth at
 * all (e.g. an unavailable quote's empty `asks`/`bids`), and ordinary insufficient depth.
 */
function buildDepthExhaustionError(params: {
  side: DepthSide;
  requestedLabel: string;
  available: bigint;
  truncatedAtLevel: DepthLevel | null;
}): Error {
  const { side, requestedLabel, available, truncatedAtLevel } = params;

  if (truncatedAtLevel) {
    return new Error(
      `malformed depth: cumulativeVolume decreased at binIdx=${truncatedAtLevel.binIdx} on the ${side} side; ` +
        `the fill needs more depth than the valid ladder prefix (${available} available) provides`,
    );
  }
  if (available === 0n) {
    return new Error(
      `no depth available on the ${side} side: the ladder is empty; this usually means the quote is ` +
        `unavailable or the feed has no liquidity on this side, not that ${requestedLabel} was too large`,
    );
  }
  return new Error(
    `insufficient depth: requested ${requestedLabel}, side has ${available} available`,
  );
}

/**
 * Orientation, scale-basis conversion, and impact shared by both exact-in and exact-out fills,
 * once the final (amountIn, amountOut, first/last crossed level) are known.
 *
 * Two things happen here, and conflating them is the bug this function exists to avoid:
 *
 * 1. Orientation — `depth[].price` (and the reference price recovered from it) is
 *    token1-per-token0 on BOTH sides, but the fill's in/out tokens flip by side:
 *    `zeroForOne` (bids) has in=token0, out=token1; `!zeroForOne` (asks) has in=token1,
 *    out=token0. Reducing to token0/token1 amounts up front (rather than branching the whole
 *    formula on side) is what keeps the rest of this function orientation-agnostic.
 *
 * 2. Scale basis — `depth[].cumulativeVolume`/`cumulativeInputVolume` (and so `amountIn`/
 *    `amountOut`, built from them) are external RAW token base units, but `depth[].price` (and
 *    so the recovered reference price) is the pool's internal SCALE-NORMALIZED basis:
 *    `price_scaled = price_external * token1ScaleMultiplier / token0ScaleMultiplier` (server:
 *    `externalize()` divides scaled by the multiplier to get external, so `scaled = external *
 *    multiplier`). Comparing an execution price built from raw external amounts against a
 *    scale-normalized reference price — without applying the multipliers — is wrong by a factor
 *    of `token1ScaleMultiplier / token0ScaleMultiplier`, invisible whenever both tokens share the
 *    same decimals (every current test fixture) and silent but material otherwise (e.g. a true
 *    0.2% WETH(18)/USDC(6) impact reads as 100%, or negative, without this conversion).
 *
 * `token0ScaleMultiplier`/`token1ScaleMultiplier` are NOT on the `bid_ask` response — the caller
 * must supply them from the pool's own immutables (`getPoolImmutables`'s
 * `PoolImmutables.token0ScaleMultiplier`/`token1ScaleMultiplier`, `../types.js`). Passing the
 * wrong values (or `1n`/`1n` when the tokens' decimals differ) silently corrupts every impact
 * number this module returns for that pool — there is no way to detect that from the inputs.
 *
 * Sign convention (matches the server's `price_impact_up`/`price_impact_down`; positive = worse
 * for the trader):
 * - ask side: `priceImpactE6 = scaledExecutionPriceX64 * E6 / referencePriceX64 - E6`
 * - bid side: `priceImpactE6 = E6 - scaledExecutionPriceX64 * E6 / referencePriceX64`
 *
 * Two failure modes beyond the ordinary math, both guarded here rather than left to surface as a
 * silently-wrong number:
 * - `ratio === 0n` (the `scaledExecutionPriceX64 * E6 / referencePriceX64` division floors to
 *   zero) means `referencePriceX64` is implausibly large relative to the execution price — e.g. a
 *   corrupted wire `price` — and would otherwise read as a nonsensical exactly-`-E6`/`+E6`
 *   impact. This is deliberately NOT a "throw if negative" check: a legitimately tiny impact can
 *   round to a small negative number near zero, and that is not an error.
 * - the computed `priceImpactE6` is implausible relative to `marginalPriceImpactE6` (the last
 *   crossed level's own wire impact — multiplier-independent). See
 *   `IMPACT_PLAUSIBILITY_RELATIVE_TOLERANCE`/`_ABSOLUTE_FLOOR_E6` above for the tolerance and why
 *   a sign check alone would miss this (a wrong multiplier can land on the right sign with a
 *   wildly wrong magnitude).
 */
function buildPriceImpactResult(params: {
  amountIn: bigint;
  amountOut: bigint;
  firstLevel: DepthLevel;
  lastLevel: DepthLevel;
  zeroForOne: boolean;
  binsCrossed: number;
  token0ScaleMultiplier: bigint;
  token1ScaleMultiplier: bigint;
}): PriceImpactResult {
  const {
    amountIn,
    amountOut,
    firstLevel,
    lastLevel,
    zeroForOne,
    binsCrossed,
    token0ScaleMultiplier,
    token1ScaleMultiplier,
  } = params;

  if (amountOut === 0n) {
    throw new Error(
      `fill produced zero output for amountIn=${amountIn}; amount too small relative to depth`,
    );
  }

  const side: DepthSide = zeroForOne ? "bid" : "ask";
  // referencePriceX64 is recovered from the FIRST crossed level (not the last): every level
  // encodes the same reference price in exact arithmetic, but the first level carries the
  // smallest |impactE6| and so cannot trip computeReferencePriceX64's `denominator <= 0` guard
  // the way a deep bid-side fill's last level can.
  const referencePrice = computeReferencePriceX64(firstLevel, side);

  const amountToken0 = zeroForOne ? amountIn : amountOut;
  const amountToken1 = zeroForOne ? amountOut : amountIn;
  const scaledExecutionPriceX64 =
    (amountToken1 * token1ScaleMultiplier * Q64) / (amountToken0 * token0ScaleMultiplier);

  const ratio = (scaledExecutionPriceX64 * E6) / referencePrice;
  if (ratio === 0n) {
    throw new Error(
      `degenerate price ratio: scaledExecutionPriceX64=${scaledExecutionPriceX64} is negligible ` +
        `relative to referencePriceX64=${referencePrice}; this usually means referencePriceX64 is ` +
        "implausibly large (a corrupted wire price), not a real multi-order-of-magnitude price move",
    );
  }
  const priceImpactE6 = side === "ask" ? ratio - E6 : E6 - ratio;

  const marginalPriceImpactE6 = lastLevel.priceImpactE6;
  const impactCeiling =
    absBigint(marginalPriceImpactE6) * IMPACT_PLAUSIBILITY_RELATIVE_TOLERANCE +
    IMPACT_PLAUSIBILITY_ABSOLUTE_FLOOR_E6;
  if (absBigint(priceImpactE6) > impactCeiling) {
    throw new Error(
      `implausible priceImpactE6=${priceImpactE6} vs. marginalPriceImpactE6=${marginalPriceImpactE6} ` +
        "(wire-reported, multiplier-independent): the average fill impact should be of the same " +
        "order as the last crossed boundary's impact. This usually means token0ScaleMultiplier/" +
        "token1ScaleMultiplier are wrong or swapped — read them from the pool's own " +
        "getImmutables() rather than a hardcoded/guessed value.",
    );
  }

  return {
    amountIn,
    amountOut,
    scaledExecutionPriceX64,
    referencePriceX64: referencePrice,
    priceImpactE6,
    // Last crossed level (not first) — this is exactly what `/route` reports for a leg.
    marginalPriceImpactE6,
    effectivePriceX64: (amountOut * Q64) / amountIn,
    binsCrossed,
  };
}

/**
 * Price impact of filling `amountIn` (exact-in) against the depth ladder.
 *
 * Walks marginal bins in order: a zero-output bin is skipped WITHOUT consuming its input
 * (matches `score_depth_leg`); otherwise `fillInput = min(remaining, bin.input)` and
 * `fillOutput = floor(bin.output * fillInput / bin.input)`.
 *
 * `token0ScaleMultiplier`/`token1ScaleMultiplier` are required — see {@link buildPriceImpactResult}
 * for why they matter and where to get them (they are not on the `bid_ask` response).
 */
export function computePriceImpactExactIn(params: {
  quote: BidAskQuote;
  amountIn: bigint;
  zeroForOne: boolean;
  token0ScaleMultiplier: bigint;
  token1ScaleMultiplier: bigint;
}): PriceImpactResult {
  const { quote, amountIn, zeroForOne, token0ScaleMultiplier, token1ScaleMultiplier } = params;

  assertPositive(amountIn, "amountIn");
  assertPositive(token0ScaleMultiplier, "token0ScaleMultiplier");
  assertPositive(token1ScaleMultiplier, "token1ScaleMultiplier");
  assertQuoteUsable(quote);

  const levels = selectDepthLevels(quote, zeroForOne);
  const { bins, truncatedAtLevel } = toDepthBins(levels);

  let remaining = amountIn;
  let amountOut = 0n;
  let binsCrossed = 0;
  let firstLevel: DepthLevel | null = null;
  let lastLevel: DepthLevel | null = null;

  for (const bin of bins) {
    if (bin.output === 0n) {
      continue;
    }
    const fillInput = remaining < bin.input ? remaining : bin.input;
    const fillOutput = (bin.output * fillInput) / bin.input;
    amountOut += fillOutput;
    remaining -= fillInput;
    binsCrossed += 1;
    firstLevel ??= bin.level;
    lastLevel = bin.level;

    if (remaining === 0n) {
      break;
    }
  }

  if (remaining > 0n || lastLevel === null || firstLevel === null) {
    throw buildDepthExhaustionError({
      side: zeroForOne ? "bid" : "ask",
      requestedLabel: `amountIn=${amountIn}`,
      available: sumAvailable(bins, (bin) => bin.input),
      truncatedAtLevel,
    });
  }

  return buildPriceImpactResult({
    amountIn,
    amountOut,
    firstLevel,
    lastLevel,
    zeroForOne,
    binsCrossed,
    token0ScaleMultiplier,
    token1ScaleMultiplier,
  });
}

/**
 * Price impact of filling `amountOut` (exact-out) against the depth ladder.
 *
 * Inverse of {@link computePriceImpactExactIn}: `fillOutput = min(remaining, bin.output)` and
 * `fillInput = ceilDiv(bin.input * fillOutput, bin.output)` — rounded UP per bin so the
 * realized output never falls short of the request (matches `score_depth_leg_exact_out`).
 *
 * `token0ScaleMultiplier`/`token1ScaleMultiplier` are required — see
 * {@link buildPriceImpactResult} (via `computePriceImpactExactIn`'s doc comment) for why they
 * matter and where to get them.
 */
export function computePriceImpactExactOut(params: {
  quote: BidAskQuote;
  amountOut: bigint;
  zeroForOne: boolean;
  token0ScaleMultiplier: bigint;
  token1ScaleMultiplier: bigint;
}): PriceImpactResult {
  const { quote, amountOut, zeroForOne, token0ScaleMultiplier, token1ScaleMultiplier } = params;

  assertPositive(amountOut, "amountOut");
  assertPositive(token0ScaleMultiplier, "token0ScaleMultiplier");
  assertPositive(token1ScaleMultiplier, "token1ScaleMultiplier");
  assertQuoteUsable(quote);

  const levels = selectDepthLevels(quote, zeroForOne);
  const { bins, truncatedAtLevel } = toDepthBins(levels);

  let remaining = amountOut;
  let amountIn = 0n;
  let binsCrossed = 0;
  let firstLevel: DepthLevel | null = null;
  let lastLevel: DepthLevel | null = null;

  for (const bin of bins) {
    if (bin.output === 0n) {
      continue;
    }
    const fillOutput = remaining < bin.output ? remaining : bin.output;
    const fillInput = ceilDiv(bin.input * fillOutput, bin.output);
    amountIn += fillInput;
    remaining -= fillOutput;
    binsCrossed += 1;
    firstLevel ??= bin.level;
    lastLevel = bin.level;

    if (remaining === 0n) {
      break;
    }
  }

  if (remaining > 0n || lastLevel === null || firstLevel === null) {
    throw buildDepthExhaustionError({
      side: zeroForOne ? "bid" : "ask",
      requestedLabel: `amountOut=${amountOut}`,
      available: sumAvailable(bins, (bin) => bin.output),
      truncatedAtLevel,
    });
  }

  return buildPriceImpactResult({
    amountIn,
    amountOut,
    firstLevel,
    lastLevel,
    zeroForOne,
    binsCrossed,
    token0ScaleMultiplier,
    token1ScaleMultiplier,
  });
}
