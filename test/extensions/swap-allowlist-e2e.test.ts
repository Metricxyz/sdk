import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { maxUint128, parseUnits } from "viem";
import * as sdk from "../../src/index.js";
import {
  approveTokensForLiquidityAdder,
  approveTokensForSimpleRouter,
  buildExactInputSingleTestParams,
  createPoolViaFactory,
  deployMetricTestEnv,
} from "../shared/testEnv.js";

describe("SwapAllowlistExtension E2E", async () => {
  const { viem } = (await network.connect("hardhat")) as any;
  const [deployer, trader] = await viem.getWalletClients();

  it("blocks swaps until pool admin allows the simple router", async () => {
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
    await approveTokensForSimpleRouter(env, deployer, max0, max1);

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

    await env.token1.write.mint([trader.account.address, parseUnits("100", 6)], {
      account: trader.account,
    });
    await env.token1.write.approve([env.simpleRouter.address, parseUnits("100", 6)], {
      account: trader.account,
    });

    const swapData = sdk.encodeExactInputSingleCalldata(
      buildExactInputSingleTestParams(env, pool, {
        recipient: trader.account.address,
        zeroForOne: false,
        amountIn: parseUnits("1", 6),
        priceLimitX64: maxUint128,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      }),
    );

    await assert.rejects(
      async () => {
        const hash = await trader.sendTransaction({
          to: env.simpleRouter.address,
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
        swapper: env.simpleRouter.address,
        allowed: true,
      }),
    });
    await env.publicClient.waitForTransactionReceipt({ hash: allowTx });

    const allowed = await swapAllowlist.read.isAllowedToSwap([pool, env.simpleRouter.address]);
    assert.equal(allowed, true);

    const swapHash = await trader.sendTransaction({
      to: env.simpleRouter.address,
      data: swapData,
    });
    const receipt = await env.publicClient.waitForTransactionReceipt({ hash: swapHash });
    assert.equal(receipt.status, "success");
  });
});
