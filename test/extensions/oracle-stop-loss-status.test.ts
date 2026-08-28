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

// Reference table from metric-core docs/POOL_CONFIGURATION_AND_MANAGEMENT.md §2.5.
function assertCloseTo(actual: bigint, expected: number, relTolerance = 1e-3) {
  const diff =
    actual > BigInt(Math.round(expected))
      ? actual - BigInt(Math.round(expected))
      : BigInt(Math.round(expected)) - actual;
  assert.ok(
    Number(diff) / expected < relTolerance,
    `expected ${actual} to be within ${relTolerance * 100}% of ${expected}`,
  );
}

describe("recommendedInitialScaledAmounts", () => {
  it("matches the stable/stable row (pi0 = 1)", () => {
    const { initialScaledToken0PerShareE18, initialScaledToken1PerShareE18 } =
      sdk.recommendedInitialScaledAmounts(1);
    assertCloseTo(initialScaledToken0PerShareE18, 4.504e18);
    assertCloseTo(initialScaledToken1PerShareE18, 4.504e18);
  });

  it("matches the USDC/WETH row (pi0 = 1/3000)", () => {
    const { initialScaledToken0PerShareE18, initialScaledToken1PerShareE18 } =
      sdk.recommendedInitialScaledAmounts(1 / 3000);
    assertCloseTo(initialScaledToken0PerShareE18, 2.4667e20);
    assertCloseTo(initialScaledToken1PerShareE18, 8.2224e16);
  });

  it("matches the WBTC/USDC row (pi0 = 1e5)", () => {
    const { initialScaledToken0PerShareE18, initialScaledToken1PerShareE18 } =
      sdk.recommendedInitialScaledAmounts(1e5);
    assertCloseTo(initialScaledToken0PerShareE18, 1.4242e16);
    assertCloseTo(initialScaledToken1PerShareE18, 1.4242e21);
  });

  it("keeps sqrt(P̂0 · P̂1) ≈ 4.5036e18 regardless of price", () => {
    for (const price of [1, 1 / 3000, 1e5, 42, 0.0007]) {
      const { initialScaledToken0PerShareE18, initialScaledToken1PerShareE18 } =
        sdk.recommendedInitialScaledAmounts(price);
      const product =
        Number(initialScaledToken0PerShareE18) * Number(initialScaledToken1PerShareE18);
      assertCloseTo(BigInt(Math.round(Math.sqrt(product))), 4.5036e18, 1e-2);
    }
  });

  it("rejects a non-positive price", () => {
    assert.throws(() => sdk.recommendedInitialScaledAmounts(0));
    assert.throws(() => sdk.recommendedInitialScaledAmounts(-1));
  });
});
