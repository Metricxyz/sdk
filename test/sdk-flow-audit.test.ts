/**
 * End-to-end audit: SDK calldata + on-chain execution for create pool, add/remove liquidity, swap.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { encodeFunctionData, parseUnits } from "viem";
import * as sdk from "../src/index.js";
import { MetricOmmPoolFactoryAbi, MetricOmmSimpleRouterAbi } from "../src/abis/index.js";
import {
  encodeAddLiquidityCalldata,
  encodeRemoveLiquidityCalldataFromDeltas,
} from "./shared/liquidityTx.js";
import { getPoolAddressFromCreateReceipt } from "./shared/getPoolAddressFromCreateReceipt.js";
import { deployMetricTestEnv, buildExactInputSingleTestParams } from "./shared/testEnv.js";

describe("SDK v1 flow audit (on-chain)", async () => {
  const { viem } = (await network.connect("hardhat")) as any;
  const [deployer] = await viem.getWalletClients();

  it("create pool → add liquidity → swap → remove liquidity via SDK encoders", async () => {
    const env = await deployMetricTestEnv(viem, deployer);
    const { publicClient, token0, token1, factory, liquidityAdder, simpleRouter } = env;

    const max0 = parseUnits("1000000", 18);
    const max1 = parseUnits("1000000", 6);
    await token0.write.mint([deployer.account.address, max0]);
    await token1.write.mint([deployer.account.address, max1]);
    await token0.write.approve([liquidityAdder.address, max0]);
    await token1.write.approve([liquidityAdder.address, max1]);
    await token0.write.approve([simpleRouter.address, max0]);
    await token1.write.approve([simpleRouter.address, max1]);

    // --- Create pool (SDK encodeCreatePoolCalldata → factory) ---
    const fixedSalt = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    const createParams: sdk.CreatePoolFactoryParams = {
      token0: token0.address,
      token1: token1.address,
      priceProvider: env.priceProvider.address,
      admin: deployer.account.address,
      adminFeeDestination: deployer.account.address,
      adminSpreadFeeE6: 5000,
      adminNotionalFeeE8: 0,
      protocolSpreadFeeE6: 0,
      protocolNotionalFeeE8: 0,
      bidAskRefAsymmetryX8: 65_535,
      curBinDistFromProvidedPricePercent: 0,
      initialScaledAmount0PerE18Shares: parseUnits("1", 18),
      initialScaledAmount1PerE18Shares: parseUnits("1", 18),
      minimalOperationalLiquidity: 1_000_000n,
      nonNegativeBins: sdk.createUniformBins(10, 10_000),
      negativeBins: sdk.createUniformBins(10, 10_000),
      salt: fixedSalt,
    };

    const prepared = sdk.prepareFactoryCreatePoolParams(createParams);
    const directCreate = encodeFunctionData({
      abi: MetricOmmPoolFactoryAbi,
      functionName: "createPool",
      args: [prepared],
    });
    const sdkCreate = sdk.encodeCreatePoolCalldata(createParams);
    assert.equal(sdkCreate, directCreate, "createPool calldata must match factory ABI");

    const createHash = await deployer.sendTransaction({
      to: factory.address,
      data: sdkCreate,
    });
    const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
    assert.equal(createReceipt.status, "success");
    const poolAddress = getPoolAddressFromCreateReceipt(createReceipt.logs);

    const slot0Empty = await sdk.getSlot0(publicClient, env.dataProvider.address, poolAddress);
    assert.equal(slot0Empty.pauseLevel, 0);

    // --- Add liquidity (SDK → LiquidityAdder) ---
    const salt = 42n;
    const addDeltas: sdk.LiquidityDelta[] = [];
    for (let bin = -5; bin <= 5; bin++) {
      addDeltas.push({ bin, deltaShares: 10_000_000n });
    }
    const addArgs: sdk.ModifyLiquidityArgs = [
      salt,
      addDeltas,
      sdk.NO_SLIPPAGE_LIMIT,
      sdk.NO_SLIPPAGE_LIMIT,
    ];
    const addCalldata = encodeAddLiquidityCalldata(poolAddress, addArgs);
    const directAdd = sdk.encodeAddLiquidityExactSharesSelfCalldata({
      pool: poolAddress,
      salt,
      deltas: sdk.additionPlanToPoolLiquidityDelta(addDeltas),
      maxAmountToken0: sdk.NO_SLIPPAGE_LIMIT,
      maxAmountToken1: sdk.NO_SLIPPAGE_LIMIT,
    });
    assert.equal(addCalldata, directAdd);

    const addHash = await deployer.sendTransaction({
      to: liquidityAdder.address,
      data: addCalldata,
    });
    const addReceipt = await publicClient.waitForTransactionReceipt({ hash: addHash });
    assert.equal(addReceipt.status, "success");

    const sharesBin0 = await sdk.getPositionBinSharesFromDataProvider(
      publicClient,
      env.dataProvider.address,
      poolAddress,
      deployer.account.address,
      salt,
      0,
    );
    assert.equal(sharesBin0, 10_000_000n);

    const slot1AfterAdd = await sdk.getSlot1(publicClient, env.dataProvider.address, poolAddress);
    assert.ok(
      slot1AfterAdd.totalScaledToken0InBins > 0n || slot1AfterAdd.totalScaledToken1InBins > 0n,
      "pool should hold liquidity after add",
    );

    // --- Swap (SDK → SimpleRouter) ---
    const slot0BeforeSwap = await sdk.getSlot0(publicClient, env.dataProvider.address, poolAddress);
    const amountIn = parseUnits("1", 6);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const swapParams = buildExactInputSingleTestParams(env, poolAddress, {
      recipient: deployer.account.address,
      zeroForOne: false,
      amountIn,
      deadline,
      priceLimitX64: sdk.MAX_UINT128,
    });
    const swapCalldata = sdk.prepareExactInputSingleCalldata(swapParams);
    const directSwap = encodeFunctionData({
      abi: MetricOmmSimpleRouterAbi,
      functionName: "exactInputSingle",
      args: [
        {
          pool: swapParams.pool,
          tokenIn: swapParams.tokenIn,
          tokenOut: swapParams.tokenOut,
          zeroForOne: swapParams.zeroForOne,
          amountIn: swapParams.amountIn,
          amountOutMinimum: swapParams.amountOutMinimum,
          recipient: swapParams.recipient,
          deadline: swapParams.deadline,
          priceLimitX64: swapParams.priceLimitX64,
          extensionData: "0x",
        },
      ],
    });
    assert.equal(swapCalldata, directSwap);

    const swapHash = await simpleRouter.write.exactInputSingle([
      {
        pool: swapParams.pool,
        tokenIn: swapParams.tokenIn,
        tokenOut: swapParams.tokenOut,
        zeroForOne: swapParams.zeroForOne,
        amountIn: swapParams.amountIn,
        amountOutMinimum: swapParams.amountOutMinimum,
        recipient: swapParams.recipient,
        deadline: swapParams.deadline,
        priceLimitX64: swapParams.priceLimitX64,
        extensionData: "0x",
      },
    ]);
    const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
    assert.equal(swapReceipt.status, "success");

    const slot0AfterSwap = await sdk.getSlot0(publicClient, env.dataProvider.address, poolAddress);
    const moved =
      slot0AfterSwap.curBinIdx !== slot0BeforeSwap.curBinIdx ||
      slot0AfterSwap.curPosInBin !== slot0BeforeSwap.curPosInBin;
    assert.ok(moved, "swap should move pool position");

    // --- Remove liquidity (SDK → pool.removeLiquidity) ---
    const removeDeltas: sdk.LiquidityDelta[] = [{ bin: 0, deltaShares: -5_000_000n }];
    const removeCalldata = encodeRemoveLiquidityCalldataFromDeltas(
      deployer.account.address,
      salt,
      removeDeltas,
    );
    const directRemove = sdk.encodeRemoveLiquidityCalldata({
      owner: deployer.account.address,
      salt,
      deltas: sdk.removalPlanToPoolLiquidityDelta(removeDeltas),
    });
    assert.equal(removeCalldata, directRemove);

    const removeHash = await deployer.sendTransaction({
      to: poolAddress,
      data: removeCalldata,
    });
    const removeReceipt = await publicClient.waitForTransactionReceipt({ hash: removeHash });
    assert.equal(removeReceipt.status, "success");

    const sharesAfterRemove = await sdk.getPositionBinSharesFromDataProvider(
      publicClient,
      env.dataProvider.address,
      poolAddress,
      deployer.account.address,
      salt,
      0,
    );
    assert.equal(sharesAfterRemove, 5_000_000n);
  });

  it("createPool() simulation returns a pool address", async () => {
    const env = await deployMetricTestEnv(viem, deployer);
    const params: sdk.CreatePoolFactoryParams = {
      token0: env.token0.address,
      token1: env.token1.address,
      priceProvider: env.priceProvider.address,
      admin: deployer.account.address,
      adminFeeDestination: deployer.account.address,
      adminSpreadFeeE6: 0,
      adminNotionalFeeE8: 0,
      protocolSpreadFeeE6: 0,
      protocolNotionalFeeE8: 0,
      bidAskRefAsymmetryX8: 65_535,
      curBinDistFromProvidedPricePercent: 0,
      initialScaledAmount0PerE18Shares: parseUnits("1", 18),
      initialScaledAmount1PerE18Shares: parseUnits("1", 18),
      minimalOperationalLiquidity: 1_000_000n,
      nonNegativeBins: sdk.createUniformBins(5, 10_000),
      negativeBins: sdk.createUniformBins(5, 10_000),
    };

    const { hash, poolAddress } = await sdk.createPool(
      env.publicClient,
      deployer,
      env.factory.address,
      params,
      deployer.account.address,
    );
    assert.ok(hash.startsWith("0x"));
    assert.ok(poolAddress, "simulateContract should return pool address");
  });
});
