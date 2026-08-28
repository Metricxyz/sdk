/**
 * Packed event unpack: unit vectors mirroring metric-core's Packed.t.sol, plus an e2e swap
 * whose real Swap/BinSwapped logs are unpacked and cross-checked against independently-read
 * on-chain state (ERC20 balance deltas, per-bin scaled balance deltas, post-swap slot0).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits, decodeEventLog } from "viem";
import * as sdk from "../src/index.js";
import { addLiquidityToPool, STOP_LOSS_LIQUIDITY_DELTAS } from "./shared/poolLiquidity.js";
import {
  approveTokensForLiquidityAdder,
  approveTokensForSimpleRouter,
  buildExactInputSingleTestParams,
  createPoolViaFactory,
  deployMetricTestEnv,
} from "./shared/testEnv.js";

const UINT128_MAX = (1n << 128n) - 1n;
const INT128_MIN = -(1n << 127n);
const INT128_MAX = (1n << 127n) - 1n;

function packUint128Pair(high: bigint, low: bigint): bigint {
  return ((high & UINT128_MAX) << 128n) | (low & UINT128_MAX);
}

function packInt128Pair(high: bigint, low: bigint): bigint {
  return packUint128Pair(high, low);
}

function packSwapDetails(exactInput: boolean, binIdx: bigint, posInBin: bigint): bigint {
  const binIdxBits = binIdx & 0xffffn;
  return ((exactInput ? 1n : 0n) << 120n) | (binIdxBits << 104n) | (posInBin & ((1n << 104n) - 1n));
}

describe("unpackPacked2Uint128", () => {
  it("splits high/low without cross-talk", () => {
    const packed = packUint128Pair(0n, UINT128_MAX);
    assert.deepEqual(sdk.unpackPacked2Uint128(packed), { high: 0n, low: UINT128_MAX });
  });

  it("round-trips max in both halves", () => {
    const packed = packUint128Pair(UINT128_MAX, UINT128_MAX);
    assert.deepEqual(sdk.unpackPacked2Uint128(packed), { high: UINT128_MAX, low: UINT128_MAX });
  });

  it("accepts a 0x-hex word", () => {
    const packed = packUint128Pair(1n, 2n);
    const hex = `0x${packed.toString(16).padStart(64, "0")}` as const;
    assert.deepEqual(sdk.unpackPacked2Uint128(hex), { high: 1n, low: 2n });
  });
});

describe("unpackPacked2Int128", () => {
  it("round-trips int128 min/max in both positions", () => {
    const p = packInt128Pair(INT128_MIN, INT128_MAX);
    assert.deepEqual(sdk.unpackPacked2Int128(p), { high: INT128_MIN, low: INT128_MAX });

    const q = packInt128Pair(INT128_MAX, INT128_MIN);
    assert.deepEqual(sdk.unpackPacked2Int128(q), { high: INT128_MAX, low: INT128_MIN });
  });

  it("a negative low half does not corrupt the high half (the landmine the on-chain mask exists for)", () => {
    const packed = packInt128Pair(7n, -1n);
    assert.deepEqual(sdk.unpackPacked2Int128(packed), { high: 7n, low: -1n });
  });

  it("signs do not leak between halves", () => {
    const packed = packInt128Pair(-5n, 5n);
    assert.deepEqual(sdk.unpackPacked2Int128(packed), { high: -5n, low: 5n });
  });
});

describe("unpackPackedSwapDetails", () => {
  it("round-trips exactInput / binIdx / posInBin", () => {
    const packed = packSwapDetails(true, 7n, 12345n);
    assert.deepEqual(sdk.unpackPackedSwapDetails(packed), {
      exactInput: true,
      binIdx: 7,
      posInBin: 12345n,
    });
  });

  it("sign-extends a negative binIdx without smearing over the exactInput flag", () => {
    const packed = packSwapDetails(false, -1n, 0n);
    assert.deepEqual(sdk.unpackPackedSwapDetails(packed), {
      exactInput: false,
      binIdx: -1,
      posInBin: 0n,
    });
  });

  it("handles binIdx int16 boundaries", () => {
    assert.equal(sdk.unpackPackedSwapDetails(packSwapDetails(true, 32767n, 0n)).binIdx, 32767);
    assert.equal(sdk.unpackPackedSwapDetails(packSwapDetails(true, -32768n, 0n)).binIdx, -32768);
  });
});

describe("unpackBinSwappedEvent / unpackSwapEvent", () => {
  it("maps binDeltas/fees halves to the documented token0/token1 and lp/platform legs", () => {
    const unpacked = sdk.unpackBinSwappedEvent({
      binIdx: 3n,
      binDeltas: packInt128Pair(100n, -60n),
      fees: packUint128Pair(2n, 1n),
    });
    assert.deepEqual(unpacked, {
      binIdx: 3n,
      binDelta0Scaled: 100n,
      binDelta1Scaled: -60n,
      lpFeeAmount: 2n,
      platformFeeAmount: 1n,
    });
  });

  it("maps Swap details/amountDeltas/platformFees to the documented fields", () => {
    const unpacked = sdk.unpackSwapEvent({
      sender: "0x1111111111111111111111111111111111111111",
      recipient: "0x2222222222222222222222222222222222222222",
      details: packSwapDetails(true, 5n, 999n),
      amountDeltas: packInt128Pair(1000n, -900n),
      platformFees: packUint128Pair(6n, 4n),
    });
    assert.deepEqual(unpacked, {
      sender: "0x1111111111111111111111111111111111111111",
      recipient: "0x2222222222222222222222222222222222222222",
      exactInput: true,
      binIdx: 5,
      posInBin: 999n,
      amountDelta0: 1000n,
      amountDelta1: -900n,
      platformSpreadFee: 6n,
      platformNotionalFee: 4n,
    });
  });
});

describe("Swap / BinSwapped event unpack (e2e)", () => {
  it("unpacks the real logs from an on-chain exact-input swap and matches independently-read on-chain state", async () => {
    const { viem } = await network.connect();
    const [deployer] = await viem.getWalletClients();

    const env = await deployMetricTestEnv(viem, deployer);
    const max0 = parseUnits("1000000", 18);
    const max1 = parseUnits("1000000", 6);
    await approveTokensForLiquidityAdder(env, deployer, max0, max1);
    await approveTokensForSimpleRouter(env, deployer, max0, max1);

    const pool = await createPoolViaFactory(env, deployer, {});
    await addLiquidityToPool(env, deployer, pool, 1n, STOP_LOSS_LIQUIDITY_DELTAS);

    const touchedBins = STOP_LOSS_LIQUIDITY_DELTAS.binIdxs.map((b) => Number(b));

    const [binStatesBefore, poolToken0Before, poolToken1Before] = await Promise.all([
      sdk.getBinStatesScaled(env.publicClient, env.dataProvider.address, pool, touchedBins),
      env.token0.read.balanceOf([pool]) as Promise<bigint>,
      env.token1.read.balanceOf([pool]) as Promise<bigint>,
    ]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const amountIn = parseUnits("1", 6);
    const params = buildExactInputSingleTestParams(env, pool, {
      recipient: deployer.account.address,
      zeroForOne: false, // token1 (6 decimals) -> token0
      amountIn,
      deadline,
    });

    const hash = await deployer.sendTransaction({
      to: env.simpleRouter.address,
      data: sdk.encodeExactInputSingleCalldata(params),
    });
    const receipt = await env.publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");

    const [binStatesAfter, poolToken0After, poolToken1After, slot0After] = await Promise.all([
      sdk.getBinStatesScaled(env.publicClient, env.dataProvider.address, pool, touchedBins),
      env.token0.read.balanceOf([pool]) as Promise<bigint>,
      env.token1.read.balanceOf([pool]) as Promise<bigint>,
      sdk.getSlot0(env.publicClient, env.dataProvider.address, pool),
    ]);

    const swapLogs = receipt.logs
      .map((log: any) => {
        try {
          return decodeEventLog({ abi: sdk.MetricOmmPoolAbi, ...log });
        } catch {
          return null;
        }
      })
      .filter((decoded: any): decoded is NonNullable<typeof decoded> => decoded !== null);

    const swapEvent = swapLogs.find((decoded: any) => decoded.eventName === "Swap");
    const binSwappedEvents = swapLogs.filter((decoded: any) => decoded.eventName === "BinSwapped");

    assert.ok(swapEvent, "expected a Swap event in the swap receipt logs");
    assert.ok(binSwappedEvents.length > 0, "expected at least one BinSwapped event");

    // --- Swap event: cross-check against real ERC20 balance movement and post-swap slot0. ---
    const swap = sdk.unpackSwapEvent(swapEvent!.args as any);

    assert.equal(swap.exactInput, true);
    assert.equal(swap.sender.toLowerCase(), env.simpleRouter.address.toLowerCase());
    assert.equal(swap.recipient.toLowerCase(), deployer.account.address.toLowerCase());

    // The pool's actual token1 (input) and token0 (output) balance movement is ground truth;
    // the unpacked amountDeltas must match it exactly, not just have the right sign.
    assert.equal(poolToken1After - poolToken1Before, amountIn);
    assert.equal(swap.amountDelta1, poolToken1After - poolToken1Before);
    assert.equal(swap.amountDelta0, poolToken0After - poolToken0Before);
    assert.ok(swap.amountDelta0 < 0n, "pool should give up the output token (token0)");

    // Fees are non-negative and bounded by the trade size.
    assert.ok(swap.platformSpreadFee >= 0n);
    assert.ok(swap.platformNotionalFee >= 0n);
    assert.ok(swap.platformSpreadFee + swap.platformNotionalFee < amountIn);

    // The terminal bin position the event reports must match the pool's actual post-swap slot0.
    assert.equal(swap.binIdx, slot0After.curBinIdx);

    // --- BinSwapped events: cross-check the sum of per-bin scaled deltas against independent reads. ---
    let sumBinDelta0Scaled = 0n;
    let sumBinDelta1Scaled = 0n;
    for (const binSwappedLog of binSwappedEvents) {
      const binSwapped = sdk.unpackBinSwappedEvent(binSwappedLog.args as any);
      assert.ok(binSwapped.binDelta1Scaled > 0n, "bin should gain scaled token1 (input)");
      assert.ok(binSwapped.binDelta0Scaled < 0n, "bin should give up scaled token0 (output)");
      assert.ok(binSwapped.lpFeeAmount >= 0n);
      assert.ok(binSwapped.platformFeeAmount >= 0n);
      sumBinDelta0Scaled += binSwapped.binDelta0Scaled;
      sumBinDelta1Scaled += binSwapped.binDelta1Scaled;
    }

    let actualDelta0Scaled = 0n;
    let actualDelta1Scaled = 0n;
    for (let i = 0; i < touchedBins.length; i++) {
      actualDelta0Scaled +=
        binStatesAfter.token0BalancesScaled[i]! - binStatesBefore.token0BalancesScaled[i]!;
      actualDelta1Scaled +=
        binStatesAfter.token1BalancesScaled[i]! - binStatesBefore.token1BalancesScaled[i]!;
    }
    assert.equal(sumBinDelta0Scaled, actualDelta0Scaled);
    assert.equal(sumBinDelta1Scaled, actualDelta1Scaled);
  });
});
