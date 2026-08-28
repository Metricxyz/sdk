/**
 * Pure OracleValueStopLossExtension metric / breach / decay helpers.
 * Mirrors metric-periphery OracleValueStopLossExtension formulas.
 */

import { Q64 } from "../../constants.js";
import { toPriceE18 } from "../../utils/liquidityMath.js";

export const STOP_LOSS_E6 = 1_000_000n;
export const STOP_LOSS_E18 = 1_000_000_000_000_000_000n;
/** Per-share metric fixed-point scale (matches on-chain METRIC_SCALE). */
export const STOP_LOSS_METRIC_SCALE = STOP_LOSS_E18;
/** Clamp for pathological oracle prices (matches on-chain METRIC_MAX = uint104.max). */
export const STOP_LOSS_METRIC_MAX = (1n << 104n) - 1n;

export interface OracleStopLossMetrics {
  /** Value per share in token0 terms (bid mark). */
  metricToken0: bigint;
  /** Value per share in token1 terms (ask mark). */
  metricToken1: bigint;
}

/** Floor-divide `a * b / c` (Solidity Math.mulDiv default rounding). */
export function mulDiv(a: bigint, b: bigint, c: bigint): bigint {
  if (c === 0n) throw new Error("mulDiv: division by zero");
  return (a * b) / c;
}

export function clampStopLossMetric(metric: bigint): bigint {
  return metric > STOP_LOSS_METRIC_MAX ? STOP_LOSS_METRIC_MAX : metric;
}

/** Floor square root of a non-negative bigint (matches OpenZeppelin `Math.sqrt` rounding). */
function isqrt(value: bigint): bigint {
  if (value < 0n) throw new Error("isqrt: value must be >= 0");
  if (value < 2n) return value;
  let x0 = value;
  let x1 = (x0 + 1n) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

export interface RecommendedInitialScaledAmounts {
  /** Recommended `initialScaledAmount0PerE18Shares` (P̂0). */
  initialScaledAmount0PerE18Shares: bigint;
  /** Recommended `initialScaledAmount1PerE18Shares` (P̂1). */
  initialScaledAmount1PerE18Shares: bigint;
}

/**
 * Recommended initial per-share densities (P̂0, P̂1) for pools that use
 * `OracleValueStopLossExtension`, per metric-core's
 * `docs/POOL_CONFIGURATION_AND_MANAGEMENT.md` §2.5 "Choosing `initialScaledAmount{0,1}`":
 *
 * ```
 * K  = 1e6 · (2^104 − 1)   (extension's 1e6 precision floor × uint104 watermark max)
 * P̂0 = √(K / π0)          P̂1 = √(K · π0)
 * ```
 *
 * `currentPrice` is the opening price `π0` (token1 per token0, whole-token terms, e.g.
 * `3000`). Each side's OracleValueStopLoss watermark starts at its `P̂_i` and must stay
 * in `[1e6, 2^104−1]` as price moves; this choice centers both watermarks in that range
 * and keeps `√(P̂0·P̂1) ≈ 4.5036e18` regardless of `π0`, maximizing the price move the
 * pool can absorb before either watermark saturates. Core does not require or validate
 * this ratio — it is this extension's own tradeoff, not a protocol rule, so pools that
 * don't use `OracleValueStopLossExtension` are free to choose `initialScaledAmount{0,1}`
 * some other way (they still must independently satisfy `P̂1 / P̂0 = π0`). The result's
 * field names match `CreatePoolFactoryParams`, so it can be spread directly:
 * `{ ...recommendedInitialScaledAmounts(3000), ... }`.
 */
const UINT128_MAX = (1n << 128n) - 1n;

export function recommendedInitialScaledAmounts(
  currentPrice: number,
): RecommendedInitialScaledAmounts {
  const pi0E18 = toPriceE18(currentPrice);
  const K = STOP_LOSS_E6 * STOP_LOSS_METRIC_MAX;
  const initialScaledAmount0PerE18Shares = isqrt(mulDiv(K, STOP_LOSS_E18, pi0E18));
  const initialScaledAmount1PerE18Shares = isqrt(mulDiv(K, pi0E18, STOP_LOSS_E18));

  // The factory rejects 0 and >= uint128.max (InvalidInitialAmount). Both amounts are always
  // well within range for realistic prices, but an extreme finite `currentPrice` can floor one
  // side to 0 — fail loudly here instead of letting the caller hit an opaque on-chain revert.
  if (
    initialScaledAmount0PerE18Shares <= 0n ||
    initialScaledAmount0PerE18Shares >= UINT128_MAX ||
    initialScaledAmount1PerE18Shares <= 0n ||
    initialScaledAmount1PerE18Shares >= UINT128_MAX
  ) {
    throw new Error(
      `currentPrice ${currentPrice} produces an out-of-range initial scaled amount ` +
        `(initialScaledAmount0PerE18Shares=${initialScaledAmount0PerE18Shares}, ` +
        `initialScaledAmount1PerE18Shares=${initialScaledAmount1PerE18Shares}); use a less extreme price`,
    );
  }

  return { initialScaledAmount0PerE18Shares, initialScaledAmount1PerE18Shares };
}

/**
 * Decayed high watermark at `dt` seconds after last touch.
 * Linear decay; floors at 0 when `rate * dt >= 1e18`.
 */
export function decayedHighWatermark(
  hwm: bigint,
  decayPerSecondE18: bigint | number,
  dtSeconds: bigint | number,
): bigint {
  const rate = BigInt(decayPerSecondE18);
  const dt = BigInt(dtSeconds);
  if (rate === 0n || dt === 0n || hwm === 0n) return hwm;
  const factor = rate * dt;
  if (factor >= STOP_LOSS_E18) return 0n;
  return hwm - (hwm * factor) / STOP_LOSS_E18;
}

/**
 * Drawdown floor for a watermark: `(hwm * (1e6 - drawdownE6)) / 1e6`.
 * Returns 0 when drawdown is 100% (`drawdownE6 === 1e6`).
 */
export function stopLossThreshold(hwm: bigint, drawdownE6: bigint | number): bigint {
  const drawdown = BigInt(drawdownE6);
  const floorMultiplier = STOP_LOSS_E6 - drawdown;
  return (hwm * floorMultiplier) / STOP_LOSS_E6;
}

/**
 * Per-share metrics at oracle bid/ask (bin scaled token balances).
 * Shares are floored at `minimalOperationalLiquidity` (or 1 when that is 0).
 */
export function computeOracleStopLossMetrics(params: {
  token0BalanceScaled: bigint;
  token1BalanceScaled: bigint;
  totalShares: bigint;
  minimalOperationalLiquidity: bigint;
  bidPriceX64: bigint;
  askPriceX64: bigint;
}): OracleStopLossMetrics {
  const { bidPriceX64, askPriceX64 } = params;
  if (bidPriceX64 === 0n) throw new Error("bidPriceX64 must be > 0");
  if (askPriceX64 === 0n) throw new Error("askPriceX64 must be > 0");

  let minShares = params.minimalOperationalLiquidity;
  if (minShares === 0n) minShares = 1n;
  const shares = params.totalShares < minShares ? minShares : params.totalShares;

  const t0ps = mulDiv(params.token0BalanceScaled, STOP_LOSS_METRIC_SCALE, shares);
  const t1ps = mulDiv(params.token1BalanceScaled, STOP_LOSS_METRIC_SCALE, shares);

  return {
    metricToken0: clampStopLossMetric(t0ps + mulDiv(t1ps, Q64, bidPriceX64)),
    metricToken1: clampStopLossMetric(mulDiv(t0ps, askPriceX64, Q64) + t1ps),
  };
}

/** True when `metric` is strictly below the drawdown floor of `hwm`. */
export function isStopLossMetricBreached(
  metric: bigint,
  hwm: bigint,
  drawdownE6: bigint | number,
): boolean {
  const drawdown = BigInt(drawdownE6);
  if (drawdown === 0n) return false;
  return metric < stopLossThreshold(hwm, drawdown);
}

/**
 * Seconds of further watermark decay until `metric` is no longer breached vs `hwm`.
 * - `0n` — already clear (or drawdown disabled)
 * - `null` — cannot clear via decay (`decayPerSecondE18 === 0` while breached)
 *
 * `hwm` should be the *current* (already decayed) watermark, e.g. from
 * `currentHighWatermarks`.
 */
export function secondsUntilStopLossClears(params: {
  metric: bigint;
  hwm: bigint;
  drawdownE6: bigint | number;
  decayPerSecondE18: bigint | number;
}): bigint | null {
  const drawdown = BigInt(params.drawdownE6);
  const rate = BigInt(params.decayPerSecondE18);
  const { metric, hwm } = params;

  if (drawdown === 0n || !isStopLossMetricBreached(metric, hwm, drawdown)) {
    return 0n;
  }
  if (rate === 0n) return null;

  // When rate * dt >= 1e18, watermark decays to 0 and the floor is 0.
  const maxDt = (STOP_LOSS_E18 + rate - 1n) / rate;

  let lo = 0n;
  let hi = maxDt;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const decayed = decayedHighWatermark(hwm, rate, mid);
    if (isStopLossMetricBreached(metric, decayed, drawdown)) {
      lo = mid + 1n;
    } else {
      hi = mid;
    }
  }
  return lo;
}
