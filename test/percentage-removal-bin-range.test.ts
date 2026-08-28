/**
 * Regression: buildModifyLiquidityArgsForPercentageRemoval must discover the pool's *actual*
 * configured bin range when lowerBin/upperBin/bins are omitted, not a fixed guess — a pool with
 * a wider range than the guess would otherwise silently leave far bins un-removed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits } from "viem";
import * as sdk from "../src/index.js";
import {
  approveTokensForLiquidityAdder,
  createPoolViaFactory,
  deployMetricTestEnv,
} from "./shared/testEnv.js";

describe("buildModifyLiquidityArgsForPercentageRemoval default bin range", () => {
  it("discovers a position far outside the old hardcoded [-10, 10] default", async () => {
    const { viem } = await network.connect();
    const [deployer] = await viem.getWalletClients();

    const env = await deployMetricTestEnv(viem, deployer);
    const max0 = parseUnits("1000000", 18);
    const max1 = parseUnits("1000000", 6);
    await approveTokensForLiquidityAdder(env, deployer, max0, max1);

    // Pool configured with a wider range than the old hardcoded [-10, 10] scan default.
    const pool = await createPoolViaFactory(env, deployer, {
      nonNegativeBins: sdk.createUniformBins(20, 10_000),
      negativeBins: sdk.createUniformBins(20, 10_000),
    });

    const immutables = await sdk.getPoolImmutables(env.publicClient, env.factory.address, pool);
    assert.ok(immutables.highestBin > 10, "pool range must exceed the old hardcoded default");

    const salt = 0n;
    const farBin = 15; // outside the old hardcoded [-10, 10] default, inside the pool's real range
    const deltas: sdk.PoolLiquidityDelta = {
      binIdxs: [0n, BigInt(farBin)],
      shares: [10_000_000n, 5_000_000n],
    };

    const addHash = await deployer.sendTransaction({
      to: env.liquidityAdder.address,
      data: sdk.encodeAddLiquidityExactSharesSelfCalldata({
        pool,
        salt,
        deltas,
        maxAmountToken0: sdk.NO_SLIPPAGE_LIMIT,
        maxAmountToken1: sdk.NO_SLIPPAGE_LIMIT,
      }),
    });
    await env.publicClient.waitForTransactionReceipt({ hash: addHash });

    const [, removalDeltas] = await sdk.buildModifyLiquidityArgsForPercentageRemoval({
      publicClient: env.publicClient,
      dataProviderAddress: env.dataProvider.address,
      poolAddress: pool,
      owner: deployer.account.address,
      salt,
      percentageToRemove: 100,
    });

    const removedBins = removalDeltas.map((d) => d.bin).sort((a, b) => a - b);
    assert.deepEqual(removedBins, [0, farBin]);

    // Execute the removal and confirm the far bin is actually emptied on-chain, not just planned.
    const removeHash = await deployer.sendTransaction({
      to: pool,
      data: sdk.encodeRemoveLiquidityCalldata({
        owner: deployer.account.address,
        salt,
        deltas: sdk.removalPlanToPoolLiquidityDelta(removalDeltas),
      }),
    });
    await env.publicClient.waitForTransactionReceipt({ hash: removeHash });

    const remaining = await sdk.getPositionSharesForBins(
      env.publicClient,
      env.dataProvider.address,
      pool,
      deployer.account.address,
      salt,
      [0, farBin],
    );
    assert.equal(remaining.length, 0, "both bins should be fully emptied, including the far one");
  });
});
