/**
 * Regression: collectFactoryFees must call the factory's real "collectEth" function
 * (viem resolves ABI function names case-sensitively — "collectETH" does not exist).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, zeroAddress } from "viem";
import * as sdk from "../src/index.js";
import { deployMetricTestEnv } from "./shared/testEnv.js";

describe("collectFactoryFees", () => {
  it("collects native ETH from the factory (exercises the real collectEth ABI function)", async () => {
    const { viem } = await network.connect();
    const [deployer, recipient] = await viem.getWalletClients();

    const env = await deployMetricTestEnv(viem, deployer);

    const fundHash = await deployer.sendTransaction({
      to: env.factory.address,
      value: parseEther("1"),
    });
    await env.publicClient.waitForTransactionReceipt({ hash: fundHash });

    const balancesBefore = await sdk.getFactoryAssetBalances(
      env.publicClient,
      env.factory.address,
      [zeroAddress],
    );
    assert.equal(balancesBefore[0]!.amount, parseEther("1"));

    const recipientBalanceBefore = await env.publicClient.getBalance({
      address: recipient.account.address,
    });

    const result = await sdk.collectFactoryFees({
      publicClient: env.publicClient,
      walletClient: deployer,
      factoryAddress: env.factory.address,
      target: recipient.account.address,
      assets: [zeroAddress],
      account: deployer.account.address,
    });

    assert.equal(result.collected.length, 1);
    assert.equal(result.collected[0]!.isNative, true);
    assert.equal(result.collected[0]!.amount, parseEther("1"));
    assert.equal(result.collected[0]!.receipt?.status, "success");

    const recipientBalanceAfter = await env.publicClient.getBalance({
      address: recipient.account.address,
    });
    assert.equal(recipientBalanceAfter - recipientBalanceBefore, parseEther("1"));

    const balancesAfter = await sdk.getFactoryAssetBalances(env.publicClient, env.factory.address, [
      zeroAddress,
    ]);
    assert.equal(balancesAfter[0]!.amount, 0n);
  });
});
