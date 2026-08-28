/**
 * Evaluate OracleValueStopLoss breaches from provided bin state + watermarks + prices.
 */

import {
  computeOracleStopLossMetrics,
  isStopLossMetricBreached,
  secondsUntilStopLossClears,
  stopLossThreshold,
} from "./math.js";

export interface OracleStopLossBinInput {
  binIdx: number;
  token0BalanceScaled: bigint;
  token1BalanceScaled: bigint;
  totalShares: bigint;
  /** Current (decayed) high watermarks — e.g. from `currentHighWatermarks`. */
  highWatermark0: bigint;
  highWatermark1: bigint;
}

export interface OracleStopLossBinStatus {
  binIdx: number;
  metricToken0: bigint;
  metricToken1: bigint;
  highWatermark0: bigint;
  highWatermark1: bigint;
  threshold0: bigint;
  threshold1: bigint;
  /** Token0-metric breach — blocks `zeroForOne` swaps that touch this bin. */
  breachedToken0: boolean;
  /** Token1-metric breach — blocks `oneForZero` swaps that touch this bin. */
  breachedToken1: boolean;
  blocksZeroForOne: boolean;
  blocksOneForZero: boolean;
  /**
   * Extra seconds of decay until token0 breach clears.
   * `null` if decay cannot clear it.
   */
  secondsUntilZeroForOneResumes: bigint | null;
  /**
   * Extra seconds of decay until token1 breach clears.
   * `null` if decay cannot clear it.
   */
  secondsUntilOneForZeroResumes: bigint | null;
}

export interface EvaluateOracleStopLossParams {
  bins: readonly OracleStopLossBinInput[];
  bidPriceX64: bigint;
  askPriceX64: bigint;
  drawdownE6: number;
  decayPerSecondE8: number;
  minimalMintableLiquidity: bigint;
  /**
   * When true (default), only bins with `totalShares > 0` are evaluated.
   * Empty bins are skipped (matches on-chain `afterSwap` skip).
   */
  skipEmptyBins?: boolean;
}

export interface OracleStopLossEvaluation {
  /** Drawdown is configured (`drawdownE6 > 0`). */
  enabled: boolean;
  bins: OracleStopLossBinStatus[];
  /** Bins that currently block at least one swap direction. */
  breachedBins: OracleStopLossBinStatus[];
  /** True if any evaluated bin currently blocks at least one swap direction. */
  isAnyBinStopLossBreached: boolean;
  /** Max time until all token0 breaches clear; `null` if any never clears via decay. */
  secondsUntilZeroForOneResumes: bigint | null;
  /** Max time until all token1 breaches clear; `null` if any never clears via decay. */
  secondsUntilOneForZeroResumes: bigint | null;
}

function maxResumeSeconds(values: Array<bigint | null>): bigint | null {
  let max: bigint | null = 0n;
  for (const value of values) {
    if (value === null) return null;
    if (max === null || value > max) max = value;
  }
  return max;
}

/**
 * Compute per-bin stop-loss status from balances, watermarks, and current bid/ask.
 * Does not touch the chain — pass data you already have (or from the read helper).
 */
export function evaluateOracleStopLoss(
  params: EvaluateOracleStopLossParams,
): OracleStopLossEvaluation {
  const {
    bins,
    bidPriceX64,
    askPriceX64,
    drawdownE6,
    decayPerSecondE8,
    minimalMintableLiquidity,
    skipEmptyBins = true,
  } = params;

  const enabled = drawdownE6 > 0;
  const evaluated: OracleStopLossBinStatus[] = [];

  for (const bin of bins) {
    if (skipEmptyBins && bin.totalShares === 0n) continue;

    if (!enabled) {
      evaluated.push({
        binIdx: bin.binIdx,
        metricToken0: 0n,
        metricToken1: 0n,
        highWatermark0: bin.highWatermark0,
        highWatermark1: bin.highWatermark1,
        threshold0: 0n,
        threshold1: 0n,
        breachedToken0: false,
        breachedToken1: false,
        blocksZeroForOne: false,
        blocksOneForZero: false,
        secondsUntilZeroForOneResumes: 0n,
        secondsUntilOneForZeroResumes: 0n,
      });
      continue;
    }

    const { metricToken0, metricToken1 } = computeOracleStopLossMetrics({
      token0BalanceScaled: bin.token0BalanceScaled,
      token1BalanceScaled: bin.token1BalanceScaled,
      totalShares: bin.totalShares,
      minimalMintableLiquidity,
      bidPriceX64,
      askPriceX64,
    });

    const breachedToken0 = isStopLossMetricBreached(metricToken0, bin.highWatermark0, drawdownE6);
    const breachedToken1 = isStopLossMetricBreached(metricToken1, bin.highWatermark1, drawdownE6);

    evaluated.push({
      binIdx: bin.binIdx,
      metricToken0,
      metricToken1,
      highWatermark0: bin.highWatermark0,
      highWatermark1: bin.highWatermark1,
      threshold0: stopLossThreshold(bin.highWatermark0, drawdownE6),
      threshold1: stopLossThreshold(bin.highWatermark1, drawdownE6),
      breachedToken0,
      breachedToken1,
      blocksZeroForOne: breachedToken0,
      blocksOneForZero: breachedToken1,
      secondsUntilZeroForOneResumes: secondsUntilStopLossClears({
        metric: metricToken0,
        hwm: bin.highWatermark0,
        drawdownE6,
        decayPerSecondE8,
      }),
      secondsUntilOneForZeroResumes: secondsUntilStopLossClears({
        metric: metricToken1,
        hwm: bin.highWatermark1,
        drawdownE6,
        decayPerSecondE8,
      }),
    });
  }

  const breachedBins = evaluated.filter((b) => b.breachedToken0 || b.breachedToken1);

  return {
    enabled,
    bins: evaluated,
    breachedBins,
    isAnyBinStopLossBreached: breachedBins.length > 0,
    secondsUntilZeroForOneResumes: maxResumeSeconds(
      breachedBins.filter((b) => b.breachedToken0).map((b) => b.secondsUntilZeroForOneResumes),
    ),
    secondsUntilOneForZeroResumes: maxResumeSeconds(
      breachedBins.filter((b) => b.breachedToken1).map((b) => b.secondsUntilOneForZeroResumes),
    ),
  };
}
