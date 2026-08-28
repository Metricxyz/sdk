import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  additionPlanToPoolLiquidityDelta,
  removalPlanToPoolLiquidityDelta,
} from "../src/pool/liquidity.js";

describe("pool liquidity delta helpers", () => {
  it("maps addition deltas to positive bin shares", () => {
    const delta = additionPlanToPoolLiquidityDelta([
      { bin: 2, deltaShares: 50n },
      { bin: -1, deltaShares: -10n },
      { bin: 0, deltaShares: 100n },
    ]);
    assert.deepEqual(delta.binIdxs, [0n, 2n]);
    assert.deepEqual(delta.shares, [100n, 50n]);
  });

  it("maps removal deltas to burn shares", () => {
    const delta = removalPlanToPoolLiquidityDelta([
      { bin: 1, deltaShares: -30n },
      { bin: 0, deltaShares: 20n },
      { bin: -2, deltaShares: -5n },
    ]);
    assert.deepEqual(delta.binIdxs, [-2n, 1n]);
    assert.deepEqual(delta.shares, [5n, 30n]);
  });
});
