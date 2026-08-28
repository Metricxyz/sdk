import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseUnits } from "viem";
import * as sdk from "../../src/index.js";
import { createPoolViaFactory, deployMetricTestEnv } from "../shared/testEnv.js";

describe("DepositAllowlistExtension E2E", async () => {
  const { viem } = (await network.connect("hardhat")) as any;
  const [deployer, depositor] = await viem.getWalletClients();

  it("blocks deposits until pool admin allows the depositor", async () => {
    const env = await deployMetricTestEnv(viem, deployer);
    const depositAllowlist = await viem.deployContract("DepositAllowlistExtension", [
      env.factory.address,
    ]);

    const pool = await createPoolViaFactory(env, deployer, {
      extensions: [depositAllowlist.address],
      extensionOrders: sdk.buildExtensionOrders({ beforeAddLiquidity: [1] }),
      extensionInitData: [sdk.EMPTY_EXTENSION_INIT_DATA],
    });

    const max0 = parseUnits("1000", 18);
    const max1 = parseUnits("1000", 6);
    await env.token0.write.mint([depositor.account.address, max0], { account: depositor.account });
    await env.token1.write.mint([depositor.account.address, max1], { account: depositor.account });
    await env.token0.write.approve([env.liquidityAdder.address, max0], {
      account: depositor.account,
    });
    await env.token1.write.approve([env.liquidityAdder.address, max1], {
      account: depositor.account,
    });

    const salt = 42n;
    const deltas: sdk.PoolLiquidityDelta = {
      binIdxs: [-1n, 0n, 1n],
      shares: [1_000_000n, 1_000_000n, 1_000_000n],
    };
    const blockedAdd = sdk.encodeAddLiquidityExactSharesSelfCalldata({
      pool,
      salt,
      deltas,
      maxAmountToken0: sdk.NO_SLIPPAGE_LIMIT,
      maxAmountToken1: sdk.NO_SLIPPAGE_LIMIT,
    });

    await assert.rejects(
      async () => {
        const hash = await depositor.sendTransaction({
          to: env.liquidityAdder.address,
          data: blockedAdd,
        });
        await env.publicClient.waitForTransactionReceipt({ hash });
      },
      { message: /NotAllowedToDeposit/ },
    );

    const allowTx = await deployer.sendTransaction({
      to: depositAllowlist.address,
      data: sdk.encodeSetAllowedToDepositCalldata({
        extension: depositAllowlist.address,
        pool,
        depositor: depositor.account.address,
        allowed: true,
      }),
    });
    await env.publicClient.waitForTransactionReceipt({ hash: allowTx });

    const allowed = await depositAllowlist.read.isAllowedToDeposit([
      pool,
      depositor.account.address,
    ]);
    assert.equal(allowed, true);

    const allowedAddHash = await depositor.sendTransaction({
      to: env.liquidityAdder.address,
      data: blockedAdd,
    });
    const receipt = await env.publicClient.waitForTransactionReceipt({ hash: allowedAddHash });
    assert.equal(receipt.status, "success");
  });
});
