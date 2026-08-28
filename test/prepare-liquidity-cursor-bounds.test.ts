import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_UINT104 } from "../src/constants.js";
import {
  computeLiquidityCursorBounds,
  cursorMovementToPositionDelta,
} from "../src/pool/cursorBounds.js";

describe("prepareLiquidityCursorBounds helpers", () => {
  it("maps movement 1.0 to MAX_UINT104 position delta", () => {
    assert.equal(cursorMovementToPositionDelta(1), MAX_UINT104);
    assert.equal(cursorMovementToPositionDelta(0), 0n);
    assert.equal(cursorMovementToPositionDelta(0.5), MAX_UINT104 / 2n);
  });

  it("keeps bounds in the same bin when movement does not cross a boundary", () => {
    const curPosInBin = MAX_UINT104 / 2n;
    const bounds = computeLiquidityCursorBounds(3, curPosInBin, 0.25);
    const delta = cursorMovementToPositionDelta(0.25);

    assert.equal(bounds.minimalCurBin, 3);
    assert.equal(bounds.maximalCurBin, 3);
    assert.equal(bounds.minimalPosition, curPosInBin - delta);
    assert.equal(bounds.maximalPosition, curPosInBin + delta);
  });

  it("sums movement across bins when crossing boundaries", () => {
    const curPosInBin = MAX_UINT104 - 100n;
    const bounds = computeLiquidityCursorBounds(0, curPosInBin, 1);

    assert.equal(bounds.minimalCurBin, -1);
    assert.equal(bounds.minimalPosition, MAX_UINT104 - 99n);
    assert.equal(bounds.maximalCurBin, 1);
    assert.equal(bounds.maximalPosition, MAX_UINT104 - 101n);
  });

  it("handles negative bin indices when moving left", () => {
    const bounds = computeLiquidityCursorBounds(0, 50n, 1);

    assert.equal(bounds.minimalCurBin, -1);
    assert.equal(bounds.minimalPosition, 51n);
    assert.equal(bounds.maximalCurBin, 1);
    assert.equal(bounds.maximalPosition, 49n);
  });

  it("clamps to protocol cursor limits at the edges", () => {
    const upper = computeLiquidityCursorBounds(32767, MAX_UINT104, 1);

    assert.equal(upper.minimalCurBin, 32767);
    assert.equal(upper.minimalPosition, 0n);
    assert.equal(upper.maximalCurBin, 32767);
    assert.equal(upper.maximalPosition, MAX_UINT104);

    const lower = computeLiquidityCursorBounds(-32768, 0n, 1);
    assert.equal(lower.minimalCurBin, -32768);
    assert.equal(lower.minimalPosition, 0n);
    assert.equal(lower.maximalCurBin, -32768);
    assert.equal(lower.maximalPosition, MAX_UINT104);
  });
});
