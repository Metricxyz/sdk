/**
 * Test: Factory Deployment and Pool Creation Flow
 *
 * Tests the complete deployment flow:
 * 1. Deploy PoolDeployer
 * 2. Deploy Factory with PoolDeployer
 * 3. Create a pool via Factory using SDK
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import * as sdk from "../index.js";

describe("Factory Deployment Flow", async () => {
  const { viem, networkHelpers } = (await network.connect("hardhat")) as any;
  const [owner] = await viem.getWalletClients();

  async function deployFactoryInfrastructure() {
    const publicClient = await viem.getPublicClient();
    const [ownerClient, adminClient] = await viem.getWalletClients();

    // Deploy mock tokens
    const token0 = await viem.deployContract("MockERC20", [
      "Token 0",
      "TKN0",
      18,
    ]);
    const token1 = await viem.deployContract("MockERC20", [
      "Token 1",
      "TKN1",
      18,
    ]);

    // Deploy mock price provider (Q64.64 format: 1 << 64 = 1:1 price)
    const oneToOnePrice = 1n << 64n;
    const priceProvider = await viem.deployContract("MockOracle", []);
    await priceProvider.write.setBidAndAskPrice([oneToOnePrice, oneToOnePrice]);

    // Deploy factory first
    const defaultProtocolFee = 100_000; // 10%
    const factory = await viem.deployContract("MetricOmmPoolFactory", [
      ownerClient.account.address,
      defaultProtocolFee,
    ]);

    // Deploy pool deployer with factory address
    const poolDeployer = await viem.deployContract("MetricOmmPoolDeployer", [
      factory.address,
    ]);

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
    const factoryInDeployer = (await poolDeployer.read.factory()) as any;
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

    // Check default protocol fee
    const defaultFee = await factory.read.protocolFee();
    assert.equal(defaultFee, 100_000, "Default protocol fee should be 10%");
  });

  it("should create a pool via factory using SDK calldata", async () => {
    const { publicClient, factory, token0, token1, priceProvider, admin } =
      await networkHelpers.loadFixture(deployFactoryInfrastructure);
    const [walletClient] = await viem.getWalletClients();

    // Create pool config using SDK
    const poolConfig: sdk.CreatePoolParams = {
      token0: token0.address,
      token1: token1.address,
      priceProvider: priceProvider.address,
      admin: admin.account.address,
      reportSwapToPriceProvider: false,

      // 10 bins on each side, 1% each
      nonNegativeBins: sdk.createUniformBins(10, 10_000),
      negativeBins: sdk.createUniformBins(10, 10_000),

      // Config
      maxDriftPercent: 5.0,
      driftDecayPerSecondPercent: 0.001,
      adminFeePercent: 5.0,
      adminFeeDestination: admin.account.address,
      initialToken0PerShare: 1000000000000000000n,
      initialToken1PerShare: 1000000000000000000n,
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
    const { token0, token1, priceProvider, admin } =
      await networkHelpers.loadFixture(deployFactoryInfrastructure);

    const poolConfig: sdk.CreatePoolParams = {
      token0: token0.address,
      token1: token1.address,
      priceProvider: priceProvider.address,
      admin: admin.account.address,
      reportSwapToPriceProvider: false,
      adminFeeDestination: admin.account.address,
      nonNegativeBins: sdk.createUniformBins(5, 10_000),
      negativeBins: sdk.createUniformBins(5, 10_000),
      maxDriftPercent: 5.0,
      driftDecayPerSecondPercent: 0.001,
      adminFeePercent: 5.0,
      initialToken0PerShare: 1000000000000000000n,
      initialToken1PerShare: 1000000000000000000n,
      minimalMintableLiquidity: 1000n,
      curBinDistFromProvidedPricePercent: 0,
    };

    // Test calldata encoding (useful for multisig/batch transactions)
    const calldata = sdk.encodeCreatePoolCalldata(poolConfig);
    assert.ok(calldata.startsWith("0x"), "Calldata should be hex encoded");
    assert.ok(calldata.length > 10, "Calldata should have content");
  });

  it("should prevent pool deployer from being set twice on factory", async () => {
    const { factory, poolDeployer } = await networkHelpers.loadFixture(
      deployFactoryInfrastructure,
    );

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
    const { poolDeployer, token0, token1, priceProvider, admin } =
      await networkHelpers.loadFixture(deployFactoryInfrastructure);

    // Try to call deploy directly on deployer (not from factory)
    await assert.rejects(
      async () => {
        await poolDeployer.write.deploy([
          {
            salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
            factory: admin.account.address,
            admin: admin.account.address,
            token0: token0.address,
            token1: token1.address,
            priceProvider: priceProvider.address,
            initialToken0DensityPerLiquidityE18: 1000000000000000000n,
            initialToken1DensityPerLiquidityE18: 1000000000000000000n,
            minimalMintableLiquidity: 1000n,
            reportSwapToPriceProvider: false,
            maxDriftE8: 5000000n,
            driftDecayPerSecondE8: 1000n,
            protocolFee: 100000,
            adminFee: 50000,
            adminFeeDestination: admin.account.address,
            curBinDistFromProvidedPriceE6: 0,
            nonNegativeBinDataArray: [100n],
            negativeBinDataArray: [100n],
          },
        ]);
      },
      { message: /OnlyFactory/ },
      "Should revert when non-factory tries to deploy",
    );
  });
});
