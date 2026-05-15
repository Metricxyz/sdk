import { describe, it } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import { parseUnits } from "viem";
import * as sdk from "../index.js";
import { getPoolAddressFromCreateReceipt } from "./shared/getPoolAddressFromCreateReceipt.js";

describe("SDK modifyLiquidity using prepared payload encoding", async () => {
  const { viem } = (await network.connect("hardhat")) as any;
  const [deployer] = await viem.getWalletClients();

  it("should add liquidity to a position using prepared payload", async () => {
    const publicClient = await viem.getPublicClient();

    const token0 = await viem.deployContract("MockERC20", ["Token 0", "TKN0", 18]);
    const token1 = await viem.deployContract("MockERC20", ["Token 1", "TKN1", 6]);

    const priceProvider = await viem.deployContract("MockOracle", []);
    const midPriceX64 = sdk.priceToQ64(1);
    await priceProvider.write.setBidAndAskPrice([midPriceX64, midPriceX64]);

    const defaultProtocolFee = 100_000; // 10%
    const factory = await viem.deployContract("MetricOmmPoolFactory", [
      deployer.account.address,
      defaultProtocolFee,
    ]);
    const deployer_contract = await viem.deployContract("MetricOmmPoolDeployer", [factory.address]);
    await factory.write.setPoolDeployer([deployer_contract.address]);

    const stateView = await viem.deployContract("MetricOmmPoolStateView", []);

    // Create pool using calldata
    const poolParams: sdk.CreatePoolFactoryParams = {
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

    const createPoolCalldata = sdk.encodeCreatePoolCalldata(poolParams);
    const createHash = await deployer.sendTransaction({
      to: factory.address,
      data: createPoolCalldata,
    });
    const createReceipt = await publicClient.waitForTransactionReceipt({
      hash: createHash,
    });
    assert.equal(createReceipt.status, "success", "Pool creation should succeed");

    const poolAddress = getPoolAddressFromCreateReceipt(createReceipt.logs);

    const mintAmount0 = parseUnits("1000", 18);
    const mintAmount1 = parseUnits("1000", 6);
    await token0.write.mint([deployer.account.address, mintAmount0]);
    await token1.write.mint([deployer.account.address, mintAmount1]);

    // Approve pool directly
    await token0.write.approve([poolAddress, mintAmount0]);
    await token1.write.approve([poolAddress, mintAmount1]);

    const deltas: sdk.LiquidityDelta[] = [
      { bin: 0, deltaShares: parseUnits("100", 18) },
      { bin: 1, deltaShares: parseUnits("100", 18) },
      { bin: -1, deltaShares: parseUnits("100", 18) },
    ];

    const salt = 0n;

    // Build a prepared modifyLiquidity payload
    const modifyLiquidityArgs: sdk.ModifyLiquidityArgs = [
      salt,
      deltas,
      sdk.NO_SLIPPAGE_LIMIT,
      sdk.NO_SLIPPAGE_LIMIT,
    ];
    const calldata = sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs);

    // Verify encoded payload is valid
    assert.ok(calldata.startsWith("0x"), "Should have valid calldata");

    // Send transaction manually using encoded payload
    const hash = await deployer.sendTransaction({
      to: poolAddress,
      data: calldata,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success", "Transaction should succeed");

    console.log("Added liquidity via prepared payload:");
    console.log("  Transaction hash:", hash);

    // Verify position shares via StateView
    const positionShares = await sdk.getPositionShares(
      publicClient,
      stateView.address,
      poolAddress,
      deployer.account.address,
      salt,
      -10,
      10,
    );

    assert.equal(positionShares.length, 3, "Should have 3 bins with shares");

    // Verify each bin has the expected shares
    for (const delta of deltas) {
      const binShares = positionShares.find((p) => p.binIdx === delta.bin);
      assert.ok(binShares, `Should have shares in bin ${delta.bin}`);
      assert.equal(
        binShares!.shares,
        delta.deltaShares,
        `Bin ${delta.bin} should have correct shares`,
      );
    }

    console.log(
      "Position shares:",
      positionShares.map((p) => ({
        bin: p.binIdx,
        shares: p.shares.toString(),
      })),
    );

    // Add more liquidity to the same position (same salt)
    await token0.write.mint([deployer.account.address, mintAmount0]);
    await token1.write.mint([deployer.account.address, mintAmount1]);
    await token0.write.approve([poolAddress, mintAmount0]);
    await token1.write.approve([poolAddress, mintAmount1]);

    // Build second add-liquidity payload
    const modifyLiquidityArgs2: sdk.ModifyLiquidityArgs = [
      salt, // Same salt = same position
      deltas,
      sdk.NO_SLIPPAGE_LIMIT,
      sdk.NO_SLIPPAGE_LIMIT,
    ];
    const calldata2 = sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs2);

    const hash2 = await deployer.sendTransaction({
      to: poolAddress,
      data: calldata2,
    });

    const receipt2 = await publicClient.waitForTransactionReceipt({
      hash: hash2,
    });
    assert.equal(receipt2.status, "success", "Second transaction should succeed");

    // Verify shares doubled
    const positionSharesAfter = await sdk.getPositionShares(
      publicClient,
      stateView.address,
      poolAddress,
      deployer.account.address,
      salt,
      -10,
      10,
    );

    for (const shareAfter of positionSharesAfter) {
      const shareBefore = positionShares.find((s) => s.binIdx === shareAfter.binIdx);
      assert.ok(shareBefore, `Should find shares for bin ${shareAfter.binIdx}`);
      assert.equal(
        shareAfter.shares,
        shareBefore!.shares * 2n,
        `Shares in bin ${shareAfter.binIdx} should have doubled`,
      );
    }

    console.log("Added more liquidity to same position (salt=0)");
    console.log(
      "Position shares after:",
      positionSharesAfter.map((p) => ({
        bin: p.binIdx,
        shares: p.shares.toString(),
      })),
    );
  });

  it("should create separate positions with different salts using prepared payload", async () => {
    const publicClient = await viem.getPublicClient();

    const token0 = await viem.deployContract("MockERC20", ["Token 0", "TKN0", 18]);
    const token1 = await viem.deployContract("MockERC20", ["Token 1", "TKN1", 6]);

    const priceProvider = await viem.deployContract("MockOracle", []);
    const midPriceX64 = sdk.priceToQ64(1);
    await priceProvider.write.setBidAndAskPrice([midPriceX64, midPriceX64]);

    const defaultProtocolFee = 100_000;
    const factory = await viem.deployContract("MetricOmmPoolFactory", [
      deployer.account.address,
      defaultProtocolFee,
    ]);
    const deployer_contract = await viem.deployContract("MetricOmmPoolDeployer", [factory.address]);
    await factory.write.setPoolDeployer([deployer_contract.address]);

    const stateView = await viem.deployContract("MetricOmmPoolStateView", []);

    // Create pool using calldata
    const poolParams: sdk.CreatePoolFactoryParams = {
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

    const createPoolCalldata = sdk.encodeCreatePoolCalldata(poolParams);
    const createHash = await deployer.sendTransaction({
      to: factory.address,
      data: createPoolCalldata,
    });
    const createReceipt = await publicClient.waitForTransactionReceipt({
      hash: createHash,
    });
    const poolAddress = getPoolAddressFromCreateReceipt(createReceipt.logs);

    const mintAmount0 = parseUnits("2000", 18);
    const mintAmount1 = parseUnits("2000", 6);
    await token0.write.mint([deployer.account.address, mintAmount0]);
    await token1.write.mint([deployer.account.address, mintAmount1]);
    await token0.write.approve([poolAddress, mintAmount0]);
    await token1.write.approve([poolAddress, mintAmount1]);

    // Create position with salt=1 using prepared payload
    const deltas1: sdk.LiquidityDelta[] = [{ bin: 0, deltaShares: parseUnits("100", 18) }];

    const modifyLiquidityArgs1: sdk.ModifyLiquidityArgs = [
      1n, // salt = 1
      deltas1,
      sdk.NO_SLIPPAGE_LIMIT,
      sdk.NO_SLIPPAGE_LIMIT,
    ];
    const calldata1 = sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs1);

    const hash1 = await deployer.sendTransaction({
      to: poolAddress,
      data: calldata1,
    });
    const receipt1 = await publicClient.waitForTransactionReceipt({
      hash: hash1,
    });
    assert.equal(receipt1.status, "success", "First position creation should succeed");

    // Create position with salt=2 using prepared payload
    const deltas2: sdk.LiquidityDelta[] = [{ bin: 1, deltaShares: parseUnits("200", 18) }];

    const modifyLiquidityArgs2: sdk.ModifyLiquidityArgs = [
      2n, // salt = 2
      deltas2,
      sdk.NO_SLIPPAGE_LIMIT,
      sdk.NO_SLIPPAGE_LIMIT,
    ];
    const calldata2 = sdk.encodeModifyLiquidityCalldata(modifyLiquidityArgs2);

    const hash2 = await deployer.sendTransaction({
      to: poolAddress,
      data: calldata2,
    });
    const receipt2 = await publicClient.waitForTransactionReceipt({
      hash: hash2,
    });
    assert.equal(receipt2.status, "success", "Second position creation should succeed");

    // Verify position 1 (salt=1)
    const position1Shares = await sdk.getPositionShares(
      publicClient,
      stateView.address,
      poolAddress,
      deployer.account.address,
      1n,
      -10,
      10,
    );

    assert.equal(position1Shares.length, 1, "Position 1 should have 1 bin");
    assert.equal(position1Shares[0].binIdx, 0, "Position 1 should be in bin 0");
    assert.equal(
      position1Shares[0].shares,
      parseUnits("100", 18),
      "Position 1 should have correct shares",
    );

    // Verify position 2 (salt=2)
    const position2Shares = await sdk.getPositionShares(
      publicClient,
      stateView.address,
      poolAddress,
      deployer.account.address,
      2n,
      -10,
      10,
    );

    assert.equal(position2Shares.length, 1, "Position 2 should have 1 bin");
    assert.equal(position2Shares[0].binIdx, 1, "Position 2 should be in bin 1");
    assert.equal(
      position2Shares[0].shares,
      parseUnits("200", 18),
      "Position 2 should have correct shares",
    );

    console.log("Created two separate positions with different salts");
    console.log("Position 1 (salt=1):", position1Shares);
    console.log("Position 2 (salt=2):", position2Shares);
  });
});
