import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre, { network } from "hardhat";
import type { Address } from "viem";
import * as sdk from "../index.js";

describe("debug/arbitrum live overflow reproduction", async function () {
  it("checks current behavior for reported payload", async () => {
    const arbitrumNetworkConfig = hre.config.networks.arbitrum;
    if (!("url" in arbitrumNetworkConfig)) {
      throw new Error("arbitrum network configuration must expose url");
    }
    const arbitrumRpcUrl = await arbitrumNetworkConfig.url.getUrl();

    const { viem } = await network.connect({
      network: "arbitrum",
      override: {
        url: arbitrumRpcUrl,
        accounts: "remote",
      },
    });
    const publicClient = await viem.getPublicClient();

    const params: sdk.BuildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmountParams = {
      publicClient,
      stateViewAddress: "0xe6b102a2aea65b9b59e4F8B86B38E221886675A8" as Address,
      poolAddress: "0x6B8fAd242098BD00F097063b1595e46696C59E5D" as Address,
      bins: [-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7],
      totalValueToAddInToken: 10_000_000n,
      totalValueInToken0: true,
      currentPriceX64: 1265651975169000449249385n,
      specAmountBufferPercent: 0.01,
    };

    let thrown: unknown;
    try {
      const args =
        await sdk.buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount(
          params,
        );
      console.error("[debug-arbitrum-live] success:", {
        deltas: args[1].length,
        spec0: args[2].toString(),
        spec1: args[3].toString(),
      });
    } catch (error) {
      thrown = error;
      console.error("[debug-arbitrum-live] throw:", error);
    }

    if (thrown) {
      const msg = thrown instanceof Error ? thrown.message : String(thrown);
      assert.match(msg, /sharesToAdd .* exceeds int104 max/);
    } else {
      assert.ok(true);
    }
  });
});
