import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre, { network } from "hardhat";
import type { Address } from "viem";
import * as sdk from "../index.js";

describe("debug/base live throw reproduction", async function () {
  it("builds args without uint104/int104 overflow for reported live params", async (t) => {
    const baseNetworkConfig = hre.config.networks.base;
    if (!("url" in baseNetworkConfig)) {
      throw new Error("base network configuration must expose url");
    }
    const baseRpcUrl = await baseNetworkConfig.url.getUrl();

    const { viem } = await network.connect({
      network: "base-local-fork",
      override: {
        forking: {
          url: baseRpcUrl,
          blockNumber: 43008508,
        },
      },
    });
    const publicClient = await viem.getPublicClient();

    const pinnedBlock = await publicClient.getBlockNumber();
    assert.equal(pinnedBlock, 43008508n);

    const params: sdk.BuildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmountParams = {
      publicClient,
      stateViewAddress: "0xe6b102a2aea65b9b59e4F8B86B38E221886675A8" as Address,
      poolAddress: "0x71089bACc43B7d03A2BB48E90C95F8164377f8aD" as Address,
      bins: [-2, -1, 0, 1],
      totalValueToAddInToken: 1_000_000n,
      totalValueInToken0: false,
      currentPriceX64: 1309319182557697118630402n,
      specAmountBufferPercent: 1,
    };

    const args =
      await sdk.buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount(
        params,
      );

    assert.equal(args[1].length, params.bins.length);
    assert.ok(args[2] >= 0n);
    assert.ok(args[3] >= 0n);
  });
});
