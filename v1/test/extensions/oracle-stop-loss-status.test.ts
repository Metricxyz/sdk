import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as sdk from "../../src/index.js";

const Q64 = 2n ** 64n;

describe("oracle stop-loss math", () => {
  it("computeOracleStopLossMetrics matches mid-price equal bid/ask case", () => {
    const t0 = 1000n;
    const t1 = 1000n;
    const shares = 1_000_000n;
    const price = Q64;

    const { metricToken0, metricToken1 } = sdk.computeOracleStopLossMetrics({
      token0BalanceScaled: t0,
      token1BalanceScaled: t1,
      totalShares: shares,
      minimalOperationalLiquidity: 1n,
      bidPriceX64: price,
      askPriceX64: price,
    });

    // t0ps = t1ps = 1000 * 1e18 / 1e6 = 1e15
    assert.equal(metricToken0, 2_000_000_000_000_000n);
    assert.equal(metricToken1, 2_000_000_000_000_000n);
  });

  it("isStopLossMetricBreached uses drawdown floor", () => {
    const hwm = 1_000_000n;
    const drawdownE6 = 50_000; // 5%
    const threshold = sdk.stopLossThreshold(hwm, drawdownE6);
    assert.equal(threshold, 950_000n);
    assert.equal(sdk.isStopLossMetricBreached(949_999n, hwm, drawdownE6), true);
    assert.equal(sdk.isStopLossMetricBreached(950_000n, hwm, drawdownE6), false);
    assert.equal(sdk.isStopLossMetricBreached(0n, hwm, 0), false);
  });

  it("secondsUntilStopLossClears returns 0 when clear and null when no decay", () => {
    assert.equal(
      sdk.secondsUntilStopLossClears({
        metric: 950_000n,
        hwm: 1_000_000n,
        drawdownE6: 50_000,
        decayPerSecondE18: 0n,
      }),
      0n,
    );
    assert.equal(
      sdk.secondsUntilStopLossClears({
        metric: 900_000n,
        hwm: 1_000_000n,
        drawdownE6: 50_000,
        decayPerSecondE18: 0n,
      }),
      null,
    );
  });

  it("secondsUntilStopLossClears finds dt that clears via decay", () => {
    const seconds = sdk.secondsUntilStopLossClears({
      metric: 900_000n,
      hwm: 1_000_000n,
      drawdownE6: 50_000,
      decayPerSecondE18: 10_000_000_000_000_000n, // 1% per second
    });
    assert.ok(seconds !== null && seconds > 0n);

    const decayed = sdk.decayedHighWatermark(1_000_000n, 10_000_000_000_000_000n, seconds!);
    assert.equal(sdk.isStopLossMetricBreached(900_000n, decayed, 50_000), false);
    if (seconds! > 0n) {
      const before = sdk.decayedHighWatermark(1_000_000n, 10_000_000_000_000_000n, seconds! - 1n);
      assert.equal(sdk.isStopLossMetricBreached(900_000n, before, 50_000), true);
    }
  });

  it("evaluateOracleStopLoss lists breached bins and resume times", () => {
    const result = sdk.evaluateOracleStopLoss({
      bins: [
        {
          binIdx: 0,
          token0BalanceScaled: 1000n,
          token1BalanceScaled: 1000n,
          totalShares: 1_000_000n,
          highWatermark0: 10_000_000_000_000_000n,
          highWatermark1: 10_000_000_000_000_000n,
        },
        {
          binIdx: 1,
          token0BalanceScaled: 0n,
          token1BalanceScaled: 0n,
          totalShares: 0n,
          highWatermark0: 0n,
          highWatermark1: 0n,
        },
      ],
      bidPriceX64: Q64,
      askPriceX64: Q64,
      drawdownE6: 50_000,
      decayPerSecondE18: 10_000_000_000_000_000n,
      minimalOperationalLiquidity: 1n,
    });

    // metrics = 2e15; thresholds = 9.5e15 → both breached
    assert.equal(result.enabled, true);
    assert.equal(result.bins.length, 1);
    assert.equal(result.isAnyBinStopLossBreached, true);
    assert.equal(result.breachedBins.length, 1);
    assert.equal(result.breachedBins[0]!.binIdx, 0);
    assert.equal(result.breachedBins[0]!.blocksZeroForOne, true);
    assert.equal(result.breachedBins[0]!.blocksOneForZero, true);
    assert.ok(result.secondsUntilZeroForOneResumes !== null);
    assert.ok(result.secondsUntilZeroForOneResumes! > 0n);
  });
});
