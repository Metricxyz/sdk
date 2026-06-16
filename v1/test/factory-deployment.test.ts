/**
 * Test: Factory Deployment and Pool Creation Flow
 *
 * Tests the complete deployment flow:
 * 1. Deploy PoolDeployer
 * 2. Deploy Factory with PoolDeployer
 * 3. Create a pool via Factory using SDK
 */

import { describe, it } from "node:test";
import { deployLinkedPoolDeployer } from "./shared/testEnv.js";
import assert from "node:assert";
import { network } from "hardhat";
import { zeroAddress } from "viem";
import * as sdk from "../src/index.js";

describe("Factory Deployment Flow", async () => {
  const { viem, networkHelpers } = (await network.connect("hardhat")) as any;

  async function deployFactoryInfrastructure() {
    const publicClient = await viem.getPublicClient();
    const [ownerClient, adminClient] = await viem.getWalletClients();

    // Deploy mock tokens
    const token0 = await viem.deployContract("MockERC20", ["Token 0", "TKN0", 18]);
    const token1 = await viem.deployContract("MockERC20", ["Token 1", "TKN1", 18]);

    // Deploy mock price provider (Q64.64 format: 1 << 64 = 1:1 price)
    const oneToOnePrice = 1n << 64n;
    const priceProvider = await viem.deployContract("MockOracle", []);
    await priceProvider.write.setTokens([token0.address, token1.address]);
    await priceProvider.write.setBidAndAskPrice([oneToOnePrice, oneToOnePrice]);

    // Deploy factory first
    const factory = await viem.deployContract("MetricOmmPoolFactory", [
      ownerClient.account.address,
    ]);

    // Deploy pool deployer with factory address
    const poolDeployer = await deployLinkedPoolDeployer(viem, factory.address);

    // Link deployer to factory (owner calls setPoolDeployer)
    await factory.write.setPoolDeployer([poolDeployer.address]);

    return {
      publicClient,
      owner: ownerClient,
      admin: adminClient,
      token0,
      token1,
      priceProvider,
      poolDeployer,
      factory,
    };
  }

  it("should deploy factory infrastructure correctly", async () => {
    const {
      factory,
      poolDeployer,
      owner: ownerClient,
    } = await networkHelpers.loadFixture(deployFactoryInfrastructure);

    // Check factory is deployed
    assert.ok(factory.address, "Factory should be deployed");

    // Check pool deployer is linked to factory
    const factoryInDeployer = (await poolDeployer.read.FACTORY()) as any;
    assert.equal(
      factoryInDeployer.toLowerCase(),
      factory.address.toLowerCase(),
      "Deployer should be linked to factory",
    );

    // Check factory ownership
    const factoryOwner = (await factory.read.owner()) as any;
    assert.equal(
      factoryOwner.toLowerCase(),
      ownerClient.account.address.toLowerCase(),
      "Factory owner should be set correctly",
    );

    // Default protocol spread fee starts at zero
    const defaultFee = await factory.read.spreadProtocolFeeE6();
    assert.equal(defaultFee, 0, "Default protocol spread fee should be zero");
  });

  it("should create a pool via factory using SDK calldata", async () => {
    const { publicClient, factory, token0, token1, priceProvider, admin } =
      await networkHelpers.loadFixture(deployFactoryInfrastructure);
    const [walletClient] = await viem.getWalletClients();

    // Create pool config using SDK
    const poolConfig: sdk.CreatePoolFactoryParams = {
      token0: token0.address,
      token1: token1.address,
      priceProvider: priceProvider.address,
      admin: admin.account.address,

      // 10 bins on each side, 1% each
      nonNegativeBins: sdk.createUniformBins(10, 10_000),
      negativeBins: sdk.createUniformBins(10, 10_000),

      // Config
      adminSpreadFeeE6: 50000,
      adminNotionalFeeE8: 0,
      adminFeeDestination: admin.account.address,
      initialScaledToken0PerShareE18: 1000000000000000000n,
      initialScaledToken1PerShareE18: 1000000000000000000n,
      minimalMintableLiquidity: 1000n,
      curBinDistFromProvidedPricePercent: 0,
    };

    // Use encodeCreatePoolCalldata to prepare calldata
    const calldata = sdk.encodeCreatePoolCalldata(poolConfig);

    // Verify calldata is valid
    assert.ok(calldata.startsWith("0x"), "Calldata should be hex encoded");
    assert.ok(calldata.length > 10, "Calldata should have content");

    // Send transaction manually using encoded calldata
    const hash = await walletClient.sendTransaction({
      to: factory.address,
      data: calldata,
    });

    assert.ok(hash, "Transaction hash should be returned");

    // Wait for transaction
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success", "Transaction should succeed");

    // Verify pool was created (check logs)
    assert.ok(receipt.logs.length > 0, "Should emit PoolCreated event");
  });

  it("should encode pool creation calldata correctly", async () => {
    const { token0, token1, priceProvider, admin } = await networkHelpers.loadFixture(
      deployFactoryInfrastructure,
    );

    const poolConfig: sdk.CreatePoolFactoryParams = {
      token0: token0.address,
      token1: token1.address,
      priceProvider: priceProvider.address,
      admin: admin.account.address,
      adminFeeDestination: admin.account.address,
      nonNegativeBins: sdk.createUniformBins(5, 10_000),
      negativeBins: sdk.createUniformBins(5, 10_000),
      adminSpreadFeeE6: 50000,
      adminNotionalFeeE8: 0,
      initialScaledToken0PerShareE18: 1000000000000000000n,
      initialScaledToken1PerShareE18: 1000000000000000000n,
      minimalMintableLiquidity: 1000n,
      curBinDistFromProvidedPricePercent: 0,
    };

    // Test calldata encoding (useful for multisig/batch transactions)
    const calldata = sdk.encodeCreatePoolCalldata(poolConfig);
    assert.ok(calldata.startsWith("0x"), "Calldata should be hex encoded");
    assert.ok(calldata.length > 10, "Calldata should have content");
  });

  it("should prevent pool deployer from being set twice on factory", async () => {
    const { factory, poolDeployer } = await networkHelpers.loadFixture(deployFactoryInfrastructure);

    // Try to set pool deployer again (should fail - already set)
    await assert.rejects(
      async () => {
        await factory.write.setPoolDeployer([poolDeployer.address]);
      },
      { message: /PoolDeployerAlreadySet/ },
      "Should revert when trying to set pool deployer twice",
    );
  });

  it("should only allow factory to deploy pools via deployer", async () => {
    const { factory, poolDeployer, token0, token1, priceProvider, admin } =
      await networkHelpers.loadFixture(deployFactoryInfrastructure);

    const emptyBin = {
      token0BalanceScaled: 0n,
      token1BalanceScaled: 0n,
      lengthE6: 10_000,
      addFeeBuyE6: 0,
      addFeeSellE6: 0,
    };

    // Try to call deploy directly on deployer (not from factory)
    await assert.rejects(
      async () => {
        await poolDeployer.write.deploy([
          {
            salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
            factory: factory.address,
            admin: admin.account.address,
            adminFeeDestination: admin.account.address,
            token0: token0.address,
            token1: token1.address,
            priceProvider: priceProvider.address,
            extensions: {
              extension1: zeroAddress,
              extension2: zeroAddress,
              extension3: zeroAddress,
              extension4: zeroAddress,
              extension5: zeroAddress,
              extension6: zeroAddress,
              extension7: zeroAddress,
            },
            extensionOrders: {
              beforeAddLiquidity: 0,
              afterAddLiquidity: 0,
              beforeRemoveLiquidity: 0,
              afterRemoveLiquidity: 0,
              beforeSwap: 0,
              afterSwap: 0,
            },
            immutablePriceProvider: false,
            token0ScaleMultiplier: 1n,
            token1ScaleMultiplier: 1n,
            initialScaledAmount0PerShareE18: 1_000_000_000_000_000_000n,
            initialScaledAmount1PerShareE18: 1_000_000_000_000_000_000n,
            minimalMintableLiquidity: 1000n,
            spreadFeeE6: 5000,
            curBinDistFromProvidedPriceE6: 0,
            nonNegativeBinStates: [emptyBin],
            negativeBinStates: [emptyBin],
            notionalFeeE8: 0,
          },
        ]);
      },
      { message: /OnlyFactory/ },
      "Should revert when non-factory tries to deploy",
    );
  });
});
