/**
 * SDK Integration Tests
 *
 * Tests SDK functions against actual deployed contracts to ensure:
 * 1. All read functions work correctly with DataProvider
 * 2. All write functions execute successfully
 * 3. Data consistency between direct pool calls and DataProvider calls
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits, type Address, getContract } from "viem";
import * as sdk from "../src/index.js";
import {
  encodeAddLiquidityCalldata,
  encodeRemoveLiquidityCalldataFromDeltas,
} from "./shared/liquidityTx.js";
import {
  createPoolViaFactory,
  deployMetricTestEnv,
  buildExactInputSingleTestParams,
} from "./shared/testEnv.js";

import MockERC20Artifact from "../artifacts/@metric/core/test/mocks/MockERC20.sol/MockERC20.json";
import MetricOmmPoolArtifact from "../artifacts/@metric/core/contracts/MetricOmmPool.sol/MetricOmmPool.json";

describe("SDK Integration Tests", async function () {
  const { viem, networkHelpers } = (await network.connect("hardhat")) as any;
  const [deployer] = await viem.getWalletClients();

  const prepareModifyLiquidity = (
    salt: bigint,
    deltas: sdk.LiquidityDelta[],
    specAmount0: bigint = sdk.NO_SLIPPAGE_LIMIT,
    specAmount1: bigint = sdk.NO_SLIPPAGE_LIMIT,
  ) => ({
    salt,
    deltas,
    specAmount0,
    specAmount1,
  });

  const encodePreparedModifyLiquidityAdd = (
    poolAddress: Address,
    prepared: {
      salt: bigint;
      deltas: sdk.LiquidityDelta[];
      specAmount0: bigint;
      specAmount1: bigint;
    },
  ) =>
    encodeAddLiquidityCalldata(poolAddress, [
      prepared.salt,
      prepared.deltas,
      prepared.specAmount0,
      prepared.specAmount1,
    ]);

  const encodePreparedModifyLiquidityRemove = (
    owner: Address,
    prepared: { salt: bigint; deltas: sdk.LiquidityDelta[] },
  ) => encodeRemoveLiquidityCalldataFromDeltas(owner, prepared.salt, prepared.deltas);

  const argsToPlan = (args: sdk.ModifyLiquidityArgs) => ({
    salt: args[0],
    deltas: args[1],
    specAmount0: args[2],
    specAmount1: args[3],
  });

  const buildModifyLiquidityArgsForUniformAdditionPlan = async (
    publicClient: any,
    factoryAddress: Address,
    dataProviderAddress: Address,
    poolAddress: Address,
    params: sdk.CalculateUniformLiquidityParams,
    salt: bigint = 0n,
    specAmountBufferPercent: number = 0,
  ) =>
    argsToPlan(
      await sdk.buildModifyLiquidityArgsForUniformAddition({
        publicClient,
        factoryAddress,
        dataProviderAddress,
        poolAddress,
        amountInTokensPerBin: params.amountInTokensPerBin,
        amountIsInToken0: params.amountIsInToken0,
        currentPrice: params.currentPrice,
        lowerBin: params.lowerBin,
        upperBin: params.upperBin,
        salt,
        specAmountBufferPercent,
      }),
    );

  async function setupTestEnvironment() {
    const env = await deployMetricTestEnv(viem, deployer);
    const {
      publicClient,
      token0,
      token1,
      priceProvider,
      dataProvider,
      liquidityAdder,
      factory,
      simpleRouter,
    } = env;

    const poolAddress = await createPoolViaFactory(env, deployer, {
      nonNegativeBins: sdk.createUniformBins(10, 10000, 0, 0),
      negativeBins: sdk.createUniformBins(10, 10000, 0, 0),
      adminSpreadFeeE6: 0,
      adminNotionalFeeE8: 0,
    });

    const pool = getContract({
      address: poolAddress,
      abi: MetricOmmPoolArtifact.abi,
      client: { public: publicClient, wallet: deployer },
    });

    const max0 = parseUnits("1000000", 18);
    const max1 = parseUnits("1000000", 6);
    await token0.write.mint([deployer.account.address, max0]);
    await token1.write.mint([deployer.account.address, max1]);
    await token0.write.approve([liquidityAdder.address, max0]);
    await token1.write.approve([liquidityAdder.address, max1]);
    await token0.write.approve([simpleRouter.address, max0]);

    return {
      env,
      pool,
      poolAddress,
      factory,
      dataProvider,
      liquidityAdder,
      simpleRouter,
      token0,
      token1,
      priceProvider,
      publicClient,
    };
  }

  describe("DataProvider Read Functions", () => {
    it("should read slot0 data", async () => {
      const { pool, dataProvider, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const slot0 = await sdk.getSlot0(publicClient, dataProvider.address, pool.address);

      assert.equal(typeof slot0.curBinIdx, "number");
      assert.equal(typeof slot0.curPosInBin, "bigint");
      assert.equal(typeof slot0.pauseLevel, "number");
      assert.equal(typeof slot0.spreadFeeE6, "number");
      assert.equal(typeof slot0.notionalFeeE8, "number");
    });

    it("should read slot1 data", async () => {
      const { pool, dataProvider, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const slot1 = await sdk.getSlot1(publicClient, dataProvider.address, pool.address);

      assert.equal(typeof slot1.totalScaledToken0InBins, "bigint");
      assert.equal(typeof slot1.totalScaledToken1InBins, "bigint");
    });

    it("should read single bin state with external units", async () => {
      const { pool, dataProvider, factory, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const binState = await sdk.getBinStateExternal(
        publicClient,
        dataProvider.address,
        pool.address,
        0,
        factory.address,
      );

      assert.equal(typeof binState.token0Balance, "bigint");
      assert.equal(typeof binState.token1Balance, "bigint");
      assert.equal(typeof binState.lengthE6, "number");
      assert.equal(typeof binState.addFeeBuyE6, "number");
      assert.equal(typeof binState.addFeeSellE6, "number");
    });

    it("should batch read multiple bins", async () => {
      const { pool, dataProvider, factory, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const binIndices = [-2, -1, 0, 1, 2];
      const binStates = await sdk.getBinStatesExternal(
        publicClient,
        dataProvider.address,
        pool.address,
        binIndices,
        factory.address,
      );

      assert.equal(binStates.token0Balances.length, binIndices.length);
      assert.equal(binStates.token1Balances.length, binIndices.length);
      assert.equal(binStates.lengthsInUnits.length, binIndices.length);
    });

    it("should read fee configuration from factory", async () => {
      const { pool, factory, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const feeConfig = await sdk.getPoolFeeConfig(publicClient, factory.address, pool.address);

      assert.equal(typeof feeConfig.protocolSpreadFeeE6, "number");
      assert.equal(typeof feeConfig.adminSpreadFeeE6, "number");
    });
  });

  describe("Position Management", () => {
    it("should add liquidity to a new position using prepared payload", async () => {
      const { pool, dataProvider, liquidityAdder, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const deltas: sdk.LiquidityDelta[] = [
        { bin: -1, deltaShares: 10_000_000n },
        { bin: 0, deltaShares: 20_000_000n },
        { bin: 1, deltaShares: 10_000_000n },
      ];

      const salt = 0n;

      // Use prepareModifyLiquidity
      const prepared = prepareModifyLiquidity(
        salt,
        deltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );

      assert.ok(
        encodePreparedModifyLiquidityAdd(pool.address, prepared).startsWith("0x"),
        "Should have valid calldata",
      );

      // Send transaction manually
      const hash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success");

      // Verify position shares were updated correctly
      for (const delta of deltas) {
        const shares = await sdk.getPositionBinSharesFromDataProvider(
          publicClient,
          dataProvider.address,
          pool.address,
          deployer.account.address,
          salt,
          delta.bin,
        );
        assert.equal(shares, delta.deltaShares, `Bin ${delta.bin} should have correct shares`);
      }
    });

    it("should verify position shares via DataProvider using prepared payload", async () => {
      const { pool, dataProvider, liquidityAdder, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const deltas: sdk.LiquidityDelta[] = [{ bin: 0, deltaShares: 20_000_000n }];
      const salt = 0n;

      // Use prepareModifyLiquidity
      const prepared = prepareModifyLiquidity(
        salt,
        deltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );

      const hash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared),
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const shares = await sdk.getPositionBinSharesFromDataProvider(
        publicClient,
        dataProvider.address,
        pool.address,
        deployer.account.address,
        salt,
        0,
      );

      assert.equal(shares, 20_000_000n);
    });
  });

  describe("Add Liquidity - Token Flow Verification", () => {
    it("should transfer exact amounts from user to pool when adding liquidity", async () => {
      const { pool, liquidityAdder, token0, token1, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const deltas: sdk.LiquidityDelta[] = [
        { bin: -2, deltaShares: 5_000_000n },
        { bin: -1, deltaShares: 10_000_000n },
        { bin: 0, deltaShares: 15_000_000n },
        { bin: 1, deltaShares: 10_000_000n },
        { bin: 2, deltaShares: 5_000_000n },
      ];

      const userToken0Before = (await token0.read.balanceOf([deployer.account.address])) as bigint;
      const userToken1Before = (await token1.read.balanceOf([deployer.account.address])) as bigint;
      const poolToken0Before = (await token0.read.balanceOf([pool.address])) as bigint;
      const poolToken1Before = (await token1.read.balanceOf([pool.address])) as bigint;

      const salt = 0n;
      // Use prepareModifyLiquidity
      const prepared = prepareModifyLiquidity(
        salt,
        deltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );

      const hash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared),
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const userToken0After = (await token0.read.balanceOf([deployer.account.address])) as bigint;
      const userToken1After = (await token1.read.balanceOf([deployer.account.address])) as bigint;
      const poolToken0After = (await token0.read.balanceOf([pool.address])) as bigint;
      const poolToken1After = (await token1.read.balanceOf([pool.address])) as bigint;

      const userToken0Spent = userToken0Before - userToken0After;
      const userToken1Spent = userToken1Before - userToken1After;
      const poolToken0Received = poolToken0After - poolToken0Before;
      const poolToken1Received = poolToken1After - poolToken1Before;

      assert.equal(
        userToken0Spent,
        poolToken0Received,
        "Token0: user spent should equal pool received",
      );
      assert.equal(
        userToken1Spent,
        poolToken1Received,
        "Token1: user spent should equal pool received",
      );

      assert.ok(userToken0Spent > 0n || userToken1Spent > 0n, "Should have spent some tokens");

      console.log("Add liquidity token flow:");
      console.log(`  User spent: ${userToken0Spent} token0, ${userToken1Spent} token1`);
      console.log(`  Pool received: ${poolToken0Received} token0, ${poolToken1Received} token1`);
    });

    it("should update position shares correctly for each bin when adding", async () => {
      const { pool, dataProvider, liquidityAdder, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const deltas: sdk.LiquidityDelta[] = [
        { bin: -2, deltaShares: 5_000_000n },
        { bin: -1, deltaShares: 10_000_000n },
        { bin: 0, deltaShares: 15_000_000n },
        { bin: 1, deltaShares: 10_000_000n },
        { bin: 2, deltaShares: 5_000_000n },
      ];

      const salt = 0n;
      // Use prepareModifyLiquidity
      const prepared = prepareModifyLiquidity(
        salt,
        deltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );

      const hash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared),
      });
      await publicClient.waitForTransactionReceipt({ hash });

      for (const delta of deltas) {
        const shares = await sdk.getPositionBinSharesFromDataProvider(
          publicClient,
          dataProvider.address,
          pool.address,
          deployer.account.address,
          salt,
          delta.bin,
        );

        assert.equal(
          shares,
          delta.deltaShares,
          `Bin ${delta.bin}: expected ${delta.deltaShares} shares, got ${shares}`,
        );
      }

      console.log("Position shares verified for all bins");
    });

    it("should allow multiple users to add liquidity to same bins", async () => {
      const { pool, dataProvider, liquidityAdder, token0, token1, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const [, user2] = await viem.getWalletClients();

      await token0.write.mint([user2.account.address, parseUnits("1000000", 18)]);
      await token1.write.mint([user2.account.address, parseUnits("1000000", 6)]);

      const token0User2 = getContract({
        address: token0.address,
        abi: MockERC20Artifact.abi,
        client: { public: publicClient, wallet: user2 },
      }) as any;
      const token1User2 = getContract({
        address: token1.address,
        abi: MockERC20Artifact.abi,
        client: { public: publicClient, wallet: user2 },
      }) as any;

      await token0User2.write.approve([liquidityAdder.address, parseUnits("1000000", 18)]);
      await token1User2.write.approve([liquidityAdder.address, parseUnits("1000000", 6)]);

      const deltas1: sdk.LiquidityDelta[] = [
        { bin: 0, deltaShares: 10_000_000n },
        { bin: 1, deltaShares: 10_000_000n },
      ];
      const salt1 = 0n;
      // Use prepareModifyLiquidity for user1
      const prepared1 = prepareModifyLiquidity(
        salt1,
        deltas1,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const hash1 = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared1),
      });
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const deltas2: sdk.LiquidityDelta[] = [
        { bin: 0, deltaShares: 20_000_000n },
        { bin: 1, deltaShares: 20_000_000n },
      ];
      const salt2 = 0n; // Different user, same salt is fine
      // Use prepareModifyLiquidity for user2
      const prepared2 = prepareModifyLiquidity(
        salt2,
        deltas2,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const hash2 = await user2.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared2),
      });
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const user1SharesBin0 = await sdk.getPositionBinSharesFromDataProvider(
        publicClient,
        dataProvider.address,
        pool.address,
        deployer.account.address,
        salt1,
        0,
      );
      assert.equal(user1SharesBin0, 10_000_000n, "User1 bin0 shares incorrect");

      const user2SharesBin0 = await sdk.getPositionBinSharesFromDataProvider(
        publicClient,
        dataProvider.address,
        pool.address,
        user2.account.address,
        salt2,
        0,
      );
      assert.equal(user2SharesBin0, 20_000_000n, "User2 bin0 shares incorrect");

      const totalSharesBin0 = await sdk.getBinTotalShares(
        publicClient,
        dataProvider.address,
        pool.address,
        0,
      );
      assert.equal(totalSharesBin0, 30_000_000n, "Total shares in bin0 incorrect");

      console.log("Multiple users liquidity verified:");
      console.log(`  User1 shares in bin0: ${user1SharesBin0}`);
      console.log(`  User2 shares in bin0: ${user2SharesBin0}`);
      console.log(`  Total shares in bin0: ${totalSharesBin0}`);
    });
  });

  describe("Remove Liquidity - Token Flow Verification", () => {
    it("should transfer exact amounts from pool to user when removing liquidity", async () => {
      const { pool, liquidityAdder, token0, token1, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const addDeltas: sdk.LiquidityDelta[] = [
        { bin: -1, deltaShares: 10_000_000n },
        { bin: 0, deltaShares: 20_000_000n },
        { bin: 1, deltaShares: 10_000_000n },
      ];

      const salt = 0n;
      const preparedAdd = prepareModifyLiquidity(
        salt,
        addDeltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const addHash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, preparedAdd),
      });
      await publicClient.waitForTransactionReceipt({ hash: addHash });

      const userToken0Before = (await token0.read.balanceOf([deployer.account.address])) as bigint;
      const userToken1Before = (await token1.read.balanceOf([deployer.account.address])) as bigint;
      const poolToken0Before = (await token0.read.balanceOf([pool.address])) as bigint;
      const poolToken1Before = (await token1.read.balanceOf([pool.address])) as bigint;

      const removeDeltas: sdk.LiquidityDelta[] = [
        { bin: -1, deltaShares: -5_000_000n },
        { bin: 0, deltaShares: -10_000_000n },
        { bin: 1, deltaShares: -5_000_000n },
      ];

      // Remove liquidity using prepareModifyLiquidity
      const preparedRemove = prepareModifyLiquidity(
        salt,
        removeDeltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const removeHash = await deployer.sendTransaction({
        to: pool.address,
        data: encodePreparedModifyLiquidityRemove(deployer.account.address, preparedRemove),
      });
      await publicClient.waitForTransactionReceipt({ hash: removeHash });

      const userToken0After = (await token0.read.balanceOf([deployer.account.address])) as bigint;
      const userToken1After = (await token1.read.balanceOf([deployer.account.address])) as bigint;
      const poolToken0After = (await token0.read.balanceOf([pool.address])) as bigint;
      const poolToken1After = (await token1.read.balanceOf([pool.address])) as bigint;

      const userToken0Received = userToken0After - userToken0Before;
      const userToken1Received = userToken1After - userToken1Before;
      const poolToken0Sent = poolToken0Before - poolToken0After;
      const poolToken1Sent = poolToken1Before - poolToken1After;

      assert.equal(
        poolToken0Sent,
        userToken0Received,
        "Token0: pool sent should equal user received",
      );
      assert.equal(
        poolToken1Sent,
        userToken1Received,
        "Token1: pool sent should equal user received",
      );

      assert.ok(
        userToken0Received > 0n || userToken1Received > 0n,
        "User should have received some tokens",
      );

      console.log("Remove liquidity token flow:");
      console.log(`  Pool sent: ${poolToken0Sent} token0, ${poolToken1Sent} token1`);
      console.log(`  User received: ${userToken0Received} token0, ${userToken1Received} token1`);
    });

    it("should update position shares correctly for each bin when removing", async () => {
      const { pool, dataProvider, liquidityAdder, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const addDeltas: sdk.LiquidityDelta[] = [
        { bin: -1, deltaShares: 10_000_000n },
        { bin: 0, deltaShares: 20_000_000n },
        { bin: 1, deltaShares: 10_000_000n },
      ];

      const salt = 0n;
      // Add liquidity using prepareModifyLiquidity
      const preparedAdd = prepareModifyLiquidity(
        salt,
        addDeltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const addHash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, preparedAdd),
      });
      await publicClient.waitForTransactionReceipt({ hash: addHash });

      for (const delta of addDeltas) {
        const sharesBefore = await sdk.getPositionBinSharesFromDataProvider(
          publicClient,
          dataProvider.address,
          pool.address,
          deployer.account.address,
          salt,
          delta.bin,
        );
        assert.equal(sharesBefore, delta.deltaShares, `Bin ${delta.bin} initial shares incorrect`);
      }

      const removeDeltas: sdk.LiquidityDelta[] = [
        { bin: -1, deltaShares: -3_000_000n },
        { bin: 0, deltaShares: -10_000_000n },
        { bin: 1, deltaShares: -5_000_000n },
      ];

      // Remove liquidity using prepareModifyLiquidity
      const preparedRemove = prepareModifyLiquidity(
        salt,
        removeDeltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const removeHash = await deployer.sendTransaction({
        to: pool.address,
        data: encodePreparedModifyLiquidityRemove(deployer.account.address, preparedRemove),
      });
      await publicClient.waitForTransactionReceipt({ hash: removeHash });

      const expectedShares = [
        { bin: -1, shares: 7_000_000n }, // 10_000_000 - 3_000_000
        { bin: 0, shares: 10_000_000n }, // 20_000_000 - 10_000_000
        { bin: 1, shares: 5_000_000n }, // 10_000_000 - 5_000_000
      ];

      for (const expected of expectedShares) {
        const sharesAfter = await sdk.getPositionBinSharesFromDataProvider(
          publicClient,
          dataProvider.address,
          pool.address,
          deployer.account.address,
          salt,
          expected.bin,
        );
        assert.equal(
          sharesAfter,
          expected.shares,
          `Bin ${expected.bin}: expected ${expected.shares} shares after removal, got ${sharesAfter}`,
        );
      }

      console.log("Position shares correctly updated after partial removal");
    });

    it("should allow full removal of liquidity", async () => {
      const { pool, dataProvider, liquidityAdder, token0, token1, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const addDeltas: sdk.LiquidityDelta[] = [
        { bin: 0, deltaShares: 20_000_000n },
        { bin: 1, deltaShares: 10_000_000n },
      ];

      const salt = 0n;
      // Add liquidity using prepareModifyLiquidity
      const preparedAdd = prepareModifyLiquidity(
        salt,
        addDeltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const addHash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, preparedAdd),
      });
      await publicClient.waitForTransactionReceipt({ hash: addHash });

      const poolToken0Before = (await token0.read.balanceOf([pool.address])) as bigint;
      const poolToken1Before = (await token1.read.balanceOf([pool.address])) as bigint;

      const removeDeltas: sdk.LiquidityDelta[] = [
        { bin: 0, deltaShares: -20_000_000n },
        { bin: 1, deltaShares: -10_000_000n },
      ];

      // Remove liquidity using prepareModifyLiquidity
      const preparedRemove = prepareModifyLiquidity(
        salt,
        removeDeltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const removeHash = await deployer.sendTransaction({
        to: pool.address,
        data: encodePreparedModifyLiquidityRemove(deployer.account.address, preparedRemove),
      });
      await publicClient.waitForTransactionReceipt({ hash: removeHash });

      for (const delta of addDeltas) {
        const sharesAfter = await sdk.getPositionBinSharesFromDataProvider(
          publicClient,
          dataProvider.address,
          pool.address,
          deployer.account.address,
          salt,
          delta.bin,
        );
        assert.equal(
          sharesAfter,
          0n,
          `Bin ${delta.bin}: expected 0 shares after full removal, got ${sharesAfter}`,
        );
      }

      const poolToken0After = (await token0.read.balanceOf([pool.address])) as bigint;
      const poolToken1After = (await token1.read.balanceOf([pool.address])) as bigint;

      assert.ok(
        poolToken0After < poolToken0Before || poolToken1After < poolToken1Before,
        "Pool should have less tokens after full removal",
      );

      console.log("Full liquidity removal successful:");
      console.log(`  Pool token0: ${poolToken0Before} -> ${poolToken0After}`);
      console.log(`  Pool token1: ${poolToken1Before} -> ${poolToken1After}`);
    });

    it("should preserve other users positions when one user removes", async () => {
      const { pool, dataProvider, liquidityAdder, token0, token1, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const [, user2] = await viem.getWalletClients();

      await token0.write.mint([user2.account.address, parseUnits("1000000", 18)]);
      await token1.write.mint([user2.account.address, parseUnits("1000000", 6)]);

      const token0User2 = getContract({
        address: token0.address,
        abi: MockERC20Artifact.abi,
        client: { public: publicClient, wallet: user2 },
      }) as any;
      const token1User2 = getContract({
        address: token1.address,
        abi: MockERC20Artifact.abi,
        client: { public: publicClient, wallet: user2 },
      }) as any;

      await token0User2.write.approve([liquidityAdder.address, parseUnits("1000000", 18)]);
      await token1User2.write.approve([liquidityAdder.address, parseUnits("1000000", 6)]);

      const salt1 = 0n;
      const salt2 = 0n;

      // User1 adds liquidity using prepareModifyLiquidity
      const prepared1 = prepareModifyLiquidity(
        salt1,
        [{ bin: 0, deltaShares: 10_000_000n }],
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const hash1 = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared1),
      });
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      // User2 adds liquidity using prepareModifyLiquidity
      const prepared2 = prepareModifyLiquidity(
        salt2,
        [{ bin: 0, deltaShares: 20_000_000n }],
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const hash2 = await user2.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared2),
      });
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      // User1 removes all their liquidity using prepareModifyLiquidity
      const preparedRemove = prepareModifyLiquidity(
        salt1,
        [{ bin: 0, deltaShares: -10_000_000n }],
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const removeHash = await deployer.sendTransaction({
        to: pool.address,
        data: encodePreparedModifyLiquidityRemove(deployer.account.address, preparedRemove),
      });
      await publicClient.waitForTransactionReceipt({ hash: removeHash });

      const user1SharesAfter = await sdk.getPositionBinSharesFromDataProvider(
        publicClient,
        dataProvider.address,
        pool.address,
        deployer.account.address,
        salt1,
        0,
      );
      assert.equal(user1SharesAfter, 0n, "User1 should have 0 shares");

      const user2SharesAfter = await sdk.getPositionBinSharesFromDataProvider(
        publicClient,
        dataProvider.address,
        pool.address,
        user2.account.address,
        salt2,
        0,
      );
      assert.equal(user2SharesAfter, 20_000_000n, "User2 shares should be preserved");

      console.log("Other user's position preserved after removal:");
      console.log(`  User1 shares: ${user1SharesAfter}`);
      console.log(`  User2 shares: ${user2SharesAfter}`);
    });
  });

  describe("Swaps", () => {
    it("should execute exact input swap via SDK calldata", async () => {
      const { env, pool, simpleRouter, liquidityAdder, token1, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      // Add liquidity first - need consecutive bins with sufficient liquidity
      const deltas: sdk.LiquidityDelta[] = [];
      // Pool has 10 bins per side: negative -10..-1, non-negative 0..9 (bin 10 is invalid)
      for (let bin = -10; bin <= 9; bin++) {
        deltas.push({ bin, deltaShares: 10000000n });
      }

      const salt = 0n;
      const prepared = prepareModifyLiquidity(
        salt,
        deltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const addHash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared),
      });
      await publicClient.waitForTransactionReceipt({ hash: addHash });

      await token1.write.approve([simpleRouter.address, parseUnits("1000000", 6)]);

      const amountIn = parseUnits("1", 6);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const swapData = sdk.encodeExactInputSingleCalldata(
        buildExactInputSingleTestParams(env, pool.address, {
          recipient: deployer.account.address,
          zeroForOne: false,
          amountIn,
          deadline,
          priceLimitX64: 0xffffffffffffffffffffffffffffffffn,
        }),
      );
      const hash = await deployer.sendTransaction({
        to: simpleRouter.address,
        data: swapData,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success");
    });

    it("should verify pool state changed after swap via SDK calldata", async () => {
      const { env, pool, simpleRouter, dataProvider, liquidityAdder, token1, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      // Add liquidity - need consecutive bins with sufficient liquidity
      const deltas: sdk.LiquidityDelta[] = [];
      for (let bin = -10; bin <= 9; bin++) {
        deltas.push({ bin, deltaShares: 10000000n });
      }
      const salt = 0n;
      const prepared = prepareModifyLiquidity(
        salt,
        deltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const addHash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared),
      });
      await publicClient.waitForTransactionReceipt({ hash: addHash });

      await token1.write.approve([simpleRouter.address, parseUnits("1000000", 6)]);

      const slot0Before = await sdk.getSlot0(publicClient, dataProvider.address, pool.address);

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const swapData = sdk.encodeExactInputSingleCalldata(
        buildExactInputSingleTestParams(env, pool.address, {
          recipient: deployer.account.address,
          zeroForOne: false,
          amountIn: parseUnits("100", 6),
          deadline,
          priceLimitX64: 0xffffffffffffffffffffffffffffffffn,
        }),
      );
      await deployer.sendTransaction({
        to: simpleRouter.address,
        data: swapData,
      });

      // Read state after
      const slot0After = await sdk.getSlot0(publicClient, dataProvider.address, pool.address);

      // Position should have changed - either bin index or position within bin
      const positionChanged =
        slot0After.curBinIdx !== slot0Before.curBinIdx ||
        slot0After.curPosInBin !== slot0Before.curPosInBin;
      assert.ok(positionChanged, "Pool state should have changed after swap");
    });
  });

  describe("Utility Functions", () => {
    it("should pack and unpack bin data correctly", () => {
      const original: sdk.BinData = {
        lengthE6: 10000,
        addFeeBuyE6: 500,
        addFeeSellE6: 300,
      };

      const packed = sdk.packBinData(original);
      const unpacked = sdk.unpackBinData(packed);

      assert.equal(unpacked.lengthE6, original.lengthE6);
      assert.equal(unpacked.addFeeBuyE6, original.addFeeBuyE6);
      assert.equal(unpacked.addFeeSellE6, original.addFeeSellE6);
    });

    it("should convert price to Q64 format and back", () => {
      const price = 1.5;
      const q64Price = sdk.priceToQ64(price);

      assert.ok(q64Price > 0n);

      const backToPrice = sdk.q64ToPrice(q64Price);
      assert.ok(Math.abs(backToPrice - price) < 0.0001);
    });
  });

  describe("Uniform Liquidity Distribution", () => {
    it("should calculate uniform distribution and successfully add liquidity", async () => {
      const { pool, factory, dataProvider, liquidityAdder, token0, token1, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const logPoolBalances = async (label: string) => {
        const b0 = await token0.read.balanceOf([pool.address]);
        const b1 = await token1.read.balanceOf([pool.address]);
        console.log(`${label} pool balances: token0=${b0}, token1=${b1}`);
      };

      // Define parameters for uniform distribution
      const params: sdk.CalculateUniformLiquidityParams = {
        amountInTokensPerBin: parseUnits("1", 18), // 1 token0 per bin target
        amountIsInToken0: true,
        currentPrice: 1.0, // 1:1 price ratio
        lowerBin: -5,
        upperBin: 4,
      };

      // Calculate uniform distribution
      const result = await buildModifyLiquidityArgsForUniformAdditionPlan(
        publicClient,
        factory.address,
        dataProvider.address,
        pool.address,
        params,
      );

      // Debug: inspect share magnitudes before minting
      const maxDeltaShares = result.deltas.reduce(
        (max, d) => (d.deltaShares > max ? d.deltaShares : max),
        0n,
      );
      console.log("Uniform distribution share stats:");
      console.log(`  bins: ${result.deltas.length}`);
      console.log(`  max deltaShares: ${maxDeltaShares}`);
      console.log(`  specAmount0: ${result.specAmount0}`);
      console.log(`  specAmount1: ${result.specAmount1}`);

      for (const delta of result.deltas) {
        console.log(`  Bin ${delta.bin}: ${delta.deltaShares} shares`);
      }

      // Verify we got deltas for the expected bins
      assert.ok(result.deltas.length > 0, "Should have calculated some deltas");
      assert.ok(result.deltas.length <= 11, "Should not exceed bin range");

      // Verify specAmounts are positive and within a reasonable bound
      assert.ok(result.specAmount0 > 0n, "specAmount0 should be positive");
      assert.ok(result.specAmount1 > 0n, "specAmount1 should be positive");

      // Get balances before
      const token0BalanceBefore = (await token0.read.balanceOf([
        deployer.account.address,
      ])) as bigint;
      const token1BalanceBefore = (await token1.read.balanceOf([
        deployer.account.address,
      ])) as bigint;

      // Execute modifyLiquidity with calculated deltas and specAmounts using prepareModifyLiquidity
      const salt = 0n;
      const prepared = prepareModifyLiquidity(
        salt,
        result.deltas,
        result.specAmount0,
        result.specAmount1,
      );

      const hash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      await logPoolBalances("After uniform mint");

      // Get balances after
      const token0BalanceAfter = (await token0.read.balanceOf([
        deployer.account.address,
      ])) as bigint;
      const token1BalanceAfter = (await token1.read.balanceOf([
        deployer.account.address,
      ])) as bigint;

      // Calculate actual amounts spent
      const token0Spent = token0BalanceBefore - token0BalanceAfter;
      const token1Spent = token1BalanceBefore - token1BalanceAfter;

      // Verify amounts spent are within specAmounts
      assert.ok(
        token0Spent <= result.specAmount0,
        `token0Spent (${token0Spent}) should be <= specAmount0 (${result.specAmount0})`,
      );
      assert.ok(
        token1Spent <= result.specAmount1,
        `token1Spent (${token1Spent}) should be <= specAmount1 (${result.specAmount1})`,
      );

      // Verify we actually spent some tokens
      assert.ok(token0Spent > 0n || token1Spent > 0n, "Should have spent some tokens");

      console.log(`Uniform distribution test results:`);
      console.log(
        `  Bins: ${params.lowerBin} to ${params.upperBin} (${result.deltas.length} deltas)`,
      );
      console.log(`  Spec amounts: ${result.specAmount0} token0, ${result.specAmount1} token1`);
      console.log(`  Actual spent: ${token0Spent} token0, ${token1Spent} token1`);
    });

    it("should handle distribution when one token is limiting", async () => {
      const { pool, factory, dataProvider, liquidityAdder, token0, token1, publicClient } =
        await networkHelpers.loadFixture(setupTestEnvironment);

      const logPoolBalances = async (label: string) => {
        const b0 = await token0.read.balanceOf([pool.address]);
        const b1 = await token1.read.balanceOf([pool.address]);
        console.log(`${label} pool balances: token0=${b0}, token1=${b1}`);
      };

      // First add some liquidity to move the current bin position
      const initialDeltas: sdk.LiquidityDelta[] = [{ bin: 0, deltaShares: 1000000n }];
      const salt1 = 0n;
      // Use prepareModifyLiquidity
      const preparedInit = prepareModifyLiquidity(
        salt1,
        initialDeltas,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      );
      const initHash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, preparedInit),
      });
      await publicClient.waitForTransactionReceipt({ hash: initHash });

      await logPoolBalances("After initial seed mint");

      // Now test with asymmetric amounts (token0 is limiting)
      const params: sdk.CalculateUniformLiquidityParams = {
        amountInTokensPerBin: parseUnits("0.5", 18), // 0.5 token0 per bin target
        amountIsInToken0: true,
        currentPrice: 1.0,
        lowerBin: -3,
        upperBin: 3,
      };

      const result = await buildModifyLiquidityArgsForUniformAdditionPlan(
        publicClient,
        factory.address,
        dataProvider.address,
        pool.address,
        params,
      );

      // Debug: inspect share magnitudes before minting
      const maxDeltaShares = result.deltas.reduce(
        (max, d) => (d.deltaShares > max ? d.deltaShares : max),
        0n,
      );
      console.log("Limiting token share stats:");
      console.log(`  bins: ${result.deltas.length}`);
      console.log(`  max deltaShares: ${maxDeltaShares}`);
      console.log(`  specAmount0: ${result.specAmount0}`);
      console.log(`  specAmount1: ${result.specAmount1}`);

      // Execute with new salt using prepareModifyLiquidity
      const salt2 = 1n;
      const prepared = prepareModifyLiquidity(
        salt2,
        result.deltas,
        result.specAmount0,
        result.specAmount1,
      );
      const hash = await deployer.sendTransaction({
        to: liquidityAdder.address,
        data: encodePreparedModifyLiquidityAdd(pool.address, prepared),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      await logPoolBalances("After limiting-token mint");

      console.log(`Limiting token test results:`);
      console.log(`  Spec amounts: ${result.specAmount0} token0, ${result.specAmount1} token1`);
      console.log(`  Token0 should be close to max, token1 should be lower`);
    });
  });

  async function setupDiverseBinsPool() {
    const env = await deployMetricTestEnv(viem, deployer);
    const { publicClient, dataProvider } = env;

    const nonNegativeBinData: sdk.BinData[] = [
      { lengthE6: 5000, addFeeBuyE6: 0, addFeeSellE6: 0 }, // bin 0: 0.5%
      { lengthE6: 10000, addFeeBuyE6: 500, addFeeSellE6: 300 }, // bin 1: 1% with fees
      { lengthE6: 15000, addFeeBuyE6: 1000, addFeeSellE6: 800 }, // bin 2: 1.5% with higher fees
      { lengthE6: 20000, addFeeBuyE6: 0, addFeeSellE6: 0 }, // bin 3: 2%
      { lengthE6: 25000, addFeeBuyE6: 2000, addFeeSellE6: 1500 }, // bin 4: 2.5% with fees
      { lengthE6: 30000, addFeeBuyE6: 100, addFeeSellE6: 50 }, // bin 5: 3%
      { lengthE6: 8000, addFeeBuyE6: 0, addFeeSellE6: 0 }, // bin 6: 0.8%
      { lengthE6: 12000, addFeeBuyE6: 600, addFeeSellE6: 400 }, // bin 7: 1.2% with fees
      { lengthE6: 18000, addFeeBuyE6: 0, addFeeSellE6: 0 }, // bin 8: 1.8%
      { lengthE6: 22000, addFeeBuyE6: 1200, addFeeSellE6: 900 }, // bin 9: 2.2% with fees
    ];

    const negativeBinData: sdk.BinData[] = [
      { lengthE6: 7000, addFeeBuyE6: 0, addFeeSellE6: 0 }, // bin -1: 0.7%
      { lengthE6: 11000, addFeeBuyE6: 400, addFeeSellE6: 200 }, // bin -2: 1.1% with fees
      { lengthE6: 16000, addFeeBuyE6: 900, addFeeSellE6: 700 }, // bin -3: 1.6%
      { lengthE6: 21000, addFeeBuyE6: 0, addFeeSellE6: 0 }, // bin -4: 2.1%
      { lengthE6: 26000, addFeeBuyE6: 1800, addFeeSellE6: 1300 }, // bin -5: 2.6% with fees
      { lengthE6: 9000, addFeeBuyE6: 0, addFeeSellE6: 0 }, // bin -6: 0.9%
      { lengthE6: 13000, addFeeBuyE6: 700, addFeeSellE6: 500 }, // bin -7: 1.3%
      { lengthE6: 19000, addFeeBuyE6: 0, addFeeSellE6: 0 }, // bin -8: 1.9%
    ];

    const packedPositive = sdk.createBins(nonNegativeBinData);
    const packedNegative = sdk.createBins(negativeBinData);

    const poolAddress = await createPoolViaFactory(env, deployer, {
      nonNegativeBins: packedPositive,
      negativeBins: packedNegative,
      adminSpreadFeeE6: 0,
      adminNotionalFeeE8: 0,
    });

    return {
      publicClient,
      dataProvider,
      factory: env.factory,
      poolAddress,
      nonNegativeBinData,
      negativeBinData,
    };
  }

  describe("Pool Creation with Diverse Bins", () => {
    it("should create pool with many different bins and verify allocation", async () => {
      const {
        publicClient,
        dataProvider,
        factory,
        poolAddress,
        nonNegativeBinData,
        negativeBinData,
      } = await networkHelpers.loadFixture(setupDiverseBinsPool);
      const dataProviderAddress = dataProvider.address as Address;
      const factoryAddress = factory.address as Address;

      console.log("\nVerifying non-negative bins...");
      for (let i = 0; i < nonNegativeBinData.length; i++) {
        const expectedBin = nonNegativeBinData[i];
        const binState = await sdk.getBinStateExternal(
          publicClient,
          dataProviderAddress,
          poolAddress,
          i,
          factoryAddress,
        );

        assert.equal(binState.lengthE6, expectedBin.lengthE6, `Bin ${i}: lengthE6 mismatch`);
        assert.equal(
          binState.addFeeBuyE6,
          expectedBin.addFeeBuyE6,
          `Bin ${i}: addFeeBuyE6 mismatch`,
        );
        assert.equal(
          binState.addFeeSellE6,
          expectedBin.addFeeSellE6,
          `Bin ${i}: addFeeSellE6 mismatch`,
        );
      }
      for (let i = 0; i < negativeBinData.length; i++) {
        const binIndex = -(i + 1);
        const expectedBin = negativeBinData[i];
        const binState = await sdk.getBinStateExternal(
          publicClient,
          dataProviderAddress,
          poolAddress,
          binIndex,
          factoryAddress,
        );

        assert.equal(binState.lengthE6, expectedBin.lengthE6, `Bin ${binIndex}: lengthE6 mismatch`);
        assert.equal(
          binState.addFeeBuyE6,
          expectedBin.addFeeBuyE6,
          `Bin ${binIndex}: addFeeBuyE6 mismatch`,
        );
        assert.equal(
          binState.addFeeSellE6,
          expectedBin.addFeeSellE6,
          `Bin ${binIndex}: addFeeSellE6 mismatch`,
        );
      }

      const allBinIndices = [
        ...Array.from({ length: nonNegativeBinData.length }, (_, i) => i),
        ...Array.from({ length: negativeBinData.length }, (_, i) => -(i + 1)),
      ];

      const batchResult = await sdk.getBinStatesExternal(
        publicClient,
        dataProviderAddress,
        poolAddress,
        allBinIndices,
        factoryAddress,
      );

      assert.equal(
        batchResult.lengthsInUnits.length,
        nonNegativeBinData.length + negativeBinData.length,
        "Batch read should return all bins",
      );

      // Verify a few random bins from batch
      for (let i = 0; i < 3; i++) {
        const randomIdx = Math.floor(Math.random() * allBinIndices.length);
        const binIndex = allBinIndices[randomIdx];
        const isNegative = binIndex < 0;
        const expectedBin = isNegative
          ? negativeBinData[-binIndex - 1]
          : nonNegativeBinData[binIndex];

        assert.equal(
          batchResult.lengthsInUnits[randomIdx],
          expectedBin.lengthE6,
          `Batch bin ${binIndex}: lengthE6 mismatch`,
        );
        assert.equal(
          batchResult.addFeeBuysE6[randomIdx],
          expectedBin.addFeeBuyE6,
          `Batch bin ${binIndex}: addFeeBuyE6 mismatch`,
        );
        assert.equal(
          batchResult.addFeeSellsE6[randomIdx],
          expectedBin.addFeeSellE6,
          `Batch bin ${binIndex}: addFeeSellE6 mismatch`,
        );
      }
    });
  });
});
