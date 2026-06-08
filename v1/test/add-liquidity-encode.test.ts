import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData } from "viem";
import { MetricOmmPoolLiquidityAdderAbi } from "../src/abis/index.js";
import * as sdk from "../src/index.js";

const pool = "0x0000000000000000000000000000000000000001" as const;
const owner = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const salt = 7n;
const deltas = {
  binIdxs: [0n, 1n] as const,
  shares: [100n, 200n] as const,
};

describe("LiquidityAdder calldata encoders (v1)", () => {
  it("encodeAddLiquidityExactSharesSelfCalldata matches viem", () => {
    const max0 = 1_000n;
    const max1 = 2_000n;
    const viaSdk = sdk.encodeAddLiquidityExactSharesSelfCalldata({
      pool,
      salt,
      deltas,
      maxAmountToken0: max0,
      maxAmountToken1: max1,
    });
    const direct = encodeFunctionData({
      abi: MetricOmmPoolLiquidityAdderAbi,
      functionName: "addLiquidityExactShares",
      args: [
        pool,
        salt,
        { binIdxs: [...deltas.binIdxs], shares: [...deltas.shares] },
        max0,
        max1,
        "0x",
      ],
    });
    assert.equal(viaSdk, direct);
  });

  it("encodeAddLiquidityExactSharesWithOwnerCalldata matches viem", () => {
    const viaSdk = sdk.encodeAddLiquidityExactSharesWithOwnerCalldata({
      pool,
      owner,
      salt,
      deltas,
      maxAmountToken0: 1n,
      maxAmountToken1: 2n,
    });
    const direct = encodeFunctionData({
      abi: MetricOmmPoolLiquidityAdderAbi,
      functionName: "addLiquidityExactShares",
      args: [
        pool,
        owner,
        salt,
        { binIdxs: [...deltas.binIdxs], shares: [...deltas.shares] },
        1n,
        2n,
        "0x",
      ],
    });
    assert.equal(viaSdk, direct);
  });

  it("encodeAddLiquidityWeightedSelfCalldata matches viem", () => {
    const viaSdk = sdk.encodeAddLiquidityWeightedSelfCalldata({
      pool,
      salt,
      weightDeltas: deltas,
      maxAmountToken0: 3n,
      maxAmountToken1: 4n,
    });
    const direct = encodeFunctionData({
      abi: MetricOmmPoolLiquidityAdderAbi,
      functionName: "addLiquidityWeighted",
      args: [
        pool,
        salt,
        { binIdxs: [...deltas.binIdxs], shares: [...deltas.shares] },
        3n,
        4n,
        "0x",
      ],
    });
    assert.equal(viaSdk, direct);
  });
});
