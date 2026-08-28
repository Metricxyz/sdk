import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData } from "viem";
import { MetricOmmPoolAbi } from "../src/abis/index.js";
import * as sdk from "../src/index.js";

describe("encodeRemoveLiquidityCalldata (v1)", () => {
  it("matches direct viem encodeFunctionData for removeLiquidity", () => {
    const owner = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    const salt = 42n;
    const deltas = {
      binIdxs: [-1, 0, 1] as const,
      shares: [100n, 200n, 300n] as const,
    };

    const viaSdk = sdk.encodeRemoveLiquidityCalldata({ owner, salt, deltas });

    const direct = encodeFunctionData({
      abi: MetricOmmPoolAbi,
      functionName: "removeLiquidity",
      args: [owner, salt, { binIdxs: [...deltas.binIdxs], shares: [...deltas.shares] }, "0x"],
    });

    assert.equal(viaSdk, direct);
  });
});
