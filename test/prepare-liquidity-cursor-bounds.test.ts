import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_UINT104 } from "../src/constants.js";
import { computeLiquidityCursorBounds } from "../src/pool/cursorBounds.js";

const pool = {
  lowestBin: -2,
  highestBin: 2,
  binLengthsE6: [10_000, 10_000, 5_000, 10_000, 10_000],
};

describe("computeLiquidityCursorBounds", () => {
  it("stays inside the current bin for a change smaller than its remaining width", () => {
    const bounds = computeLiquidityCursorBounds({
      ...pool,
      curBinIdx: -1,
      curPosInBin: 2n ** 103n - 1n,
      maxOracleDistanceChangePercent: 0.25,
    });

    assert.deepEqual(bounds, {
      minimalCurBin: -1,
      minimalPosition: 2n ** 102n,
      maximalCurBin: -1,
      maximalPosition: 2n ** 103n + 2n ** 102n - 2n,
    });
  });

  it("walks into a narrower neighbouring bin by its own width", () => {
    const bounds = computeLiquidityCursorBounds({
      ...pool,
      curBinIdx: -1,
      curPosInBin: MAX_UINT104,
      maxOracleDistanceChangePercent: 0.5,
    });

    assert.deepEqual(bounds, {
      minimalCurBin: -1,
      minimalPosition: 2n ** 103n,
      maximalCurBin: 0,
      maximalPosition: MAX_UINT104,
    });
  });

  it("clamps at the pool's lowest and highest bins", () => {
    const bounds = computeLiquidityCursorBounds({
      ...pool,
      curBinIdx: 2,
      curPosInBin: 2n ** 103n,
      maxOracleDistanceChangePercent: 5,
    });

    assert.deepEqual(bounds, {
      minimalCurBin: -2,
      minimalPosition: 0n,
      maximalCurBin: 2,
      maximalPosition: MAX_UINT104,
    });
  });

  it("pins both bounds to the current cursor for a zero change", () => {
    const bounds = computeLiquidityCursorBounds({
      ...pool,
      curBinIdx: 0,
      curPosInBin: 12_345n,
      maxOracleDistanceChangePercent: 0,
    });

    assert.deepEqual(bounds, {
      minimalCurBin: 0,
      minimalPosition: 12_345n,
      maximalCurBin: 0,
      maximalPosition: 12_345n,
    });
  });

  it("rounds inward within bins and across unequal bin widths", () => {
    const widths = [7_001, 13_003, 5_009];
    const distanceNumerator = (bin: number, position: bigint) =>
      widths.slice(0, bin).reduce((sum, width) => sum + BigInt(width) * MAX_UINT104, 0n) +
      BigInt(widths[bin]) * position;

    for (const position of [1n, MAX_UINT104 / 3n, MAX_UINT104 / 2n, MAX_UINT104 - 1n]) {
      for (const percent of [0.25, 0.75, 1]) {
        const bounds = computeLiquidityCursorBounds({
          lowestBin: 0,
          highestBin: 2,
          binLengthsE6: widths,
          curBinIdx: 1,
          curPosInBin: position,
          maxOracleDistanceChangePercent: percent,
        });
        const current = distanceNumerator(1, position);
        const minimum = distanceNumerator(bounds.minimalCurBin, bounds.minimalPosition);
        const maximum = distanceNumerator(bounds.maximalCurBin, bounds.maximalPosition);
        const allowed = BigInt(percent * 10_000) * MAX_UINT104;
        assert.ok(current - minimum <= allowed);
        assert.ok(maximum - current <= allowed);
        assert.ok(minimum <= current && maximum >= current);
        if (bounds.minimalPosition > 0n) {
          assert.ok(
            current - distanceNumerator(bounds.minimalCurBin, bounds.minimalPosition - 1n) >
              allowed,
          );
        }
        if (bounds.maximalPosition < MAX_UINT104) {
          assert.ok(
            distanceNumerator(bounds.maximalCurBin, bounds.maximalPosition + 1n) - current >
              allowed,
          );
        }
      }
    }
  });

  it("does not round a subprecision tolerance upward", () => {
    assert.deepEqual(
      computeLiquidityCursorBounds({
        ...pool,
        curBinIdx: 0,
        curPosInBin: 123n,
        maxOracleDistanceChangePercent: 0.00000000009,
      }),
      {
        minimalCurBin: 0,
        minimalPosition: 123n,
        maximalCurBin: 0,
        maximalPosition: 123n,
      },
    );
  });

  it("rejects a negative change and bin lengths that do not cover the pool", () => {
    assert.throws(
      () =>
        computeLiquidityCursorBounds({
          ...pool,
          curBinIdx: 0,
          curPosInBin: 0n,
          maxOracleDistanceChangePercent: -1,
        }),
      /non-negative/,
    );
    assert.throws(
      () =>
        computeLiquidityCursorBounds({
          ...pool,
          binLengthsE6: [10_000],
          curBinIdx: 0,
          curPosInBin: 0n,
          maxOracleDistanceChangePercent: 1,
        }),
      /one length per bin/,
    );
  });
});
