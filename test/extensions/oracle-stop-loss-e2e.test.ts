/**
 * OracleValueStopLossExtension E2E on a Hardhat local chain.
 *
 * 1) Create pool with stop-loss on afterSwap, add liquidity, do normal trading.
 * 2) Value-leak path: high-fee round-trips drain LP value/share → stop-loss freezes swaps.
 * 3) Price-crash path: oracle mid drops hard → large oneForZero trade is blocked.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseUnits, type Address } from "viem";
import * as sdk from "../../src/index.js";
import { addLiquidityToPool, STOP_LOSS_LIQUIDITY_DELTAS } from "../shared/poolLiquidity.js";
import { executeExactInputSingle } from "../shared/swapTestHelpers.js";
import {
  approveTokensForLiquidityAdder,
  approveTokensForSimpleRouter,
  buildExactInputSingleTestParams,
  createPoolViaFactory,
  deployMetricTestEnv,
  setOracleMid,
  testBidAskPriceQ64,
  type MetricTestEnv,
} from "../shared/testEnv.js";

const DRAWDOWN_E6 = 50_000; // 5%
const DEADLINE = () => BigInt(Math.floor(Date.now() / 1000) + 3600);

async function expectSwapSuccess(
  env: MetricTestEnv,
  wallet: any,
  pool: Address,
  params: { zeroForOne: boolean; amountIn: bigint },
): Promise<void> {
  await executeExactInputSingle(
    env,
    wallet,
    buildExactInputSingleTestParams(env, pool, {
      recipient: wallet.account.address,
      zeroForOne: params.zeroForOne,
      amountIn: params.amountIn,
      deadline: DEADLINE(),
    }),
  );
}

async function expectSwapRevertsStopLoss(
  env: MetricTestEnv,
  wallet: any,
  pool: Address,
  params: { zeroForOne: boolean; amountIn: bigint },
): Promise<void> {
  await assert.rejects(
    async () => {
      await expectSwapSuccess(env, wallet, pool, params);
    },
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      return /OracleStopLossTriggered|execution reverted/i.test(message);
    },
  );
}

describe("OracleValueStopLossExtension E2E", async () => {
  const { viem } = (await network.connect("hardhat")) as any;
  const [deployer, trader] = await viem.getWalletClients();

  async function setupPool(options?: {
    drawdownE6?: number;
    binLengthE6?: number;
    binFeeE6?: number;
    protocolSpreadFeeE6?: number;
    adminSpreadFeeE6?: number;
  }): Promise<{
    env: MetricTestEnv;
    pool: Address;
    stopLoss: Address;
  }> {
    const env = await deployMetricTestEnv(viem, deployer);
    const stopLoss = await viem.deployContract("OracleValueStopLossExtension", [
      env.factory.address,
    ]);

    const pool = await createPoolViaFactory(env, deployer, {
      adminSpreadFeeE6: options?.adminSpreadFeeE6 ?? 5_000,
      protocolSpreadFeeE6: options?.protocolSpreadFeeE6 ?? 0,
      adminNotionalFeeE8: 0,
      nonNegativeBins: sdk.createUniformBins(
        10,
        options?.binLengthE6 ?? 10_000,
        options?.binFeeE6 ?? 0,
        options?.binFeeE6 ?? 0,
      ),
      negativeBins: sdk.createUniformBins(
        10,
        options?.binLengthE6 ?? 10_000,
        options?.binFeeE6 ?? 0,
        options?.binFeeE6 ?? 0,
      ),
      extensions: [stopLoss.address],
      extensionOrders: sdk.buildExtensionOrders({ afterSwap: [1] }),
      extensionInitData: [
        sdk.encodeOracleStopLossInitData({
          drawdownE6: options?.drawdownE6 ?? DRAWDOWN_E6,
          decayPerSecondE18: 0n,
          timelockSeconds: 0,
        }),
      ],
    });

    const max0 = parseUnits("1000000", 18);
    const max1 = parseUnits("1000000", 6);
    await approveTokensForLiquidityAdder(env, deployer, max0, max1);
    await approveTokensForSimpleRouter(env, deployer, max0, max1);
    await addLiquidityToPool(env, deployer, pool, 1n, STOP_LOSS_LIQUIDITY_DELTAS);

    await env.token0.write.mint([trader.account.address, parseUnits("100000", 18)], {
      account: deployer.account,
    });
    await env.token1.write.mint([trader.account.address, parseUnits("100000", 6)], {
      account: deployer.account,
    });
    await env.token0.write.approve([env.simpleRouter.address, max0], {
      account: trader.account,
    });
    await env.token1.write.approve([env.simpleRouter.address, max1], {
      account: trader.account,
    });

    return { env, pool, stopLoss: stopLoss.address };
  }

  it("allows normal trading after stop-loss pool setup", async () => {
    const { env, pool, stopLoss } = await setupPool();

    const config = await sdk.getOracleStopLossConfig(env.publicClient, stopLoss, pool);
    assert.equal(config.initialized, true);
    assert.equal(config.drawdownE6, DRAWDOWN_E6);

    // First touch establishes high watermarks; subsequent small fair swaps succeed.
    await expectSwapSuccess(env, trader, pool, {
      zeroForOne: false,
      amountIn: parseUnits("1", 6),
    });
    await expectSwapSuccess(env, trader, pool, {
      zeroForOne: true,
      amountIn: parseUnits("1", 18),
    });
    await expectSwapSuccess(env, trader, pool, {
      zeroForOne: false,
      amountIn: parseUnits("2", 6),
    });

    const [bid, ask] = testBidAskPriceQ64(1);
    const status = await sdk.getOracleStopLossAnyBinStatus({
      publicClient: env.publicClient,
      extension: stopLoss,
      dataProvider: env.dataProvider.address,
      pool,
      bidPriceX64: bid,
      askPriceX64: ask,
    });
    assert.equal(status.enabled, true);
    assert.equal(status.isAnyBinStopLossBreached, false);
  });

  it("freezes the pool after continuous value-losing round trips", async () => {
    // At a fixed oracle mid, fat spread fees + tight drawdown make repeated
    // round-trips erode value/share until watermarks are breached and swaps freeze.
    const { env, pool, stopLoss } = await setupPool({
      drawdownE6: 1, // 0.0001%
      binLengthE6: 100_000,
      binFeeE6: 200_000, // 20%
      protocolSpreadFeeE6: 500_000,
      adminSpreadFeeE6: 500_000, // divert the full fee from LP bins
    });

    await setOracleMid(env, 1);
    await expectSwapSuccess(env, trader, pool, {
      zeroForOne: false,
      amountIn: parseUnits("1", 6),
    });

    const [bid0, ask0] = testBidAskPriceQ64(1);
    assert.equal(
      (
        await sdk.getOracleStopLossAnyBinStatus({
          publicClient: env.publicClient,
          extension: stopLoss,
          dataProvider: env.dataProvider.address,
          pool,
          bidPriceX64: bid0,
          askPriceX64: ask0,
        })
      ).isAnyBinStopLossBreached,
      false,
    );

    let breached = false;
    for (let i = 0; i < 60; i++) {
      try {
        await expectSwapSuccess(env, trader, pool, {
          zeroForOne: true,
          amountIn: parseUnits("2", 18),
        });
        await expectSwapSuccess(env, trader, pool, {
          zeroForOne: false,
          amountIn: parseUnits("2", 6),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        assert.match(
          message,
          /OracleStopLossTriggered/,
          `unexpected revert while draining value: ${message}`,
        );
        breached = true;
        break;
      }

      const [bid, ask] = testBidAskPriceQ64(1);
      const status = await sdk.getOracleStopLossAnyBinStatus({
        publicClient: env.publicClient,
        extension: stopLoss,
        dataProvider: env.dataProvider.address,
        pool,
        bidPriceX64: bid,
        askPriceX64: ask,
      });
      if (status.isAnyBinStopLossBreached) {
        breached = true;
        break;
      }
    }
    assert.equal(breached, true, "expected watermarks to breach after fee-draining round trips");

    // Next swap in a blocked direction must revert with stop-loss.
    const [bid, ask] = testBidAskPriceQ64(1);
    const finalStatus = await sdk.getOracleStopLossAnyBinStatus({
      publicClient: env.publicClient,
      extension: stopLoss,
      dataProvider: env.dataProvider.address,
      pool,
      bidPriceX64: bid,
      askPriceX64: ask,
    });
    if (finalStatus.breachedBins.some((b) => b.blocksZeroForOne)) {
      await expectSwapRevertsStopLoss(env, trader, pool, {
        zeroForOne: true,
        amountIn: parseUnits("0.5", 18),
      });
    }
    if (finalStatus.breachedBins.some((b) => b.blocksOneForZero)) {
      await expectSwapRevertsStopLoss(env, trader, pool, {
        zeroForOne: false,
        amountIn: parseUnits("0.5", 6),
      });
    }
  });

  it("blocks a large trade after a significant oracle price drop", async () => {
    const { env, pool, stopLoss } = await setupPool({ drawdownE6: DRAWDOWN_E6 });

    // Normal trading at mid ≈ 1 establishes watermarks.
    await expectSwapSuccess(env, trader, pool, {
      zeroForOne: false,
      amountIn: parseUnits("3", 6),
    });
    await expectSwapSuccess(env, trader, pool, {
      zeroForOne: true,
      amountIn: parseUnits("2", 18),
    });

    // Significant mid crash: metricToken1 falls → blocks oneForZero (token1 in / token0 out).
    const [bid, ask] = await setOracleMid(env, 0.5);

    const status = await sdk.getOracleStopLossAnyBinStatus({
      publicClient: env.publicClient,
      extension: stopLoss,
      dataProvider: env.dataProvider.address,
      pool,
      bidPriceX64: bid,
      askPriceX64: ask,
    });
    assert.ok(status.isAnyBinStopLossBreached, "price crash should breach stop-loss vs watermarks");
    assert.ok(
      status.breachedBins.some((b) => b.blocksOneForZero),
      "price drop should block oneForZero (token0 outflow)",
    );

    await expectSwapRevertsStopLoss(env, trader, pool, {
      zeroForOne: false,
      amountIn: parseUnits("50", 6),
    });

    // Opposite direction can still clear (metricToken0 rises when mid falls).
    await expectSwapSuccess(env, trader, pool, {
      zeroForOne: true,
      amountIn: parseUnits("1", 18),
    });
  });
});
