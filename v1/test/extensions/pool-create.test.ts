import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { encodeFunctionData, parseUnits } from "viem";
import { MetricOmmPoolFactoryAbi } from "../../src/abis/MetricOmmPoolFactory.js";
import * as sdk from "../../src/index.js";
import { createPoolViaFactory, deployMetricTestEnv } from "../shared/testEnv.js";

describe("extension pool create", async () => {
  const { viem } = (await network.connect("hardhat")) as any;
  const [deployer] = await viem.getWalletClients();

  it("createPool calldata with oracle stop-loss init matches factory ABI", async () => {
    const env = await deployMetricTestEnv(viem, deployer);
    const stopLoss = await viem.deployContract("OracleValueStopLossExtension", [
      env.factory.address,
    ]);

    const initData = sdk.encodeOracleStopLossInitData({
      drawdownE6: 50_000,
      decayPerSecondE18: 100n,
      timelockSeconds: 3600,
    });

    const params: sdk.CreatePoolFactoryParams = {
      token0: env.token0.address,
      token1: env.token1.address,
      priceProvider: env.priceProvider.address,
      admin: deployer.account.address,
      adminFeeDestination: deployer.account.address,
      adminSpreadFeeE6: 5000,
      adminNotionalFeeE8: 0,
      curBinDistFromProvidedPricePercent: 0,
      initialScaledAmount0PerE18Shares: parseUnits("1", 18),
      initialScaledAmount1PerE18Shares: parseUnits("1", 18),
      minimalOperationalLiquidity: 1_000_000n,
      protocolSpreadFeeE6: 0,
      protocolNotionalFeeE8: 0,
      bidAskRefAsymmetryX8: sdk.DISABLED_BID_ASK_REF_ASYMMETRY_X8,
      nonNegativeBins: sdk.createUniformBins(5, 10_000),
      negativeBins: sdk.createUniformBins(5, 10_000),
      extensions: [stopLoss.address],
      extensionOrders: sdk.buildExtensionOrders({ beforeSwap: [1], afterSwap: [1] }),
      extensionInitData: [initData],
      salt: "0x000000000000000000000000000000000000000000000000000000000000beef",
    };

    const prepared = sdk.prepareFactoryCreatePoolParams(params);
    const viaSdk = sdk.encodeCreatePoolCalldata(params);
    const viaAbi = encodeFunctionData({
      abi: MetricOmmPoolFactoryAbi,
      functionName: "createPool",
      args: [prepared],
    });
    assert.equal(viaSdk, viaAbi);

    const hash = await deployer.sendTransaction({ to: env.factory.address, data: viaSdk });
    const receipt = await env.publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");
  });

  it("createPoolViaFactory accepts deposit allowlist extension wiring", async () => {
    const env = await deployMetricTestEnv(viem, deployer);
    const depositAllowlist = await viem.deployContract("DepositAllowlistExtension", [
      env.factory.address,
    ]);

    const pool = await createPoolViaFactory(env, deployer, {
      extensions: [depositAllowlist.address],
      extensionOrders: sdk.buildExtensionOrders({ beforeAddLiquidity: [1] }),
      extensionInitData: [sdk.EMPTY_EXTENSION_INIT_DATA],
    });

    const imm = await sdk.getPoolImmutables(env.publicClient, env.factory.address, pool);
    assert.equal(imm.extensions.extension1.toLowerCase(), depositAllowlist.address.toLowerCase());
    assert.equal(imm.extensionOrders.beforeAddLiquidity, 1n);
  });
});
