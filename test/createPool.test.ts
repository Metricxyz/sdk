import { describe, it } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import { parseUnits, getContract, type Address } from "viem";
import * as sdk from "../index.js";

describe("SDK createPool", async () => {
  const { viem, networkHelpers } = await network.connect("hardhat");
  const [deployer] = await viem.getWalletClients();

  async function setupEnvironment() {
    const publicClient = await viem.getPublicClient();

    // Deploy tokens
    const token0 = await viem.deployContract("MockERC20", [
      "Token 0",
      "TKN0",
      18,
    ]);
    const token1 = await viem.deployContract("MockERC20", [
      "Token 1",
      "TKN1",
      6,
    ]);

    // Deploy price oracle
    const priceProvider = await viem.deployContract("MockOracle", []);
    const q64Price = sdk.priceToQ64(1.0);
    await priceProvider.write.setBidAndAskPrice([q64Price, q64Price]);

    // Deploy factory first
    const factory = await viem.deployContract("MetricOmmPoolFactory", [
      deployer.account.address, // owner
      100_000, // 10% default protocol fee
    ]);

    // Deploy pool deployer with factory address
    const poolDeployer = await viem.deployContract("MetricOmmPoolDeployer", [
      factory.address,
    ]);

    // Link deployer to factory
    await factory.write.setPoolDeployer([poolDeployer.address]);

    return {
      publicClient,
      deployer,
      token0,
      token1,
      priceProvider,
      factory,
    };
  }

  describe("createBins (E6 format)", () => {
    it("should create bins from BinData array", () => {
      const bins = sdk.createBins([
        { lengthE6: 10000, addFeeBuyE6: 0, addFeeSellE6: 0 }, // 1% bin, no extra fees
        { lengthE6: 20000, addFeeBuyE6: 500, addFeeSellE6: 0 }, // 2% bin, +0.05% buy fee
        { lengthE6: 5000, addFeeBuyE6: 100, addFeeSellE6: 50 }, // 0.5% bin, fees
      ]);

      // 3 bins should fit in 1 uint256 (5 bins per uint256)
      assert.strictEqual(bins.length, 1);
      assert.ok(bins[0] > 0n);
    });

    it("should create uniform bins with createUniformBins", () => {
      const bins = sdk.createUniformBins(10, 10000, 300, 100);

      // 10 bins = 2 uint256
      assert.strictEqual(bins.length, 2);
      assert.ok(bins[0] > 0n);
      assert.ok(bins[1] > 0n);
    });

    it("should handle empty bins array", () => {
      const bins = sdk.createBins([]);
      assert.strictEqual(bins.length, 0);
    });

    it("should handle bins with zero fees", () => {
      const bins = sdk.createBins([
        { lengthE6: 10000, addFeeBuyE6: 0, addFeeSellE6: 0 },
        { lengthE6: 10000, addFeeBuyE6: 0, addFeeSellE6: 0 },
      ]);

      assert.strictEqual(bins.length, 1);
    });
  });

  describe("prepareFactoryCreatePoolParams", () => {
    it("should prepare factory params correctly", async () => {
      const { token0, token1, priceProvider } =
        await networkHelpers.loadFixture(setupEnvironment);

      const params = sdk.prepareFactoryCreatePoolParams({
        token0: token0.address,
        token1: token1.address,
        priceProvider: priceProvider.address,
        admin: deployer.account.address,
        nonNegativeBins: sdk.createUniformBins(10, 10_000),
        negativeBins: sdk.createUniformBins(10, 10_000),
        adminFeePercent: 5.0,
        maxDriftPercent: 5.0,
        driftDecayPerSecondPercent: 0.001,
        initialToken0PerShare: 1000000000000000000n,
        initialToken1PerShare: 1000000000000000000n,
        minimalMintableLiquidity: 1000n,
        curBinDistFromProvidedPricePercent: 0,
      });

      assert.strictEqual(params.token0, token0.address);
      assert.strictEqual(params.token1, token1.address);
      assert.strictEqual(params.priceProvider, priceProvider.address);
      assert.strictEqual(params.admin, deployer.account.address);

      // Check fee conversions (1% = 10000 E6)
      assert.strictEqual(params.adminFee, 50000); // 5% = 50000

      // Check drift conversion (1% = 1_000_000 E8)
      assert.strictEqual(params.maxDriftE8, 5000000n); // 5% = 5_000_000

      // Check bin data arrays
      assert.strictEqual(params.nonNegativeBinDataArray.length, 2); // 10 bins = 2 uint256
      assert.strictEqual(params.negativeBinDataArray.length, 2);

      // Salt should be generated
      assert.ok(params.salt.startsWith("0x"));
      assert.strictEqual(params.salt.length, 66); // 0x + 64 hex chars
    });
  });

  describe("createPool via factory using encodeCreatePoolCalldata", () => {
    it("should create a pool successfully using encoded calldata", async () => {
      const { publicClient, token0, token1, priceProvider, factory } =
        await networkHelpers.loadFixture(setupEnvironment);

      const poolConfig: sdk.CreatePoolFactoryParams = {
        token0: token0.address,
        token1: token1.address,
        priceProvider: priceProvider.address,
        admin: deployer.account.address,
        nonNegativeBins: sdk.createUniformBins(20, 10_000),
        negativeBins: sdk.createUniformBins(20, 10_000),
        maxDriftPercent: 5.0,
        driftDecayPerSecondPercent: 0.001,
        adminFeePercent: 5.0,
        initialToken0PerShare: 1000000000000000000n,
        initialToken1PerShare: 1000000000000000000n,
        minimalMintableLiquidity: 1000n,
        curBinDistFromProvidedPricePercent: 0,
      };

      // Use encodeCreatePoolCalldata to prepare the calldata
      const calldata = sdk.encodeCreatePoolCalldata(poolConfig);

      // Verify calldata is properly formatted
      assert.ok(calldata.startsWith("0x"), "Calldata should be hex encoded");
      assert.ok(calldata.length > 10, "Calldata should have content");

      // Execute the transaction manually using the encoded calldata
      const hash = await deployer.sendTransaction({
        to: factory.address,
        data: calldata,
      });

      // Wait for transaction and verify success
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      // Verify pool was created by checking logs
      assert.ok(receipt.logs.length > 0, "Should emit PoolCreated event");

      console.log(`Pool created via calldata, tx hash: ${hash}`);
    });

    it("should create a pool with custom bins using calldata", async () => {
      const { publicClient, token0, token1, priceProvider, factory } =
        await networkHelpers.loadFixture(setupEnvironment);

      // Create custom bin configuration:
      const nonNegativeBins: bigint[] = sdk.packBinDataArray([
        { lengthE6: 1000, addFeeBuyE6: 0, addFeeSellE6: 4 },
        { lengthE6: 2000, addFeeBuyE6: 1, addFeeSellE6: 5 },
        { lengthE6: 3000, addFeeBuyE6: 2, addFeeSellE6: 6 },
        { lengthE6: 4000, addFeeBuyE6: 3, addFeeSellE6: 7 },
      ]);

      const negativeBins: bigint[] = sdk.packBinDataArray([
        { lengthE6: 1000, addFeeBuyE6: 4, addFeeSellE6: 0 },
        { lengthE6: 2000, addFeeBuyE6: 5, addFeeSellE6: 1 },
        { lengthE6: 3000, addFeeBuyE6: 6, addFeeSellE6: 2 },
        { lengthE6: 4000, addFeeBuyE6: 7, addFeeSellE6: 3 },
      ]);

      const poolConfig: sdk.CreatePoolFactoryParams = {
        token0: token0.address,
        token1: token1.address,
        priceProvider: priceProvider.address,
        admin: deployer.account.address,
        nonNegativeBins,
        negativeBins,
        adminFeePercent: 2.5,
        adminFeeDestination: deployer.account.address,
        maxDriftPercent: 3.0,
        driftDecayPerSecondPercent: 0.01,
        initialToken0PerShare: 1000000000000000000n,
        initialToken1PerShare: 1000000000000000000n,
        minimalMintableLiquidity: 1000n,
        curBinDistFromProvidedPricePercent: 0,
      };

      // Encode calldata
      const calldata = sdk.encodeCreatePoolCalldata(poolConfig);

      // Send transaction manually
      const hash = await deployer.sendTransaction({
        to: factory.address,
        data: calldata,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      console.log(`Custom pool created via calldata, tx hash: ${hash}`);
    });

    it("should create a pool using createBins (E6 format) via calldata", async () => {
      const { publicClient, token0, token1, priceProvider, factory } =
        await networkHelpers.loadFixture(setupEnvironment);

      const poolConfig: sdk.CreatePoolFactoryParams = {
        token0: token0.address,
        token1: token1.address,
        priceProvider: priceProvider.address,
        admin: deployer.account.address,
        // Using createBins with BinData (E6 values)
        nonNegativeBins: sdk.createBins([
          { lengthE6: 5000, addFeeBuyE6: 0, addFeeSellE6: 0 }, // 0.5% bin
          { lengthE6: 10000, addFeeBuyE6: 500, addFeeSellE6: 0 }, // 1% bin with +0.05% buy fee
          { lengthE6: 10000, addFeeBuyE6: 0, addFeeSellE6: 200 }, // 1% bin with +0.02% sell fee
          { lengthE6: 20000, addFeeBuyE6: 100, addFeeSellE6: 100 }, // 2% bin
        ]),
        // Using createUniformBins for uniform bins
        negativeBins: sdk.createUniformBins(10, 10000), // 10 uniform 1% bins
        maxDriftPercent: 5.0,
        driftDecayPerSecondPercent: 0.001,
        adminFeePercent: 5.0,
        initialToken0PerShare: 1000000000000000000n,
        initialToken1PerShare: 1000000000000000000n,
        minimalMintableLiquidity: 1000n,
        curBinDistFromProvidedPricePercent: 0,
      };

      // Encode calldata
      const calldata = sdk.encodeCreatePoolCalldata(poolConfig);

      // Send transaction manually
      const hash = await deployer.sendTransaction({
        to: factory.address,
        data: calldata,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      console.log(
        `Pool with createBins created via calldata, tx hash: ${hash}`,
      );
    });
  });

  describe("encodeCreatePoolCalldata", () => {
    it("should encode calldata for external use", async () => {
      const { token0, token1, priceProvider } =
        await networkHelpers.loadFixture(setupEnvironment);

      const calldata = sdk.encodeCreatePoolCalldata({
        token0: token0.address,
        token1: token1.address,
        priceProvider: priceProvider.address,
        admin: deployer.account.address,
        nonNegativeBins: sdk.createUniformBins(10, 10000),
        negativeBins: sdk.createUniformBins(10, 10000),
        maxDriftPercent: 5.0,
        driftDecayPerSecondPercent: 0.001,
        adminFeePercent: 5.0,
        initialToken0PerShare: 1000000000000000000n,
        initialToken1PerShare: 1000000000000000000n,
        minimalMintableLiquidity: 1000n,
        curBinDistFromProvidedPricePercent: 0,
      });

      assert.ok(calldata.startsWith("0x"));
      // createPool selector + encoded struct
      assert.ok(calldata.length > 10);
    });
  });
});
