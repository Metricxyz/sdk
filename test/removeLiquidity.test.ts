import { describe, it } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import { parseUnits } from "viem";
import * as sdk from "../index.js";
import { getPoolAddressFromCreateReceipt } from "./shared/getPoolAddressFromCreateReceipt.js";
import { getPoolCreationCode } from "./shared/poolCreationCode.js";

describe("SDK Remove Liquidity", async () => {
  const { viem, networkHelpers } = (await network.connect("hardhat")) as any;
  const [deployer] = await viem.getWalletClients();

  async function deployFixture() {
    const publicClient = await viem.getPublicClient();
    const { poolCreationCode, poolCreationCodeHash } =
      await getPoolCreationCode();

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
      poolCreationCodeHash,
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
      initialToken0PerShare: parseUnits("1", 18),
      initialToken1PerShare: parseUnits("1", 18),
      minimalMintableLiquidity: 1000n,
      nonNegativeBins: sdk.createUniformBins(10, 10000),
      negativeBins: sdk.createUniformBins(10, 10000),
      poolCreationCode,
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

    // Use prepareModifyLiquidityCalldata
    const prepared = sdk.prepareModifyLiquidityCalldata(
      poolAddress,
      salt,
      deltas,
      sdk.NO_SLIPPAGE_LIMIT,
      sdk.NO_SLIPPAGE_LIMIT,
    );

    const hash = await deployer.sendTransaction({
      to: prepared.to,
      data: prepared.data,
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

  describe("prepareRemoveLiquidityDeltas", () => {
    it("should prepare deltas to remove 50% of liquidity", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [-1, 0, 1];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      const deltas = await sdk.prepareRemoveLiquidityDeltas(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        { percentageToRemove: 50 },
      );

      assert.equal(
        deltas.length,
        bins.length,
        "Should have delta for each bin",
      );

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

      const deltas = await sdk.prepareRemoveLiquidityDeltas(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        { percentageToRemove: 100 },
      );

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
          sdk.prepareRemoveLiquidityDeltas(
            publicClient,
            stateView.address,
            poolAddress,
            deployer.account.address,
            salt,
            { percentageToRemove: 0 },
          ),
        /percentageToRemove must be between 0 and 100/,
      );

      await assert.rejects(
        () =>
          sdk.prepareRemoveLiquidityDeltas(
            publicClient,
            stateView.address,
            poolAddress,
            deployer.account.address,
            salt,
            { percentageToRemove: 101 },
          ),
        /percentageToRemove must be between 0 and 100/,
      );
    });
  });

  describe("removeLiquidity using prepareRemoveLiquidityCalldata", () => {
    it("should remove 50% of liquidity using prepared calldata", async () => {
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

      // Use prepareRemoveLiquidityCalldata
      const prepared = await sdk.prepareRemoveLiquidityCalldata(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        { percentageToRemove: 50 },
      );

      assert.ok(prepared, "Should return prepared calldata");
      assert.ok(prepared!.to, "Should have target address");
      assert.ok(prepared!.data.startsWith("0x"), "Should have valid calldata");

      // Send transaction using prepared calldata
      const hash = await deployer.sendTransaction({
        to: prepared!.to,
        data: prepared!.data,
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

    it("should remove 100% of liquidity using prepared calldata", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [-1, 0, 1];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      // Use prepareRemoveLiquidityCalldata
      const prepared = await sdk.prepareRemoveLiquidityCalldata(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        { percentageToRemove: 100 },
      );

      assert.ok(prepared, "Should return prepared calldata");

      // Send transaction using prepared calldata
      const hash = await deployer.sendTransaction({
        to: prepared!.to,
        data: prepared!.data,
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

      // prepareRemoveLiquidityCalldata returns null when no liquidity is found
      const prepared = await sdk.prepareRemoveLiquidityCalldata(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        { percentageToRemove: 100, lowerBin: -5, upperBin: 4 },
      );

      assert.equal(
        prepared,
        null,
        "Should return null when no liquidity found in range",
      );
    });

    it("should remove liquidity with custom bin range using prepared calldata", async () => {
      const env = await networkHelpers.loadFixture(deployFixture);
      const { publicClient, stateView, poolAddress } = env;

      const bins = [-5, -4, 0, 4, 5];
      const sharesPerBin = parseUnits("100", 18);
      const salt = 0n;
      await addLiquidityToPosition(env, bins, sharesPerBin, salt);

      // Use prepareRemoveLiquidityCalldata with custom bin range
      const prepared = await sdk.prepareRemoveLiquidityCalldata(
        publicClient,
        stateView.address,
        poolAddress,
        deployer.account.address,
        salt,
        { percentageToRemove: 100, lowerBin: -3, upperBin: 3 },
      );

      assert.ok(prepared, "Should return prepared calldata");

      // Send transaction using prepared calldata
      const hash = await deployer.sendTransaction({
        to: prepared!.to,
        data: prepared!.data,
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
});
