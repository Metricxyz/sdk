import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { maxUint128, parseUnits } from "viem";
import * as sdk from "../../src/index.js";
import {
  approveTokensForLiquidityAdder,
  createPoolViaFactory,
  deployMetricTestEnv,
} from "../shared/testEnv.js";

describe("SwapAllowlistExtension E2E", async () => {
  const { viem } = (await network.connect("hardhat")) as any;
  const [deployer, swapper] = await viem.getWalletClients();

  it("blocks swaps until pool admin allows the swapper", async () => {
    const env = await deployMetricTestEnv(viem, deployer);
    const swapAllowlist = await viem.deployContract("SwapAllowlistExtension", [
      env.factory.address,
    ]);

    const pool = await createPoolViaFactory(env, deployer, {
      extensions: [swapAllowlist.address],
      extensionOrders: sdk.buildExtensionOrders({ beforeSwap: [1] }),
      extensionInitData: [sdk.EMPTY_EXTENSION_INIT_DATA],
    });

    const max0 = parseUnits("1000000", 18);
    const max1 = parseUnits("1000000", 6);
    await approveTokensForLiquidityAdder(env, deployer, max0, max1);
    await env.token0.write.approve([env.swapper.address, max0]);
    await env.token1.write.approve([env.swapper.address, max1]);

    const salt = 1n;
    const addData = sdk.encodeAddLiquidityExactSharesSelfCalldata({
      pool,
      salt,
      deltas: {
        binIdxs: [-2n, -1n, 0n, 1n, 2n],
        shares: [5_000_000n, 5_000_000n, 10_000_000n, 5_000_000n, 5_000_000n],
      },
      maxAmountToken0: sdk.NO_SLIPPAGE_LIMIT,
      maxAmountToken1: sdk.NO_SLIPPAGE_LIMIT,
    });
    const addHash = await deployer.sendTransaction({
      to: env.liquidityAdder.address,
      data: addData,
    });
    await env.publicClient.waitForTransactionReceipt({ hash: addHash });

    await env.token1.write.mint([swapper.account.address, parseUnits("100", 6)], {
      account: swapper.account,
    });
    await env.token1.write.approve([env.swapper.address, parseUnits("100", 6)], {
      account: swapper.account,
    });

    const swapData = sdk.encodeSwapExactInputCalldata({
      pool,
      recipient: swapper.account.address,
      zeroForOne: false,
      amountIn: parseUnits("1", 6),
      priceLimitX64: maxUint128,
      minAmountOut: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    });

    await assert.rejects(
      async () => {
        const hash = await swapper.sendTransaction({
          to: env.swapper.address,
          data: swapData,
        });
        await env.publicClient.waitForTransactionReceipt({ hash });
      },
      { message: /NotAllowedToSwap/ },
    );

    const allowTx = await deployer.sendTransaction({
      to: swapAllowlist.address,
      data: sdk.encodeSetAllowedToSwapCalldata({
        extension: swapAllowlist.address,
        pool,
        swapper: env.swapper.address,
        allowed: true,
      }),
    });
    await env.publicClient.waitForTransactionReceipt({ hash: allowTx });

    const allowed = await swapAllowlist.read.isAllowedToSwap([pool, env.swapper.address]);
    assert.equal(allowed, true);

    const swapHash = await swapper.sendTransaction({
      to: env.swapper.address,
      data: swapData,
    });
    const receipt = await env.publicClient.waitForTransactionReceipt({ hash: swapHash });
    assert.equal(receipt.status, "success");
  });
});
