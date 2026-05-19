import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodeBinStateBytes32,
  decodeBinTotalSharesBytes32,
  encodeBinStateBytes32,
  scaledBalanceToExternal,
} from "../src/utils/poolState.js";

describe("poolState decode", () => {
  it("round-trips bin state packing", () => {
    const state = {
      token0BalanceScaled: 12345n,
      token1BalanceScaled: 67890n,
      lengthE6: 10_000,
      addFeeBuyE6: 100,
      addFeeSellE6: 200,
    };
    const word = encodeBinStateBytes32(state);
    const decoded = decodeBinStateBytes32(word);
    assert.deepEqual(decoded, state);
  });

  it("decodes bin total shares word", () => {
    assert.equal(
      decodeBinTotalSharesBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000005",
      ),
      5n,
    );
  });

  it("unscales with floor division", () => {
    assert.equal(scaledBalanceToExternal(1_500_000n, 1_000_000n), 1n);
    assert.equal(scaledBalanceToExternal(999_999n, 1_000_000n), 0n);
  });
});
