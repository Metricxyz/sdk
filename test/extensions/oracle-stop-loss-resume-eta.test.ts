/**
 * Stop-loss resume estimate and the watermarks it is built from.
 *
 * On-chain (`OracleValueStopLossExtension._decayed`) a bin's watermark decays linearly from its
 * STORED value over the time since its last write. The estimate must follow that rule instead of
 * decaying an already-decayed value a second time.
 *
 * The expected values here come from a statement of the contract rule written for this test
 * (`chainBreached`), from on-chain reads, and from swaps accepted or rejected by the chain.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { decodeErrorResult, parseUnits, type Address } from "viem";
import * as sdk from "../../src/index.js";
import { OracleValueStopLossExtensionAbi } from "../../src/abis/OracleValueStopLossExtension.js";
import { addLiquidityToPool, STOP_LOSS_LIQUIDITY_DELTAS } from "../shared/poolLiquidity.js";
import { executeExactInputSingle } from "../shared/swapTestHelpers.js";
import {
  approveTokensForLiquidityAdder,
  approveTokensForSimpleRouter,
  buildExactInputSingleTestParams,
  createPoolViaFactory,
  deployMetricTestEnv,
  setOracleMid,
} from "../shared/testEnv.js";

const E18 = 10n ** 18n;
const E6 = 1_000_000n;
const RATE = 580_000_000_000n; // 5.8e11 per second, about 5% a day (contract comment)
const DRAWDOWN_E6 = 50_000n;

/** The contract rule, restated: linear decay from the stored value, floored divisions. */
function chainHwm(stored: bigint, rate: bigint, dt: bigint): bigint {
  const factor = rate * dt;
  return factor >= E18 ? 0n : stored - (stored * factor) / E18;
}
function chainBreached(metric: bigint, stored: bigint, rate: bigint, dt: bigint, dd: bigint) {
  return metric < (chainHwm(stored, rate, dt) * (E6 - dd)) / E6;
}
/** Smallest m >= 0 with the condition clear at `elapsed + m`; breach is monotone in time. */
function firstClear(metric: bigint, stored: bigint, rate: bigint, elapsed: bigint, dd: bigint) {
  if (!chainBreached(metric, stored, rate, elapsed, dd)) return 0n;
  let hi = 1n;
  while (chainBreached(metric, stored, rate, elapsed + hi, dd)) hi *= 2n;
  let lo = hi / 2n; // breached at lo, clear at hi
  while (hi - lo > 1n) {
    const mid = (lo + hi) / 2n;
    if (chainBreached(metric, stored, rate, elapsed + mid, dd)) lo = mid;
    else hi = mid;
  }
  return hi;
}
const thresholdAt = (stored: bigint, rate: bigint, dt: bigint, dd: bigint) =>
  (chainHwm(stored, rate, dt) * (E6 - dd)) / E6;

describe("stop-loss resume estimate (pure)", () => {
  const stored = 10n ** 18n;
  const elapsed = 43_200n;
  const current = chainHwm(stored, RATE, elapsed);
  const input = (metric: bigint, extra = {}) => ({
    metric,
    hwm: current,
    drawdownE6: DRAWDOWN_E6,
    decayPerSecondE18: RATE,
    ...extra,
  });
  const fromStored = { storedHwm: stored, elapsedSinceTouchSeconds: elapsed };

  it("equals the first second the contract rule stops breaching", () => {
    for (const metric of [(stored * 88n) / 100n, (stored * 50n) / 100n, (stored * 92n) / 100n]) {
      const want = firstClear(metric, stored, RATE, elapsed, DRAWDOWN_E6);
      assert.ok(want > 0n);
      assert.equal(sdk.secondsUntilStopLossClears(input(metric, fromStored)), want);
    }
  });

  it("is exact around the estimate: breached one second earlier, clear at it", () => {
    const metric = (stored * 88n) / 100n;
    const eta = sdk.secondsUntilStopLossClears(input(metric, fromStored))!;
    assert.ok(chainBreached(metric, stored, RATE, elapsed + eta - 1n, DRAWDOWN_E6));
    assert.ok(!chainBreached(metric, stored, RATE, elapsed + eta, DRAWDOWN_E6));
  });

  it("treats metric == threshold as clear and threshold - 1 as breached", () => {
    const threshold = thresholdAt(stored, RATE, elapsed, DRAWDOWN_E6);
    assert.equal(sdk.secondsUntilStopLossClears(input(threshold, fromStored)), 0n);
    const one = sdk.secondsUntilStopLossClears(input(threshold - 1n, fromStored));
    assert.equal(one, firstClear(threshold - 1n, stored, RATE, elapsed, DRAWDOWN_E6));
    assert.ok(one! >= 1n);
    // metric one above the threshold is clear too
    assert.equal(sdk.secondsUntilStopLossClears(input(threshold + 1n, fromStored)), 0n);
  });

  it("decay disabled: null while breached, 0 when clear", () => {
    const flat = (metric: bigint) => ({
      metric,
      hwm: stored,
      drawdownE6: DRAWDOWN_E6,
      decayPerSecondE18: 0n,
      storedHwm: stored,
      elapsedSinceTouchSeconds: 99_999n,
    });
    assert.equal(sdk.secondsUntilStopLossClears(flat((stored * 80n) / 100n)), null);
    assert.equal(sdk.secondsUntilStopLossClears(flat(stored)), 0n);
  });

  it("fully decayed watermark is never breached", () => {
    const fullElapsed = (E18 + RATE - 1n) / RATE; // first second with rate * dt >= 1e18
    assert.equal(chainHwm(stored, RATE, fullElapsed), 0n);
    assert.equal(
      sdk.secondsUntilStopLossClears({
        metric: 0n,
        hwm: 0n,
        drawdownE6: DRAWDOWN_E6,
        decayPerSecondE18: RATE,
        storedHwm: stored,
        elapsedSinceTouchSeconds: fullElapsed,
      }),
      0n,
    );
    // one second before full decay the watermark is tiny but positive, so a zero metric is breached
    const before = fullElapsed - 1n;
    const tiny = chainHwm(stored, RATE, before);
    assert.ok(tiny > 0n);
    const metric = thresholdAt(stored, RATE, before, DRAWDOWN_E6) - 1n;
    assert.equal(
      sdk.secondsUntilStopLossClears({
        metric,
        hwm: tiny,
        drawdownE6: DRAWDOWN_E6,
        decayPerSecondE18: RATE,
        storedHwm: stored,
        elapsedSinceTouchSeconds: before,
      }),
      firstClear(metric, stored, RATE, before, DRAWDOWN_E6),
    );
  });

  it("without stored-watermark information it behaves as before (decays the given hwm)", () => {
    for (const metric of [(stored * 88n) / 100n, (stored * 50n) / 100n]) {
      const legacy = sdk.secondsUntilStopLossClears(input(metric));
      assert.equal(legacy, firstClear(metric, current, RATE, 0n, DRAWDOWN_E6));
      const fixed = sdk.secondsUntilStopLossClears(input(metric, fromStored))!;
      assert.ok(legacy! > fixed, "legacy overstates once the bin has been idle");
    }
  });

  it("rejects half-supplied stored information", () => {
    assert.throws(() => sdk.secondsUntilStopLossClears(input(1n, { storedHwm: stored })));
    assert.throws(() =>
      sdk.secondsUntilStopLossClears(input(1n, { elapsedSinceTouchSeconds: 5n })),
    );
  });

  it("aggregate estimate is the max over breached bins, per direction; null if any is null", () => {
    const bidPriceX64 = ((1n << 64n) * 99n) / 100n;
    const askPriceX64 = ((1n << 64n) * 101n) / 100n;
    const base = {
      token0BalanceScaled: 5n * 10n ** 18n,
      token1BalanceScaled: 5n * 10n ** 18n,
      totalShares: 10n ** 18n,
    };
    const m = sdk.computeOracleStopLossMetrics({
      ...base,
      minimalOperationalLiquidity: 1n,
      bidPriceX64,
      askPriceX64,
    });
    // stored watermarks 20% above the metrics, touched at three different ages
    const mk = (binIdx: number, ago: bigint) => {
      const s0 = (m.metricToken0 * 120n) / 100n;
      const s1 = (m.metricToken1 * 130n) / 100n;
      return {
        binIdx,
        ...base,
        highWatermark0: chainHwm(s0, RATE, ago),
        highWatermark1: chainHwm(s1, RATE, ago),
        storedHighWatermark0: s0,
        storedHighWatermark1: s1,
        secondsSinceLastTouch: ago,
        s0,
        s1,
      };
    };
    const rows = [mk(-1, 0n), mk(0, 3_600n), mk(1, 86_400n)];
    const ev = sdk.evaluateOracleStopLoss({
      bins: rows,
      bidPriceX64,
      askPriceX64,
      drawdownE6: Number(DRAWDOWN_E6),
      decayPerSecondE18: RATE,
      minimalOperationalLiquidity: 1n,
    });
    assert.equal(ev.breachedBins.length, 3);
    const want0 = rows.map((r) =>
      firstClear(m.metricToken0, r.s0, RATE, r.secondsSinceLastTouch, DRAWDOWN_E6),
    );
    const want1 = rows.map((r) =>
      firstClear(m.metricToken1, r.s1, RATE, r.secondsSinceLastTouch, DRAWDOWN_E6),
    );
    assert.deepEqual(
      ev.bins.map((b) => b.secondsUntilZeroForOneResumes),
      want0,
    );
    assert.deepEqual(
      ev.bins.map((b) => b.secondsUntilOneForZeroResumes),
      want1,
    );
    assert.equal(new Set(want0).size, 3, "ages must give different per-bin estimates");
    assert.equal(
      ev.secondsUntilZeroForOneResumes,
      want0.reduce((a, b) => (a > b ? a : b)),
    );
    assert.equal(
      ev.secondsUntilOneForZeroResumes,
      want1.reduce((a, b) => (a > b ? a : b)),
    );

    const noDecay = sdk.evaluateOracleStopLoss({
      bins: rows,
      bidPriceX64,
      askPriceX64,
      drawdownE6: Number(DRAWDOWN_E6),
      decayPerSecondE18: 0n,
      minimalOperationalLiquidity: 1n,
    });
    assert.equal(noDecay.secondsUntilZeroForOneResumes, null);
  });
});

describe("stop-loss resume estimate against the chain", async () => {
  const { viem, networkHelpers } = (await network.connect("hardhat")) as any;
  const [deployer, trader] = await viem.getWalletClients();
  const DEADLINE = 2n ** 40n; // chain time is warped; keep the deadline far away

  async function setup(decayPerSecondE18: bigint) {
    const env = await deployMetricTestEnv(viem, deployer);
    const ext = await viem.deployContract("OracleValueStopLossExtension", [env.factory.address]);
    const pool: Address = await createPoolViaFactory(env, deployer, {
      adminSpreadFeeE6: 5_000,
      protocolSpreadFeeE6: 0,
      adminNotionalFeeE8: 0,
      nonNegativeBins: sdk.createUniformBins(10, 10_000, 0, 0),
      negativeBins: sdk.createUniformBins(10, 10_000, 0, 0),
      extensions: [ext.address],
      extensionOrders: sdk.buildExtensionOrders({ afterSwap: [1] }),
      extensionInitData: [
        sdk.encodeOracleStopLossInitData({
          drawdownE6: Number(DRAWDOWN_E6),
          decayPerSecondE18,
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
    await env.token0.write.approve([env.simpleRouter.address, max0], { account: trader.account });
    await env.token1.write.approve([env.simpleRouter.address, max1], { account: trader.account });
    return { env, pool, ext: ext.address as Address };
  }

  const swap = (env: any, pool: Address, zeroForOne: boolean, amountIn: bigint) =>
    executeExactInputSingle(
      env,
      trader,
      buildExactInputSingleTestParams(env, pool, {
        recipient: trader.account.address,
        zeroForOne,
        amountIn,
        deadline: DEADLINE,
      }),
    );

  /** Revert data from a viem/hardhat error chain, or undefined if there is none. */
  function revertData(e: any): `0x${string}` | undefined {
    for (let c = e, i = 0; c && i < 10; c = c.cause, i++) {
      if (typeof c.data === "string" && /^0x[0-9a-fA-F]{8,}$/.test(c.data)) return c.data;
    }
    return undefined;
  }

  /**
   * true  = rejected with exactly OracleStopLossTriggered for `zeroForOne`
   * false = swap executed
   * Anything else (other custom error, no revert data, other failure) is rethrown.
   */
  async function stopLossBlocks(env: any, pool: Address, zeroForOne: boolean): Promise<boolean> {
    const amountIn = zeroForOne ? parseUnits("0.001", 18) : parseUnits("0.001", 6);
    try {
      await swap(env, pool, zeroForOne, amountIn);
      return false;
    } catch (e: any) {
      const data = revertData(e);
      if (!data) throw e;
      const decoded = decodeErrorResult({ abi: OracleValueStopLossExtensionAbi, data });
      if (decoded.errorName !== "OracleStopLossTriggered") throw e;
      const [, flag, metric, threshold] = decoded.args as readonly [
        number,
        boolean,
        bigint,
        bigint,
      ];
      assert.equal(flag, zeroForOne, "reverted for the other direction");
      assert.ok(metric < threshold, "revert must report metric below threshold");
      return true;
    }
  }

  /**
   * Writes watermarks. oneForZero-blocking cases use the ordinary two-way round trip. For the
   * zeroForOne direction the token0 metric must fall when the oracle mid rises, which needs bins that
   * hold token1 and carry a watermark, so those pools first trade into token1-holding bins.
   */
  async function establishWatermarks(env: any, pool: Address, zeroForOne = false) {
    if (zeroForOne) {
      await swap(env, pool, true, parseUnits("0.5", 18));
      await swap(env, pool, false, parseUnits("10", 6));
      await swap(env, pool, false, parseUnits("30", 6));
      return;
    }
    await swap(env, pool, false, parseUnits("3", 6));
    await swap(env, pool, true, parseUnits("2", 18));
  }
  const status = async (env: any, ext: Address, pool: Address, bid: bigint, ask: bigint) =>
    sdk.getOracleStopLossAnyBinStatus({
      publicClient: env.publicClient,
      extension: ext,
      dataProvider: env.dataProvider.address,
      pool,
      bidPriceX64: bid,
      askPriceX64: ask,
    });

  // [direction, idle seconds since last watermark write, oracle mid after the move]
  const cases: Array<[boolean, number, number]> = [
    [false, 0, 0.93],
    [false, 43_200, 0.9],
    [true, 0, 1.4],
    [true, 43_200, 2],
  ];
  for (const [zeroForOne, idle, mid] of cases) {
    const dir = zeroForOne ? "zeroForOne" : "oneForZero";
    it(`${dir}, idle ${idle}s: accepted exactly at the estimate, rejected one second before`, async () => {
      const { env, pool, ext } = await setup(RATE);
      await establishWatermarks(env, pool, zeroForOne);
      if (idle > 0) await networkHelpers.time.increase(idle);
      const [bid, ask] = await setOracleMid(env, mid);
      const s = await status(env, ext, pool, bid, ask);
      // A swap that stays in the current bin is checked against that bin only, so use its own estimate.
      const curBin = s.breachedBins.find((b) => b.binIdx === s.curBinIdx);
      assert.ok(
        curBin,
        `the current bin must be breached in the tested direction; cur=${s.curBinIdx} breached=${s.breachedBins.map((b) => b.binIdx)}`,
      );
      const eta = zeroForOne
        ? curBin.secondsUntilZeroForOneResumes
        : curBin.secondsUntilOneForZeroResumes;
      assert.ok(zeroForOne ? curBin.blocksZeroForOne : curBin.blocksOneForZero);
      assert.ok(eta !== null && eta > 0n, "direction must be blocked with a finite estimate");
      const readAt = Number(s.blockTimestamp);

      const blockedAt = async (seconds: bigint) => {
        const snap = await networkHelpers.takeSnapshot();
        try {
          await networkHelpers.time.setNextBlockTimestamp(readAt + Number(seconds));
          return await stopLossBlocks(env, pool, zeroForOne);
        } finally {
          await snap.restore();
        }
      };
      assert.equal(
        await blockedAt(eta - 1n),
        true,
        "must still be blocked one second before the estimate",
      );
      assert.equal(await blockedAt(eta), false, "must be accepted at the estimate");
    });
  }

  it("several breached bins: aggregate is the max, and each bin's estimate matches the contract rule", async () => {
    const { env, pool, ext } = await setup(RATE);
    await establishWatermarks(env, pool, true);
    await networkHelpers.time.increase(3_600);
    const [bid, ask] = await setOracleMid(env, 1.4);
    const s = await status(env, ext, pool, bid, ask);
    const rows = s.breachedBins.filter((b) => b.blocksZeroForOne);
    assert.ok(rows.length >= 2, "need at least two breached bins");
    const etas = rows.map((b) => b.secondsUntilZeroForOneResumes as bigint);
    assert.equal(
      s.secondsUntilZeroForOneResumes,
      etas.reduce((a, b) => (a > b ? a : b)),
    );
    assert.equal(new Set(etas).size, etas.length, "bins should differ");
    for (const b of rows) {
      const stored = (await env.publicClient.readContract({
        address: ext,
        abi: OracleValueStopLossExtensionAbi,
        functionName: "highWatermarks",
        args: [pool, b.binIdx],
        blockNumber: s.blockNumber,
      })) as readonly [bigint, bigint, number | bigint];
      const elapsed = s.blockTimestamp - BigInt(stored[2]);
      assert.equal(
        b.secondsUntilZeroForOneResumes,
        firstClear(b.metricToken0, stored[0], RATE, elapsed, DRAWDOWN_E6),
        `bin ${b.binIdx}`,
      );
    }
  });

  it("decay disabled: estimate is null and the stop-loss keeps blocking after a long wait", async () => {
    const { env, pool, ext } = await setup(0n);
    await establishWatermarks(env, pool);
    await networkHelpers.time.increase(43_200);
    const [bid, ask] = await setOracleMid(env, 0.93);
    const s = await status(env, ext, pool, bid, ask);
    assert.equal(s.secondsUntilOneForZeroResumes, null);
    await networkHelpers.time.increase(10_000_000);
    assert.equal(await stopLossBlocks(env, pool, false), true);
  });

  it("fully decayed watermarks: no breach is reported and the swap is accepted", async () => {
    const { env, pool, ext } = await setup(RATE);
    await establishWatermarks(env, pool);
    await networkHelpers.time.increase(Number((E18 + RATE - 1n) / RATE) + 10);
    const [bid, ask] = await setOracleMid(env, 0.5);
    const s = await status(env, ext, pool, bid, ask);
    assert.equal(s.isAnyBinStopLossBreached, false);
    assert.equal(s.secondsUntilOneForZeroResumes, 0n);
    assert.equal(await stopLossBlocks(env, pool, false), false);
  });

  it("watermarks derived locally equal the contract's currentHighWatermarks at the same block", async () => {
    const { env, pool, ext } = await setup(RATE);
    await establishWatermarks(env, pool);
    const fullDecay = Number((E18 + RATE - 1n) / RATE);
    for (const idle of [0, 1, 43_200, fullDecay - 1, fullDecay + 5]) {
      if (idle > 0) await networkHelpers.time.increase(idle);
      const [bid, ask] = testBidAsk();
      const s = await status(env, ext, pool, bid, ask);
      const bn = s.blockNumber;
      for (const bin of [-2, -1, 0, 1, 2]) {
        const stored = (await env.publicClient.readContract({
          address: ext,
          abi: OracleValueStopLossExtensionAbi,
          functionName: "highWatermarks",
          args: [pool, bin],
          blockNumber: bn,
        })) as readonly [bigint, bigint, number | bigint];
        const current = (await env.publicClient.readContract({
          address: ext,
          abi: OracleValueStopLossExtensionAbi,
          functionName: "currentHighWatermarks",
          args: [pool, bin],
          blockNumber: bn,
        })) as readonly [bigint, bigint];
        const dt = s.blockTimestamp - BigInt(stored[2]);
        assert.equal(
          sdk.decayedHighWatermark(stored[0], RATE, dt),
          current[0],
          `bin ${bin} token0 idle ${idle}`,
        );
        assert.equal(
          sdk.decayedHighWatermark(stored[1], RATE, dt),
          current[1],
          `bin ${bin} token1 idle ${idle}`,
        );
      }
    }
  });

  function testBidAsk(): readonly [bigint, bigint] {
    const q = 1n << 64n;
    return [(q * 99n) / 100n, (q * 101n) / 100n];
  }
});
