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
 * Check average fill impact against the range of wire impacts across all consumed bins,
 * including zero (the reference price). Per-bin fees can fall at a boundary, so an earlier
 * bin can have a larger impact than the final bin. Using only the final boundary would reject
 * valid fills. These bounds are multiplier-independent and still catch wrong token scales.
 * Unvisited and zero-output bins must not widen the range.
 *
 * `IMPACT_PLAUSIBILITY_TOLERANCE_E6` is additive slack on both ends of that band for integer
 * floor-division rounding only, NOT a percentage-of-marginal fudge factor — a coarse single-bin
 * partial fill can land a couple of E6 units either side of the bin's own recorded impact purely
 * from Q64/E6 floor division. `5_000n` (0.5pp) clears that easily while staying far below any
 * real wrong-multiplier case, which is off by a whole decimal-scale factor (1e6-1e12) and lands
 * many orders of magnitude outside this band. Measured live against a CBBTC(8)/USDC(6) pool on
 * Base (multipliers `1e10`/`1e12`; true `priceImpactE6=6`, `marginalPriceImpactE6=55`): swapped
 * multipliers gave `999901` (99.99%), a `(1n,1n)` placeholder gave `990001` (99.00%) — both would
 * silently return instead of throwing without this guard.
 */
const IMPACT_PLAUSIBILITY_TOLERANCE_E6 = 5_000n;

function minBigint(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function maxBigint(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
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
 * Build the error for a fill that could not be completed against the ladder. Distinguishes a
 * side with no usable depth at all (e.g. an unavailable quote's empty `asks`/`bids`) from
 * ordinary insufficient depth, so a caller doesn't misread a `feed_down`/no-liquidity side as
 * "you asked for too much".
 */
function buildDepthExhaustionError(params: {
  side: DepthSide;
  requestedLabel: string;
  available: bigint;
}): Error {
  const { side, requestedLabel, available } = params;

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

/** Floor integer square root (matches OpenZeppelin `Math.sqrt`'s rounding-down default). */
function isqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error("isqrt: value must be >= 0");
  }
  if (value < 2n) {
    return value;
  }
  let x = value;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  return x;
}

/** Q64.64 reciprocal, matching metric-core `SwapMath.invertPriceX64`. */
function invertPriceX64(priceX64: bigint): bigint {
  if (priceX64 <= 0n) {
    throw new Error("invertPriceX64: price must be > 0");
  }
  return (Q64 * Q64) / priceX64;
}

/**
 * A bin's price geometry in "input token per output token" space, Q64.64, over the pool's
 * internal SCALED basis — the frame both partial-fill solves below work in.
 *
 * Within a bin the pool's price moves LINEARLY with bin position and a traverse executes at the
 * arithmetic mean of the price where it starts and the price where it stops (metric-core
 * `SwapMath.calculatePriceAtBinPosition` + `calculateArithmeticMean`). So a fill's cost is a
 * *quadratic* function of how far into the bin it reaches, which is why the contract solves for
 * its stopping position in closed form rather than interpolating linearly.
 *
 * Only one endpoint is on the wire: `level.price` is the bin's far boundary (its upper price on
 * the ask side, its lower price on the bid side). The near endpoint is recovered from the bin's
 * own totals — draining the whole bin costs `output * mean(qStart, qEnd)`, so
 * `mean = input * Q64 / output` and `qStart = 2 * mean - qEnd`. That needs no extra RPC and makes
 * no assumption about neighbouring bins, whose per-bin add-fees can make the effective prices
 * discontinuous across a boundary.
 *
 * Sides differ only in orientation, exactly as metric-core's `computeAnalyticalTargetPosForSellToken0`
 * mirrors `…ForBuyToken0` onto inverted prices: `depth[].price` is token1-per-token0 on BOTH
 * sides, so the ask side (in=token1, out=token0) uses it directly while the bid side
 * (in=token0, out=token1) inverts it.
 *
 * NOTE: on the bid side the contract interpolates the un-inverted price and inverts afterwards,
 * while its analytical locate — like this one — treats the inverted endpoints as linear. The
 * contract then recomputes the realized amounts from the located position, which this cannot do
 * without `curPosInBin` and the bin balances. So these results are size-faithful and match the
 * contract's geometry, but are not wei-exact: use the on-chain quoter (`../quoter/index.js`) when
 * an exact per-amount quote is required.
 */
interface BinPriceGeometry {
  /** Input-per-output price (Q64.64, scaled basis) where the fill starts. */
  qStart: bigint;
  /** Input-per-output price (Q64.64, scaled basis) at the bin's far boundary. */
  qEnd: bigint;
  /** Scale multiplier for the OUTPUT token on this side. */
  outputScaleMultiplier: bigint;
  /** Scale multiplier for the INPUT token on this side. */
  inputScaleMultiplier: bigint;
}

function binPriceGeometry(params: {
  bin: DepthBin;
  zeroForOne: boolean;
  token0ScaleMultiplier: bigint;
  token1ScaleMultiplier: bigint;
}): BinPriceGeometry {
  const { bin, zeroForOne, token0ScaleMultiplier, token1ScaleMultiplier } = params;

  // zeroForOne (bids): in=token0, out=token1, and `price` is token1-per-token0 — so the
  // input-per-output price is its reciprocal. Otherwise (asks): in=token1, out=token0, used as-is.
  const outputScaleMultiplier = zeroForOne ? token1ScaleMultiplier : token0ScaleMultiplier;
  const inputScaleMultiplier = zeroForOne ? token0ScaleMultiplier : token1ScaleMultiplier;
  const qEnd = zeroForOne ? invertPriceX64(bin.level.price) : bin.level.price;

  const outputScaled = bin.output * outputScaleMultiplier;
  const inputScaled = bin.input * inputScaleMultiplier;
  if (outputScaled <= 0n) {
    throw new Error(`bin at binIdx=${bin.level.binIdx} has no output to interpolate over`);
  }

  // mean(qStart, qEnd) over the whole bin, then reflect qEnd through it to get the near endpoint.
  const meanQ = (inputScaled * Q64) / outputScaled;
  const qStart = 2n * meanQ - qEnd;

  return { qStart, qEnd, outputScaleMultiplier, inputScaleMultiplier };
}

/**
 * Output produced by spending `fillInput` on a bin the fill does NOT drain, solved the way
 * metric-core's `computeAnalyticalTargetPosForBuyToken0` does.
 *
 * With `y` the scaled output taken and `O` the bin's total scaled output, the fill reaches
 * `f = y / O` of the way across, executing at `mean(qStart, qStart + f * dq)`, so
 *
 *   `fillInput * Q64 = y * (qStart + (y / O) * dq / 2)`
 *
 * which rearranges to `dq * y^2 + 2 * O * qStart * y - 2 * O * fillInput * Q64 = 0`. Taking the
 * positive root and flooring keeps the quote pessimistic for the trader, matching the pro-rata
 * path this replaces. A flat bin (`dq == 0`) degenerates to plain division.
 */
function partialFillOutput(params: {
  bin: DepthBin;
  fillInput: bigint;
  geometry: BinPriceGeometry;
}): bigint {
  const { bin, fillInput, geometry } = params;
  const { qStart, qEnd, outputScaleMultiplier, inputScaleMultiplier } = geometry;

  const outputScaled = bin.output * outputScaleMultiplier;
  const inputScaled = fillInput * inputScaleMultiplier;
  const dq = qEnd - qStart;

  let outScaled: bigint;
  if (dq === 0n) {
    outScaled = (inputScaled * Q64) / qStart;
  } else {
    const b = outputScaled * qStart;
    const discriminant = b * b + 2n * outputScaled * dq * inputScaled * Q64;
    if (discriminant < 0n) {
      throw new Error(
        `negative discriminant interpolating binIdx=${bin.level.binIdx}: the depth ladder's ` +
          "price and volume fields are mutually inconsistent",
      );
    }
    outScaled = (isqrt(discriminant) - b) / dq;
  }

  // Never award more than the bin holds (integer rounding in the solve can overshoot by a unit),
  // then come back to the caller's raw base units.
  return minBigint(outScaled, outputScaled) / outputScaleMultiplier;
}

/**
 * Input required to take `fillOutput` from a bin the fill does NOT drain — the exact-out
 * counterpart of {@link partialFillOutput}, and a direct evaluation rather than a solve:
 * `fillInput = fillOutput * (qStart + (y / O) * dq / 2)`. Rounded UP, so realized output never
 * falls short of the request.
 */
function partialFillInput(params: {
  bin: DepthBin;
  fillOutput: bigint;
  geometry: BinPriceGeometry;
}): bigint {
  const { bin, fillOutput, geometry } = params;
  const { qStart, qEnd, outputScaleMultiplier, inputScaleMultiplier } = geometry;

  const outputScaled = bin.output * outputScaleMultiplier;
  const takenScaled = fillOutput * outputScaleMultiplier;
  const dq = qEnd - qStart;

  // inputScaled = taken * (2 * O * qStart + taken * dq) / (2 * O * Q64)
  const numerator = takenScaled * (2n * outputScaled * qStart + takenScaled * dq);
  const denominator = 2n * outputScaled * Q64;
  const inputScaled = ceilDiv(numerator, denominator);

  return ceilDiv(inputScaled, inputScaleMultiplier);
}

/**
 * Result of walking a depth ladder to fill `amountRequested` of whichever quantity `capacity`
 * measures on each bin.
 */
interface LadderWalkResult {
  /** The counterpart amount produced: `amountOut` for exact-in, `amountIn` for exact-out. */
  filled: bigint;
  binsCrossed: number;
  firstLevel: DepthLevel | null;
  lastLevel: DepthLevel | null;
  minImpactE6: bigint;
  maxImpactE6: bigint;
  /** Uncovered remainder of `amountRequested`. `> 0n` means the ladder ran out before filling it. */
  remaining: bigint;
}

/**
 * Walk marginal bins in order, filling `amountRequested` against whichever bin field `capacity`
 * selects. Shared by {@link computePriceImpactExactIn} (`capacity = bin.input`, floor-rounded
 * `fill`) and {@link computePriceImpactExactOut} (`capacity = bin.output`, ceil-rounded `fill`)
 * so the server-parity invariants live in exactly one place rather than two copies that must be
 * kept in lockstep by hand: the zero-output bin skip that does NOT consume any capacity (mirrors
 * `score_depth_leg`/`score_depth_leg_exact_out`), first/last crossed level tracking, the
 * bins-crossed count, and the early exit once `remaining` hits exactly `0n`.
 *
 * `capacity`/`fill` are the only direction-specific pieces: `capacity(bin)` says how much of
 * this bin's own field can be consumed, and `fill(bin, consumedCapacity)` maps that consumption
 * to the counterpart amount it produces.
 */
function walkDepthLadder(params: {
  bins: readonly DepthBin[];
  amountRequested: bigint;
  capacity: (bin: DepthBin) => bigint;
  fill: (bin: DepthBin, consumedCapacity: bigint) => bigint;
}): LadderWalkResult {
  const { bins, amountRequested, capacity, fill } = params;

  let remaining = amountRequested;
  let filled = 0n;
  let binsCrossed = 0;
  let firstLevel: DepthLevel | null = null;
  let lastLevel: DepthLevel | null = null;
  let minImpactE6 = 0n;
  let maxImpactE6 = 0n;

  for (const bin of bins) {
    if (bin.output === 0n) {
      continue;
    }
    const consumedCapacity = minBigint(remaining, capacity(bin));
    filled += fill(bin, consumedCapacity);
    remaining -= consumedCapacity;
    binsCrossed += 1;
    firstLevel ??= bin.level;
    lastLevel = bin.level;
    minImpactE6 = minBigint(minImpactE6, bin.level.priceImpactE6);
    maxImpactE6 = maxBigint(maxImpactE6, bin.level.priceImpactE6);

    if (remaining === 0n) {
      break;
    }
  }

  return { filled, binsCrossed, firstLevel, lastLevel, minImpactE6, maxImpactE6, remaining };
}

/**
 * Orientation, scale-basis conversion, and impact shared by both exact-in and exact-out fills,
 * once the final (amountIn, amountOut, first/last crossed level) are known. Conflating either of
 * the next two points is the bug this function exists to avoid:
 *
 * 1. Orientation — `depth[].price` (and the recovered reference price) is token1-per-token0 on
 *    BOTH sides, but the fill's in/out tokens flip by side: `zeroForOne` (bids) has in=token0,
 *    out=token1; `!zeroForOne` (asks) has in=token1, out=token0. Reducing to token0/token1
 *    amounts up front keeps the rest of this function orientation-agnostic.
 *
 * 2. Scale basis — `depth[].cumulativeVolume`/`cumulativeInputVolume` (so `amountIn`/`amountOut`)
 *    are external RAW token base units, but `depth[].price` (so the recovered reference price) is
 *    the pool's internal SCALE-NORMALIZED basis: `price_scaled = price_external *
 *    token1ScaleMultiplier / token0ScaleMultiplier`. Comparing a raw-external execution price
 *    against a scale-normalized reference without applying the multipliers is wrong by a factor
 *    of `token1ScaleMultiplier / token0ScaleMultiplier` — invisible when both tokens share
 *    decimals, silently wrong otherwise (e.g. a true 0.2% WETH(18)/USDC(6) impact reads as 100%,
 *    or negative).
 *
 * `token0ScaleMultiplier`/`token1ScaleMultiplier` are NOT on the `bid_ask` response — get them
 * from the pool's own immutables (`getPoolImmutables`'s `PoolImmutables.token0ScaleMultiplier`/
 * `token1ScaleMultiplier`, `../types.js`). Wrong values (or `1n`/`1n` when decimals differ)
 * silently corrupt every impact number for that pool — undetectable from the inputs alone, which
 * is why the plausibility guard below exists.
 *
 * Sign convention (matches the server's `price_impact_up`/`price_impact_down`; positive = worse
 * for the trader):
 * - ask side: `priceImpactE6 = executionPriceX64 * E6 / referencePriceX64 - E6`
 * - bid side: `priceImpactE6 = E6 - executionPriceX64 * E6 / referencePriceX64`
 *
 * Two failure modes are guarded here rather than left to surface as a silently-wrong number:
 * `ratio === 0n` means `referencePriceX64` is implausibly large relative to the execution price
 * (e.g. a corrupted wire `price`) and would otherwise read as a nonsensical `-E6`/`+E6` impact —
 * deliberately not a bare "throw if negative" check, since a legitimately tiny impact can floor to
 * a small negative number near zero. And `priceImpactE6` falling outside
 * the range of consumed boundary impacts and zero (plus rounding tolerance) trips the guard —
 * see `IMPACT_PLAUSIBILITY_TOLERANCE_E6` above.
 */
function buildPriceImpactResult(params: {
  amountIn: bigint;
  amountOut: bigint;
  firstLevel: DepthLevel;
  lastLevel: DepthLevel;
  minImpactE6: bigint;
  maxImpactE6: bigint;
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
    minImpactE6,
    maxImpactE6,
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
  // encodes the same reference price in exact arithmetic. Using the first avoids recovering it
  // from a deep bid boundary whose ratio may have rounded to zero (impactE6 == E6).
  const referencePrice = computeReferencePriceX64(firstLevel, side);

  const amountToken0 = zeroForOne ? amountIn : amountOut;
  const amountToken1 = zeroForOne ? amountOut : amountIn;
  const executionPriceX64 =
    (amountToken1 * token1ScaleMultiplier * Q64) / (amountToken0 * token0ScaleMultiplier);

  const ratio = (executionPriceX64 * E6) / referencePrice;
  if (ratio === 0n) {
    throw new Error(
      `degenerate price ratio: executionPriceX64=${executionPriceX64} is negligible ` +
        `relative to referencePriceX64=${referencePrice}; this usually means referencePriceX64 is ` +
        "implausibly large (a corrupted wire price), not a real multi-order-of-magnitude price move",
    );
  }
  const priceImpactE6 = side === "ask" ? ratio - E6 : E6 - ratio;

  const marginalPriceImpactE6 = lastLevel.priceImpactE6;
  const impactFloor = minImpactE6 - IMPACT_PLAUSIBILITY_TOLERANCE_E6;
  const impactCeiling = maxImpactE6 + IMPACT_PLAUSIBILITY_TOLERANCE_E6;
  if (priceImpactE6 < impactFloor || priceImpactE6 > impactCeiling) {
    throw new Error(
      `implausible priceImpactE6=${priceImpactE6} vs. consumed impact range [${minImpactE6}, ${maxImpactE6}] ` +
        "(wire-reported, multiplier-independent). This usually means token0ScaleMultiplier/" +
        "token1ScaleMultiplier are wrong or swapped — read them from the pool's own " +
        "getImmutables() rather than a hardcoded/guessed value.",
    );
  }

  return {
    amountIn,
    amountOut,
    executionPriceX64,
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
 * Walks marginal bins via {@link walkDepthLadder} with `capacity = bin.input`: a zero-output bin
 * is skipped WITHOUT consuming its input (matches `score_depth_leg`); otherwise
 * `fillInput = min(remaining, bin.input)` and `fillOutput = floor(bin.output * fillInput /
 * bin.input)`.
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
  const bins = toDepthBins(levels);

  const {
    filled: amountOut,
    binsCrossed,
    firstLevel,
    lastLevel,
    minImpactE6,
    maxImpactE6,
    remaining,
  } = walkDepthLadder({
    bins,
    amountRequested: amountIn,
    capacity: (bin) => bin.input,
    // A fully-crossed bin yields its whole recorded output. A partial fill is interpolated over
    // the bin's price geometry rather than pro-rata on its totals — see `partialFillOutput`.
    fill: (bin, fillInput) =>
      fillInput === bin.input
        ? bin.output
        : partialFillOutput({
            bin,
            fillInput,
            geometry: binPriceGeometry({
              bin,
              zeroForOne,
              token0ScaleMultiplier,
              token1ScaleMultiplier,
            }),
          }),
  });

  if (remaining > 0n || firstLevel === null || lastLevel === null) {
    throw buildDepthExhaustionError({
      side: zeroForOne ? "bid" : "ask",
      requestedLabel: `amountIn=${amountIn}`,
      available: sumAvailable(bins, (bin) => bin.input),
    });
  }

  return buildPriceImpactResult({
    amountIn,
    amountOut,
    firstLevel,
    lastLevel,
    minImpactE6,
    maxImpactE6,
    zeroForOne,
    binsCrossed,
    token0ScaleMultiplier,
    token1ScaleMultiplier,
  });
}

/**
 * Price impact of filling `amountOut` (exact-out) against the depth ladder — the same question
 * as {@link computePriceImpactExactIn} in the other direction: "what does it cost to receive
 * this much?" rather than "what do I receive for this much?".
 *
 * Walks marginal bins via {@link walkDepthLadder} with `capacity = bin.output`: a zero-output bin
 * is skipped WITHOUT consuming any output (matches `score_depth_leg_exact_out`); otherwise
 * `fillOutput = min(remaining, bin.output)` and `fillInput = ceilDiv(bin.input * fillOutput,
 * bin.output)` — rounded UP per bin so the realized output never falls short of the request.
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
  const bins = toDepthBins(levels);

  const {
    filled: amountIn,
    binsCrossed,
    firstLevel,
    lastLevel,
    minImpactE6,
    maxImpactE6,
    remaining,
  } = walkDepthLadder({
    bins,
    amountRequested: amountOut,
    capacity: (bin) => bin.output,
    // Mirror of the exact-in callback: a fully-crossed bin costs its whole recorded input, a
    // partial one is priced over the bin's geometry — see `partialFillInput`.
    fill: (bin, fillOutput) =>
      fillOutput === bin.output
        ? bin.input
        : partialFillInput({
            bin,
            fillOutput,
            geometry: binPriceGeometry({
              bin,
              zeroForOne,
              token0ScaleMultiplier,
              token1ScaleMultiplier,
            }),
          }),
  });

  if (remaining > 0n || firstLevel === null || lastLevel === null) {
    throw buildDepthExhaustionError({
      side: zeroForOne ? "bid" : "ask",
      requestedLabel: `amountOut=${amountOut}`,
      available: sumAvailable(bins, (bin) => bin.output),
    });
  }

  return buildPriceImpactResult({
    amountIn,
    amountOut,
    firstLevel,
    lastLevel,
    minImpactE6,
    maxImpactE6,
    zeroForOne,
    binsCrossed,
    token0ScaleMultiplier,
    token1ScaleMultiplier,
  });
}
