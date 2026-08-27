/**
 * Pure OracleValueStopLossExtension metric / breach / decay helpers.
 * Mirrors metric-periphery OracleValueStopLossExtension formulas.
 */

import { Q64 } from "../../constants.js";

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
