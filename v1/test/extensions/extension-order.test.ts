import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as sdk from "../../src/index.js";

describe("encodeExtensionOrder", () => {
  it("packs slots the same way as ExtensionOrderTestLib", () => {
    assert.equal(sdk.encodeExtensionOrder([1]), 1n);
    assert.equal(sdk.encodeExtensionOrder([1, 0]), 1n);
    assert.equal(sdk.encodeExtensionOrder([2, 0, 0, 0, 0, 0, 0]), 2n);
    assert.equal(sdk.encodeExtensionOrder([1, 2]), 1n | (2n << 3n));
  });

  it("buildExtensionOrders defaults omitted actions to zero", () => {
    const orders = sdk.buildExtensionOrders({ beforeSwap: [1] });
    assert.deepEqual(orders, {
      ...sdk.EMPTY_EXTENSION_ORDERS,
      beforeSwap: 1n,
    });
  });

  it("rejects invalid slots", () => {
    assert.throws(() => sdk.encodeExtensionOrder([8]), /integer in \[0, 7\]/);
    assert.throws(() => sdk.encodeExtensionOrder(new Array(8).fill(1)), /at most 7 slots/);
  });
});
