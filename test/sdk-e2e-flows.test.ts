/**
 * End-to-end audit: create pool → add liquidity → swap → remove liquidity
 * using only v1 SDK calldata encoders against deployed contracts.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { encodeFunctionData, maxUint128, parseUnits } from "viem";
import { MetricOmmPoolFactoryAbi } from "../src/abis/MetricOmmPoolFactory.js";
import { MetricOmmPoolLiquidityAdderAbi } from "../src/abis/MetricOmmPoolLiquidityAdder.js";
import { MetricOmmSimpleRouterAbi } from "../src/abis/MetricOmmSimpleRouter.js";
import * as sdk from "../src/index.js";
import { getPoolAddressFromCreateReceipt } from "./shared/getPoolAddressFromCreateReceipt.js";
import {
  approveTokensForLiquidityAdder,
  approveTokensForSimpleRouter,
  buildExactInputSingleTestParams,
  createPoolViaFactory,
  deployMetricTestEnv,
} from "./shared/testEnv.js";

describe("SDK v1 E2E flows (calldata audit)", async () => {
  const { viem } = (await network.connect("hardhat")) as any;
  const [deployer] = await viem.getWalletClients();

  it("createPool calldata matches factory ABI and deploys", async () => {
    const env = await deployMetricTestEnv(viem, deployer);
    const fixedSalt = "0x000000000000000000000000000000000000000000000000000000000000c0de" as const;
    const params: sdk.CreatePoolFactoryParams = {
      token0: env.token0.address,
      token1: env.token1.address,
      priceProvider: env.priceProvider.address,
      admin: deployer.account.address,
      adminFeeDestination: deployer.account.address,
      adminSpreadFeeE6: 5000,
      adminNotionalFeeE8: 0,
      curBinDistFromProvidedPricePercent: 0,
      initialScaledToken0PerShareE18: parseUnits("1", 18),
      initialScaledToken1PerShareE18: parseUnits("1", 18),
      minimalOperationalLiquidity: 1_000_000n,
      nonNegativeBins: sdk.createUniformBins(10, 10_000),
      negativeBins: sdk.createUniformBins(10, 10_000),
      salt: fixedSalt,
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
    const pool = getPoolAddressFromCreateReceipt(receipt.logs);
    assert.ok(pool.startsWith("0x"));
  });

  it("full flow: create → add → swap → remove via SDK encoders", async () => {
    const env = await deployMetricTestEnv(viem, deployer);
    const max0 = parseUnits("1000000", 18);
    const max1 = parseUnits("1000000", 6);
    await approveTokensForLiquidityAdder(env, deployer, max0, max1);
    await approveTokensForSimpleRouter(env, deployer, max0, max1);

    const pool = await createPoolViaFactory(env, deployer);

    const salt = 1n;
    const addDeltas: sdk.PoolLiquidityDelta = {
      binIdxs: [-2n, -1n, 0n, 1n, 2n],
      shares: [5_000_000n, 5_000_000n, 10_000_000n, 5_000_000n, 5_000_000n],
    };
    const addData = sdk.encodeAddLiquidityExactSharesSelfCalldata({
      pool,
      salt,
      deltas: addDeltas,
      maxAmountToken0: sdk.NO_SLIPPAGE_LIMIT,
      maxAmountToken1: sdk.NO_SLIPPAGE_LIMIT,
    });
    const addDirect = encodeFunctionData({
      abi: MetricOmmPoolLiquidityAdderAbi,
      functionName: "addLiquidityExactShares",
      args: [
        pool,
        salt,
        { binIdxs: [...addDeltas.binIdxs], shares: [...addDeltas.shares] },
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS,
        "0x",
      ],
    });
    assert.equal(addData, addDirect);

    const addHash = await deployer.sendTransaction({
      to: env.liquidityAdder.address,
      data: addData,
    });
    assert.equal(
      (await env.publicClient.waitForTransactionReceipt({ hash: addHash })).status,
      "success",
    );

    const sharesBefore = await sdk.getPositionBinSharesFromDataProvider(
      env.publicClient,
      env.dataProvider.address,
      pool,
      deployer.account.address,
      salt,
      0,
    );
    assert.ok(sharesBefore > 0n);

    const slot0Before = await sdk.getSlot0(env.publicClient, env.dataProvider.address, pool);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const swapParams = buildExactInputSingleTestParams(env, pool, {
      recipient: deployer.account.address,
      zeroForOne: false,
      amountIn: parseUnits("10", 6),
      priceLimitX64: maxUint128,
      deadline,
    });
    const swapData = sdk.encodeExactInputSingleCalldata(swapParams);
    const swapDirect = encodeFunctionData({
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
    assert.equal(swapData, swapDirect);

    const swapHash = await deployer.sendTransaction({
      to: env.simpleRouter.address,
      data: swapData,
    });
    assert.equal(
      (await env.publicClient.waitForTransactionReceipt({ hash: swapHash })).status,
      "success",
    );

    const slot0After = await sdk.getSlot0(env.publicClient, env.dataProvider.address, pool);
    const positionMoved =
      slot0After.curBinIdx !== slot0Before.curBinIdx ||
      slot0After.curPosInBin !== slot0Before.curPosInBin;
    assert.ok(positionMoved, "swap should move pool position");

    const removeDeltas: sdk.PoolLiquidityDelta = {
      binIdxs: [0n],
      shares: [2_000_000n],
    };
    const removeData = sdk.encodeRemoveLiquidityCalldata({
      owner: deployer.account.address,
      salt,
      deltas: removeDeltas,
    });
    const removeHash = await deployer.sendTransaction({
      to: pool,
      data: removeData,
    });
    assert.equal(
      (await env.publicClient.waitForTransactionReceipt({ hash: removeHash })).status,
      "success",
    );

    const sharesAfter = await sdk.getPositionBinSharesFromDataProvider(
      env.publicClient,
      env.dataProvider.address,
      pool,
      deployer.account.address,
      salt,
      0,
    );
    assert.equal(sharesAfter, sharesBefore - 2_000_000n);
  });

  it("createPool() helper simulates and returns pool address", async () => {
    const env = await deployMetricTestEnv(viem, deployer);
    const params: sdk.CreatePoolFactoryParams = {
      token0: env.token0.address,
      token1: env.token1.address,
      priceProvider: env.priceProvider.address,
      admin: deployer.account.address,
      adminFeeDestination: deployer.account.address,
      adminSpreadFeeE6: 5000,
      adminNotionalFeeE8: 0,
      curBinDistFromProvidedPricePercent: 0,
      initialScaledToken0PerShareE18: parseUnits("1", 18),
      initialScaledToken1PerShareE18: parseUnits("1", 18),
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
    assert.ok(poolAddress?.startsWith("0x"));
  });
});
