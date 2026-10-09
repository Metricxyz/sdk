/** Unpacking a pool's packed bin layout the way metric-core's factory reads it. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as sdk from "../src/index.js";

describe("unpackPoolBins", () => {
  it("returns both sides in ascending bin order with their lengths and fees", () => {
    // Bins 0 (length 100, fees 1/2) and 1 (length 200); bin -1 (length 50, fees 3/4).
    const nonNegative = [0x0000_0000_00c8_0002_0001_0064n];
    const negative = [0x0004_0003_0032n];

    assert.deepEqual(sdk.unpackPoolBins(nonNegative, negative), [
      { binIdx: -1, lengthE6: 50, addFeeBuyE6: 3, addFeeSellE6: 4 },
      { binIdx: 0, lengthE6: 100, addFeeBuyE6: 1, addFeeSellE6: 2 },
      { binIdx: 1, lengthE6: 200, addFeeBuyE6: 0, addFeeSellE6: 0 },
    ]);
  });

  it("ends each side at its first zero-length bin, ignoring later slots and words", () => {
    // Slot 0 length 100, slot 1 length 0 with a fee set, slot 2 length 300; then a second word.
    const nonNegative = [0x012c_0000_0005_0000_0000_0000_0064n, 0x0064n];

    assert.deepEqual(sdk.unpackPoolBins(nonNegative, []), [
      { binIdx: 0, lengthE6: 100, addFeeBuyE6: 0, addFeeSellE6: 0 },
    ]);
  });

  it("reads hex words and round-trips createBins", () => {
    const bins = [
      { lengthE6: 10_000, addFeeBuyE6: 500, addFeeSellE6: 200 },
      { lengthE6: 20_000, addFeeBuyE6: 0, addFeeSellE6: 0 },
    ];
    const words = sdk.createBins(bins).map((word) => `0x${word.toString(16)}` as const);

    assert.deepEqual(sdk.unpackBinDataArray(words), bins);
  });
});
