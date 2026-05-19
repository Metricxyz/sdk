import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Q64 } from "../src/constants.js";
import { priceX64ToPriceE18 } from "../src/utils/liquidityMath.js";

describe("priceX64ToPriceE18", () => {
  it("maps 1.0 in Q64 to 1e18", () => {
    assert.equal(priceX64ToPriceE18(Q64), 10n ** 18n);
  });

  it("handles large on-chain Q64 without Number conversion", () => {
    const priceX64 = 1309319182557697118630402n;
    const priceE18 = priceX64ToPriceE18(priceX64);
    assert.ok(priceE18 > 0n);
    assert.ok(priceE18 < priceX64 * 2n);
  });
});
