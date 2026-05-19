import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as sdk from "../src/index.js";

const base = {
  publicClient: {} as never,
  dataProviderAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const,
  poolAddress: "0xcccccccccccccccccccccccccccccccccccccccc" as const,
  owner: "0xdddddddddddddddddddddddddddddddddddddddd" as const,
  salt: 1n,
};

describe("buildModifyLiquidityArgsForPercentageRemoval validation", () => {
  it("rejects percentage outside (0, 100] before RPC", async () => {
    await assert.rejects(
      () =>
        sdk.buildModifyLiquidityArgsForPercentageRemoval({
          ...base,
          percentageToRemove: 0,
          bins: [0],
        }),
      /percentageToRemove must be between 0 and 100/,
    );
    await assert.rejects(
      () =>
        sdk.buildModifyLiquidityArgsForPercentageRemoval({
          ...base,
          percentageToRemove: 101,
          bins: [0],
        }),
      /percentageToRemove must be between 0 and 100/,
    );
  });
});

describe("buildModifyLiquidityArgsForRemoval validation", () => {
  it("rejects specs with both percentage and absolute shares", async () => {
    await assert.rejects(
      () =>
        sdk.buildModifyLiquidityArgsForRemoval({
          ...base,
          specs: [{ bin: 0, percentageToRemove: 50, sharesToRemove: 1n }],
        }),
      /either percentageToRemove or sharesToRemove, not both/,
    );
  });

  it("returns empty deltas for empty specs without RPC", async () => {
    const result = await sdk.buildModifyLiquidityArgsForRemoval({
      ...base,
      specs: [],
    });
    assert.deepEqual(result, [1n, [], sdk.NO_SLIPPAGE_LIMIT, sdk.NO_SLIPPAGE_LIMIT]);
  });
});
