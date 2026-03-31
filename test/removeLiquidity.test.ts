import { describe, it } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import { parseUnits } from "viem";
import * as sdk from "../index.js";
import { getPoolAddressFromCreateReceipt } from "./shared/getPoolAddressFromCreateReceipt.js";

describe("SDK Remove Liquidity", async () => {
  const { viem, networkHelpers } = (await network.connect("hardhat")) as any;
  const [deployer] = await viem.getWalletClients();

  async function deployFixture() {
    const publicClient = await viem.getPublicClient();

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

    const priceProvider = await viem.deployContract("MockOracle", []);
    const midPriceX64 = sdk.priceToQ64(1);
    await priceProvider.write.setBidAndAskPrice([midPriceX64, midPriceX64]);

    const defaultProtocolFee = 100_000;
    const factory = await viem.deployContract("MetricOmmPoolFactory", [
      deployer.account.address,
      defaultProtocolFee,
    ]);
    const poolDeployer = await viem.deployContract("MetricOmmPoolDeployer", [
      factory.address,
    ]);
    await factory.write.setPoolDeployer([poolDeployer.address]);

    const stateView = await viem.deployContract("MetricOmmPoolStateView", []);

    const params: sdk.CreatePoolFactoryParams = {
      token0: token0.address,
      token1: token1.address,
      priceProvider: priceProvider.address,
      reportSwapToPriceProvider: false,
      admin: deployer.account.address,
      adminFeeDestination: deployer.account.address,
      adminFeePercent: 0.5,
      maxDriftPercent: 5,
      driftDecayPerSecondPercent: 0.1,
      curBinDistFromProvidedPricePercent: 0,
      initialScaledToken0PerShareE18: parseUnits("1", 18),
      initialScaledToken1PerShareE18: parseUnits("1", 18),
      minimalMintableLiquidity: 1000n,
      nonNegativeBins: sdk.createUniformBins(10, 10000),
      negativeBins: sdk.createUniformBins(10, 10000),
    };

    // Create pool using calldata
    const createPoolCalldata = sdk.encodeCreatePoolCalldata(params);
    const createHash = await deployer.sendTransaction({
      to: factory.address,
      data: createPoolCalldata,
    });
    const createReceipt = await publicClient.waitForTransactionReceipt({
      hash: createHash,
    });

    const poolAddress = getPoolAddressFromCreateReceipt(createReceipt.logs);

    return {
      publicClient,
      token0,
      token1,
      priceProvider,
      factory,
      stateView,
      poolAddress,
    };
  }

  async function addLiquidityToPosition(
    env: Awaited<ReturnType<typeof deployFixture>>,
    bins: number[],
    sharesPerBin: bigint,
    salt: bigint = 0n,
  ) {
    const { publicClient, token0, token1, poolAddress } = env;

    const mintAmount0 = parseUnits("1000", 18);
    const mintAmount1 = parseUnits("1000", 6);
    await token0.write.mint([deployer.account.address, mintAmount0]);
    await token1.write.mint([deployer.account.address, mintAmount1]);
    await token0.write.approve([poolAddress, mintAmount0]);
    await token1.write.approve([poolAddress, mintAmount1]);

    const deltas: sdk.LiquidityDelta[] = bins.map((bin) => ({
      bin,
      deltaShares: sharesPerBin,
    }));

    const modifyLiquidityArgs: sdk.ModifyLiquidityArgs = [
      salt,
      deltas,
      sdk.NO_SLIPPAGE_LIMIT,
      sdk.NO_SLIPPAGE_LIMIT,
    ];

    const hash = await deployer.sendTransaction({
      to: poolAddress,
      data: sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs),
    });
    await publicClient.waitForTransactionReceipt({ hash });

    return salt;
  }

  describe("getPositionShares", () => {
    it("should return shares for bins with liquidity", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [-2, -1, 0, 1, 2];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      const positionShares = await sdk.getPositionShares(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        -10,
        10,
      );

      assert.equal(
        positionShares.length,
        bins.length,
        `Should have ${bins.length} bins with shares`,
      );

      for (const { binIdx, shares } of positionShares) {
        assert.ok(
          bins.includes(binIdx),
          `Bin ${binIdx} should be in original bins`,
        );
        assert.ok(shares > 0n, `Bin ${binIdx} should have positive shares`);
      }

      console.log(
        "Position shares:",
        positionShares.map((p) => ({
          bin: p.binIdx,
          shares: p.shares.toString(),
        })),
      );
    });

    it("should return empty array for position with no liquidity in range", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [5, 6, 7];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      const positionShares = await sdk.getPositionShares(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        -5,
        4,
      );

      assert.equal(
        positionShares.length,
        0,
        "Should have no shares in range [-5, 4]",
      );
    });
  });

  describe("buildModifyLiquidityArgsForPercentageRemoval", () => {
    it("should prepare deltas to remove 50% of liquidity", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [-1, 0, 1];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      const [, deltas, specAmount0, specAmount1] =
        await sdk.buildModifyLiquidityArgsForPercentageRemoval({
          publicClient,
          stateViewAddress: stateView.address,
          poolAddress,
          owner: deployer.account.address,
          salt,
          percentageToRemove: 50,
        });

      assert.equal(
        deltas.length,
        bins.length,
        "Should have delta for each bin",
      );
      assert.equal(specAmount0, sdk.NO_SLIPPAGE_LIMIT);
      assert.equal(specAmount1, sdk.NO_SLIPPAGE_LIMIT);

      for (const delta of deltas) {
        assert.ok(
          delta.deltaShares < 0n,
          "deltaShares should be negative for removal",
        );
      }

      console.log(
        "Remove 50% deltas:",
        deltas.map((d) => ({
          bin: d.bin,
          deltaShares: d.deltaShares.toString(),
        })),
      );
    });

    it("should prepare deltas to remove 100% of liquidity", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [-1, 0, 1];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      const sharesBefore = await sdk.getPositionShares(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        -10,
        10,
      );

      const [, deltas] = await sdk.buildModifyLiquidityArgsForPercentageRemoval({
        publicClient,
        stateViewAddress: stateView.address,
        poolAddress,
        owner: deployer.account.address,
        salt,
        percentageToRemove: 100,
      });

      assert.equal(
        deltas.length,
        bins.length,
        "Should have delta for each bin",
      );

      for (const delta of deltas) {
        const originalShares = sharesBefore.find(
          (s) => s.binIdx === delta.bin,
        )?.shares;
        assert.ok(
          originalShares,
          `Should find original shares for bin ${delta.bin}`,
        );
        assert.equal(
          delta.deltaShares,
          -originalShares!,
          `Should remove all shares from bin ${delta.bin}`,
        );
      }
    });

    it("should throw error for invalid percentage", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const salt = 0n;
      await addLiquidityToPosition(env, [0], parseUnits("100", 18), salt);

      await assert.rejects(
        () =>
          sdk.buildModifyLiquidityArgsForPercentageRemoval({
            publicClient,
            stateViewAddress: stateView.address,
            poolAddress,
            owner: deployer.account.address,
            salt,
            percentageToRemove: 0,
          }),
        /percentageToRemove must be between 0 and 100/,
      );

      await assert.rejects(
        () =>
          sdk.buildModifyLiquidityArgsForPercentageRemoval({
            publicClient,
            stateViewAddress: stateView.address,
            poolAddress,
            owner: deployer.account.address,
            salt,
            percentageToRemove: 101,
          }),
        /percentageToRemove must be between 0 and 100/,
      );
    });
  });

  describe("removeLiquidity using buildModifyLiquidityArgsForPercentageRemoval", () => {
    it("should remove 50% of liquidity using prepared payload", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [-1, 0, 1];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      const sharesBefore = await sdk.getPositionShares(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        -10,
        10,
      );

      // Use buildModifyLiquidityArgsForPercentageRemoval
      const modifyLiquidityArgs = await sdk.buildModifyLiquidityArgsForPercentageRemoval({
        publicClient,
        stateViewAddress: stateView.address,
        poolAddress,
        owner: deployer.account.address,
        salt,
        percentageToRemove: 50,
      });

      assert.ok(modifyLiquidityArgs[1].length > 0, "Should return deltas");
      assert.ok(
        sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs).startsWith("0x"),
        "Should have valid calldata",
      );

      // Send transaction using encoded payload
      const hash = await deployer.sendTransaction({
        to: poolAddress,
        data: sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      const sharesAfter = await sdk.getPositionShares(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        -10,
        10,
      );

      assert.equal(
        sharesAfter.length,
        sharesBefore.length,
        "Should still have same number of bins",
      );

      for (const after of sharesAfter) {
        const before = sharesBefore.find((b) => b.binIdx === after.binIdx);
        assert.ok(before, `Should find before shares for bin ${after.binIdx}`);

        const expectedRemaining = before!.shares / 2n;
        const tolerance = before!.shares / 100n;

        assert.ok(
          after.shares >= expectedRemaining - tolerance &&
            after.shares <= expectedRemaining + tolerance,
          `Bin ${after.binIdx}: expected ~${expectedRemaining}, got ${after.shares}`,
        );
      }

      console.log("Removed 50% liquidity, hash:", hash);
    });

    it("should remove 100% of liquidity using prepared payload", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [-1, 0, 1];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      // Use buildModifyLiquidityArgsForPercentageRemoval
      const modifyLiquidityArgs = await sdk.buildModifyLiquidityArgsForPercentageRemoval({
        publicClient,
        stateViewAddress: stateView.address,
        poolAddress,
        owner: deployer.account.address,
        salt,
        percentageToRemove: 100,
      });

      assert.ok(modifyLiquidityArgs[1].length > 0, "Should return deltas");

      // Send transaction using encoded payload
      const hash = await deployer.sendTransaction({
        to: poolAddress,
        data: sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      const sharesAfter = await sdk.getPositionShares(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        -10,
        10,
      );

      assert.equal(sharesAfter.length, 0, "Should have no remaining shares");

      console.log("Removed 100% liquidity, hash:", hash);
    });

    it("should return null when no liquidity found in range", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [5, 6, 7];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      // buildModifyLiquidityArgsForPercentageRemoval returns empty deltas when no liquidity is found
      const modifyLiquidityArgs =
        await sdk.buildModifyLiquidityArgsForPercentageRemoval({
          publicClient,
          stateViewAddress: stateView.address,
          poolAddress,
          owner: deployer.account.address,
          salt,
          percentageToRemove: 100,
          lowerBin: -5,
          upperBin: 4,
        });

      assert.equal(
        modifyLiquidityArgs[1].length,
        0,
        "Should return empty deltas when no liquidity found in range",
      );
    });

    it("should remove liquidity with custom bin range using prepared payload", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [-5, -4, 0, 4, 5];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      // Use buildModifyLiquidityArgsForPercentageRemoval with custom bin range
      const modifyLiquidityArgs =
        await sdk.buildModifyLiquidityArgsForPercentageRemoval({
          publicClient,
          stateViewAddress: stateView.address,
          poolAddress,
          owner: deployer.account.address,
          salt,
          percentageToRemove: 100,
          lowerBin: -3,
          upperBin: 3,
        });

      assert.ok(modifyLiquidityArgs[1].length > 0, "Should return deltas");

      // Send transaction using encoded payload
      const hash = await deployer.sendTransaction({
        to: poolAddress,
        data: sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      const sharesAfter = await sdk.getPositionShares(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        -10,
        10,
      );

      assert.equal(
        sharesAfter.length,
        4,
        "Should have 4 bins remaining (outside custom range)",
      );

      const remainingBins = sharesAfter
        .map((s) => s.binIdx)
        .sort((a, b) => a - b);
      assert.deepEqual(
        remainingBins,
        [-5, -4, 4, 5],
        "Should have bins outside [-3, 3] remaining",
      );

      console.log(
        "Removed liquidity from bins [-3, 3], remaining bins:",
        remainingBins,
      );
    });
  });

  describe("non-contiguous bins", () => {
    it("should add and query liquidity in non-contiguous bins", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      // Add liquidity to non-contiguous bins: -3, 1, 2
      const nonContiguousBins = [-3, 1, 2];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, nonContiguousBins, sharesPerBin, salt);

      // Query using getPositionSharesForBins (specific bins)
      const shares = await sdk.getPositionSharesForBins(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        nonContiguousBins,
      );

      assert.equal(shares.length, 3, "Should have 3 bins with shares");
      const binIndices = shares.map((s) => s.binIdx).sort((a, b) => a - b);
      assert.deepEqual(binIndices, [-3, 1, 2], "Should match requested bins");

      for (const { shares: s } of shares) {
        assert.equal(s, sharesPerBin, "Each bin should have correct shares");
      }
    });

    it("should remove liquidity from specific non-contiguous bins using bins param", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      // Add liquidity to bins -3, -1, 0, 1, 2
      const allBins = [-3, -1, 0, 1, 2];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, allBins, sharesPerBin, salt);

      // Remove 100% from only bins -3, 1, 2 (non-contiguous)
      const modifyLiquidityArgs =
        await sdk.buildModifyLiquidityArgsForPercentageRemoval({
          publicClient,
          stateViewAddress: stateView.address,
          poolAddress,
          owner: deployer.account.address,
          salt,
          percentageToRemove: 100,
          bins: [-3, 1, 2],
        });

      assert.ok(modifyLiquidityArgs[1].length > 0, "Should return deltas");

      const hash = await deployer.sendTransaction({
        to: poolAddress,
        data: sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      // Verify: bins -1 and 0 should still have liquidity
      const sharesAfter = await sdk.getPositionShares(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        -10,
        10,
      );

      assert.equal(sharesAfter.length, 2, "Should have 2 bins remaining");
      const remainingBins = sharesAfter
        .map((s) => s.binIdx)
        .sort((a, b) => a - b);
      assert.deepEqual(
        remainingBins,
        [-1, 0],
        "Only bins -1 and 0 should remain",
      );
    });

    it("should remove 50% from specific non-contiguous bins", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const allBins = [-3, -1, 0, 1, 2];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, allBins, sharesPerBin, salt);

      // Remove 50% from bins -3 and 2 only
      const modifyLiquidityArgs =
        await sdk.buildModifyLiquidityArgsForPercentageRemoval({
          publicClient,
          stateViewAddress: stateView.address,
          poolAddress,
          owner: deployer.account.address,
          salt,
          percentageToRemove: 50,
          bins: [-3, 2],
        });

      assert.ok(modifyLiquidityArgs[1].length > 0, "Should return deltas");

      const hash = await deployer.sendTransaction({
        to: poolAddress,
        data: sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      // Verify: bins -3 and 2 should have ~50% remaining, others unchanged
      const sharesAfter = await sdk.getPositionSharesForBins(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        allBins,
      );

      assert.equal(sharesAfter.length, 5, "All 5 bins should still exist");

      for (const { binIdx, shares } of sharesAfter) {
        if (binIdx === -3 || binIdx === 2) {
          // These should have ~50% remaining
          const expected = sharesPerBin / 2n;
          const tolerance = sharesPerBin / 100n;
          assert.ok(
            shares >= expected - tolerance && shares <= expected + tolerance,
            `Bin ${binIdx}: expected ~${expected}, got ${shares}`,
          );
        } else {
          // These should be unchanged
          assert.equal(
            shares,
            sharesPerBin,
            `Bin ${binIdx} should be unchanged`,
          );
        }
      }
    });
  });

  describe("buildModifyLiquidityArgsForRemoval", () => {
    it("should remove different percentages from different bins", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const allBins = [-3, -1, 0, 1, 2];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, allBins, sharesPerBin, salt);

      // Remove 100% from bin -3, 50% from bin 1, leave others untouched
      const modifyLiquidityArgs = await sdk.buildModifyLiquidityArgsForRemoval({
        publicClient,
        stateViewAddress: stateView.address,
        poolAddress,
        owner: deployer.account.address,
        salt,
        specs: [
          { bin: -3, percentageToRemove: 100 },
          { bin: 1, percentageToRemove: 50 },
        ],
      });

      const deltas = modifyLiquidityArgs[1];

      assert.equal(deltas.length, 2, "Should have 2 deltas");

      const hash = await deployer.sendTransaction({
        to: poolAddress,
        data: sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      const sharesAfter = await sdk.getPositionSharesForBins(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        allBins,
      );

      // Bin -3 should be fully removed
      const bin3 = sharesAfter.find((s) => s.binIdx === -3);
      assert.equal(bin3, undefined, "Bin -3 should have no shares");

      // Bin 1 should have ~50%
      const bin1 = sharesAfter.find((s) => s.binIdx === 1);
      assert.ok(bin1, "Bin 1 should still have shares");
      const expected50 = sharesPerBin / 2n;
      const tolerance = sharesPerBin / 100n;
      assert.ok(
        bin1!.shares >= expected50 - tolerance &&
          bin1!.shares <= expected50 + tolerance,
        `Bin 1: expected ~${expected50}, got ${bin1!.shares}`,
      );

      // Bins -1, 0, 2 should be unchanged
      for (const b of [-1, 0, 2]) {
        const entry = sharesAfter.find((s) => s.binIdx === b);
        assert.ok(entry, `Bin ${b} should still exist`);
        assert.equal(
          entry!.shares,
          sharesPerBin,
          `Bin ${b} should be unchanged`,
        );
      }
    });

    it("should remove absolute shares from specific bins", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const allBins = [0, 1, 2];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, allBins, sharesPerBin, salt);

      const sharesToRemove = parseUnits("30", 18);

      const modifyLiquidityArgs = await sdk.buildModifyLiquidityArgsForRemoval({
        publicClient,
        stateViewAddress: stateView.address,
        poolAddress,
        owner: deployer.account.address,
        salt,
        specs: [
          { bin: 0, sharesToRemove },
          { bin: 2, sharesToRemove },
        ],
      });

      const deltas = modifyLiquidityArgs[1];

      assert.equal(deltas.length, 2, "Should have 2 deltas");
      for (const d of deltas) {
        assert.equal(
          d.deltaShares,
          -sharesToRemove,
          `Bin ${d.bin} should remove exactly ${sharesToRemove}`,
        );
      }

      const hash = await deployer.sendTransaction({
        to: poolAddress,
        data: sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success", "Transaction should succeed");

      const sharesAfter = await sdk.getPositionSharesForBins(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        allBins,
      );

      const expectedRemaining = sharesPerBin - sharesToRemove;
      for (const { binIdx, shares } of sharesAfter) {
        if (binIdx === 1) {
          assert.equal(shares, sharesPerBin, "Bin 1 should be unchanged");
        } else {
          assert.equal(
            shares,
            expectedRemaining,
            `Bin ${binIdx} should have ${expectedRemaining}`,
          );
        }
      }
    });
  });
});
