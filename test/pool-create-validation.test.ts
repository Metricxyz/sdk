/**
 * Client-side validation added to pool creation: computeMinimumOperationalLiquidity and the
 * bidAskRefAsymmetryX8 bounds check, both enforced in prepareFactoryCreatePoolParams before any RPC.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as sdk from "../src/index.js";

const base = {
  token0: "0x1111111111111111111111111111111111111111" as const,
  token1: "0x2222222222222222222222222222222222222222" as const,
  priceProvider: "0x3333333333333333333333333333333333333333" as const,
  admin: "0x4444444444444444444444444444444444444444" as const,
  adminFeeDestination: "0x4444444444444444444444444444444444444444" as const,
  adminSpreadFeeE6: 5000,
  adminNotionalFeeE8: 0,
  protocolSpreadFeeE6: 0,
  protocolNotionalFeeE8: 0,
  curBinDistFromProvidedPricePercent: 0,
  nonNegativeBins: sdk.createUniformBins(10, 10_000),
  negativeBins: sdk.createUniformBins(10, 10_000),
};

describe("computeMinimumOperationalLiquidity", () => {
  it("matches PRECISION(1e6) * 1e18 / min(amount0, amount1)", () => {
    assert.equal(sdk.computeMinimumOperationalLiquidity(10n ** 18n, 10n ** 18n), 1_000_000n);
    assert.equal(sdk.computeMinimumOperationalLiquidity(2n * 10n ** 18n, 10n ** 18n), 1_000_000n);
  });

  it("floors at 1 rather than 0", () => {
    const huge = (1n << 128n) - 2n;
    assert.equal(sdk.computeMinimumOperationalLiquidity(huge, huge), 1n);
  });

  it("rejects non-positive or out-of-range amounts", () => {
    assert.throws(() => sdk.computeMinimumOperationalLiquidity(0n, 10n ** 18n));
    assert.throws(() => sdk.computeMinimumOperationalLiquidity(10n ** 18n, -1n));
    assert.throws(() => sdk.computeMinimumOperationalLiquidity((1n << 128n) - 1n, 10n ** 18n));
  });
});

describe("recommendedMinimalOperationalLiquidity", () => {
  const wethUsdc = {
    initialScaledAmount0PerE18Shares: 10n ** 18n,
    initialScaledAmount1PerE18Shares: 3000n * 10n ** 18n,
    token0PriceUsd: 3000,
    token1PriceUsd: 1,
    token0Decimals: 18,
    token1Decimals: 6,
  };

  it("returns the share count worth $10 when it exceeds the factory minimum", () => {
    assert.equal(sdk.recommendedMinimalOperationalLiquidity(wethUsdc), 3_333_333_333_333_334n);
  });

  it("uses the side needing more shares when USD prices disagree with the initial ratio", () => {
    assert.equal(
      sdk.recommendedMinimalOperationalLiquidity({ ...wethUsdc, token0PriceUsd: 2000 }),
      5_000_000_000_000_000n,
    );
  });

  it("uses a custom targetValueUsd instead of the $10 default", () => {
    assert.equal(
      sdk.recommendedMinimalOperationalLiquidity({ ...wethUsdc, targetValueUsd: 1 }),
      333_333_333_333_334n,
    );
  });

  it("rejects a non-positive targetValueUsd", () => {
    assert.throws(() =>
      sdk.recommendedMinimalOperationalLiquidity({ ...wethUsdc, targetValueUsd: 0 }),
    );
  });

  it("scales by the pool's internal decimals when a token has more than 18", () => {
    assert.equal(
      sdk.recommendedMinimalOperationalLiquidity({
        initialScaledAmount0PerE18Shares: 10n ** 18n,
        initialScaledAmount1PerE18Shares: 10n ** 18n,
        token0PriceUsd: 1,
        token1PriceUsd: 1,
        token0Decimals: 36,
        token1Decimals: 6,
      }),
      10n ** 37n,
    );
  });

  it("never goes below the factory minimum", () => {
    assert.equal(
      sdk.recommendedMinimalOperationalLiquidity({
        ...wethUsdc,
        initialScaledAmount1PerE18Shares: 10n ** 18n,
        token0PriceUsd: 1e14,
        token1PriceUsd: 1e14,
      }),
      1_000_000n,
    );
  });

  it("rejects non-positive USD prices", () => {
    assert.throws(() =>
      sdk.recommendedMinimalOperationalLiquidity({ ...wethUsdc, token0PriceUsd: 0 }),
    );
  });

  it("rejects decimals outside uint8", () => {
    assert.throws(
      () => sdk.recommendedMinimalOperationalLiquidity({ ...wethUsdc, token1Decimals: 256 }),
      /token decimals must be an integer in \[0, 255\]/,
    );
  });
});

describe("prepareFactoryCreatePoolParams validation", () => {
  it("throws when minimalOperationalLiquidity is below the computed minimum", () => {
    assert.throws(
      () =>
        sdk.prepareFactoryCreatePoolParams({
          ...base,
          initialScaledAmount0PerE18Shares: 10n ** 18n,
          initialScaledAmount1PerE18Shares: 10n ** 18n,
          minimalOperationalLiquidity: 999_999n,
          bidAskRefAsymmetryX8: sdk.DISABLED_BID_ASK_REF_ASYMMETRY_X8,
        }),
      /minimalOperationalLiquidity must be at least 1000000/,
    );
  });

  it("accepts minimalOperationalLiquidity exactly at the computed minimum", () => {
    assert.doesNotThrow(() =>
      sdk.prepareFactoryCreatePoolParams({
        ...base,
        initialScaledAmount0PerE18Shares: 10n ** 18n,
        initialScaledAmount1PerE18Shares: 10n ** 18n,
        minimalOperationalLiquidity: 1_000_000n,
        bidAskRefAsymmetryX8: sdk.DISABLED_BID_ASK_REF_ASYMMETRY_X8,
      }),
    );
  });

  it("rejects a negative, zero, or non-integer bidAskRefAsymmetryX8", () => {
    const paramsBase = {
      ...base,
      initialScaledAmount0PerE18Shares: 10n ** 18n,
      initialScaledAmount1PerE18Shares: 10n ** 18n,
      minimalOperationalLiquidity: 1_000_000n,
    };
    assert.throws(
      () => sdk.prepareFactoryCreatePoolParams({ ...paramsBase, bidAskRefAsymmetryX8: -1 }),
      /bidAskRefAsymmetryX8 must be a positive integer/,
    );
    assert.throws(
      () => sdk.prepareFactoryCreatePoolParams({ ...paramsBase, bidAskRefAsymmetryX8: 1.5 }),
      /bidAskRefAsymmetryX8 must be a positive integer/,
    );
    // 0 demands r1 == r2 exactly, which is unsatisfiable and would deploy a dead pool
    // (metric-core docs/POOL_CONFIGURATION_AND_MANAGEMENT.md §2.2.1) — reject it explicitly
    // rather than silently accept a config that makes every swap and quote revert.
    assert.throws(
      () => sdk.prepareFactoryCreatePoolParams({ ...paramsBase, bidAskRefAsymmetryX8: 0 }),
      /bidAskRefAsymmetryX8 must be a positive integer/,
    );
  });

  it("rejects bidAskRefAsymmetryX8 above uint16.max", () => {
    assert.throws(
      () =>
        sdk.prepareFactoryCreatePoolParams({
          ...base,
          initialScaledAmount0PerE18Shares: 10n ** 18n,
          initialScaledAmount1PerE18Shares: 10n ** 18n,
          minimalOperationalLiquidity: 1_000_000n,
          bidAskRefAsymmetryX8: sdk.DISABLED_BID_ASK_REF_ASYMMETRY_X8 + 1,
        }),
      /bidAskRefAsymmetryX8 exceeds uint16.max/,
    );
  });

  it("accepts a positive bidAskRefAsymmetryX8 and the disabled sentinel", () => {
    const paramsBase = {
      ...base,
      initialScaledAmount0PerE18Shares: 10n ** 18n,
      initialScaledAmount1PerE18Shares: 10n ** 18n,
      minimalOperationalLiquidity: 1_000_000n,
    };
    assert.doesNotThrow(() =>
      sdk.prepareFactoryCreatePoolParams({ ...paramsBase, bidAskRefAsymmetryX8: 1 }),
    );
    assert.doesNotThrow(() =>
      sdk.prepareFactoryCreatePoolParams({
        ...paramsBase,
        bidAskRefAsymmetryX8: sdk.DISABLED_BID_ASK_REF_ASYMMETRY_X8,
      }),
    );
  });
});

describe("DISABLED_BID_ASK_REF_ASYMMETRY_X8", () => {
  it("is uint16.max", () => {
    assert.equal(sdk.DISABLED_BID_ASK_REF_ASYMMETRY_X8, 0xffff);
    assert.equal(sdk.DISABLED_BID_ASK_REF_ASYMMETRY_X8, 65_535);
  });
});
