/**
 * Weighted liquidity adds (the path for frontends): turn a per-bin value distribution plus
 * token caps into `LiquidityAdder.addLiquidityWeighted` calldata. The adder probes the pool
 * in the same transaction and scales the share weights to deposit the most liquidity that
 * fits both caps, so no off-chain calibration of exact amounts is needed.
 */

import type { Address, Hex, PublicClient } from "viem";
import { encodeFunctionData } from "viem";
import { EMPTY_EXTENSION_DATA } from "../extensions/types.js";
import type { LiquidityBinValueInput, PoolLiquidityDelta } from "../types.js";
import { getSlot0 } from "../dataProvider/read.js";
import { getPoolImmutables } from "./read.js";
import { computeLiquidityCursorBounds } from "./cursorBounds.js";
import { buildModifyLiquidityArgsForAddition } from "./liquidityAddExactShares.js";
import {
  additionPlanToPoolLiquidityDelta,
  getLiquidityAdderFunction,
  resolveLiquidityCursorBounds,
  type LiquidityCursorBounds,
} from "./liquidity.js";
import { convertToken0ToToken1, priceX64ToPriceE18 } from "../utils/liquidityMath.js";

export interface BuildAddLiquidityWeightedParamsParams {
  publicClient: PublicClient;
  factoryAddress: Address;
  dataProviderAddress: Address;
  poolAddress: Address;
  bins: number[];
  /** Relative value per bin; defaults to an equal value in every bin. */
  weights?: number[];
  currentPriceX64: bigint;
  /** Most token0 the add may pull, typically the wallet balance. */
  maxAmountToken0: bigint;
  /** Most token1 the add may pull, typically the wallet balance. */
  maxAmountToken1: bigint;
  /** Accepted cursor movement before execution reverts; 1.0 = one bin's worth of positions. */
  maximalCursorMovement: number;
  salt?: bigint;
}

export type AddLiquidityWeightedParams = LiquidityCursorBounds & {
  salt: bigint;
  weightDeltas: PoolLiquidityDelta;
  maxAmountToken0: bigint;
  maxAmountToken1: bigint;
};

/**
 * Build `addLiquidityWeighted` arguments that deposit as much as possible within
 * `maxAmountToken0` / `maxAmountToken1` while keeping the requested value shape across bins.
 *
 * Share weights are sized from the smaller non-zero cap so they sit near real deposit
 * magnitudes; tiny weights would make the adder's probe rounding coarse.
 */
export async function buildAddLiquidityWeightedParams({
  publicClient,
  factoryAddress,
  dataProviderAddress,
  poolAddress,
  bins,
  weights,
  currentPriceX64,
  maxAmountToken0,
  maxAmountToken1,
  maximalCursorMovement,
  salt = 0n,
}: BuildAddLiquidityWeightedParamsParams): Promise<AddLiquidityWeightedParams> {
  if (!Array.isArray(bins) || bins.length === 0) {
    throw new Error("bins must be a non-empty array");
  }
  if (weights != null && (!Array.isArray(weights) || weights.length !== bins.length)) {
    throw new Error("weights must be an array with the same length as bins");
  }
  if (weights?.some((w) => !Number.isFinite(w) || w <= 0)) {
    throw new Error("weights must be positive finite numbers");
  }
  if (maxAmountToken0 < 0n || maxAmountToken1 < 0n) {
    throw new Error("maxAmountToken0 and maxAmountToken1 must be >= 0");
  }
  if (currentPriceX64 <= 0n) {
    throw new Error("currentPriceX64 must be > 0");
  }

  const immutables = await getPoolImmutables(publicClient, factoryAddress, poolAddress);
  const cap0InToken1 = convertToken0ToToken1(
    maxAmountToken0,
    immutables.token0ScaleMultiplier,
    immutables.token1ScaleMultiplier,
    priceX64ToPriceE18(currentPriceX64),
  );
  const nonZeroCapsInToken1 = [cap0InToken1, maxAmountToken1].filter((cap) => cap > 0n);
  if (nonZeroCapsInToken1.length === 0) {
    throw new Error("maxAmountToken0 or maxAmountToken1 must be > 0");
  }
  const budgetInToken1 = nonZeroCapsInToken1.reduce((min, cap) => (cap < min ? cap : min));

  const weightUnits = (weights ?? bins.map(() => 1)).map((w) => BigInt(Math.ceil(w * 1e6)));
  const totalWeightUnits = weightUnits.reduce((sum, w) => sum + w, 0n);
  const valueTargets: LiquidityBinValueInput[] = bins.map((bin, i) => {
    const target = (budgetInToken1 * weightUnits[i]) / totalWeightUnits;
    return {
      bin,
      targetValueInToken: target > 0n ? target : 1n,
      targetValueInToken0: false,
    };
  });

  const [slot0, [, deltas]] = await Promise.all([
    getSlot0(publicClient, dataProviderAddress, poolAddress),
    buildModifyLiquidityArgsForAddition({
      publicClient,
      factoryAddress,
      dataProviderAddress,
      poolAddress,
      bins: valueTargets,
      currentPriceX64,
      salt,
    }),
  ]);

  return {
    salt,
    weightDeltas: additionPlanToPoolLiquidityDelta(deltas),
    maxAmountToken0,
    maxAmountToken1,
    ...computeLiquidityCursorBounds(slot0.curBinIdx, slot0.curPosInBin, maximalCursorMovement),
  };
}

const WAD = 10n ** 18n;

/**
 * Matches `MetricOmmPoolLiquidityAdder._scaleWeightsToShares`: given probe token needs from a weighted
 * probe with the same weight vector, scale integer shares so neither token exceeds the caller caps.
 */
export function scaleWeightedPoolDeltasToFitCaps(params: {
  weights: PoolLiquidityDelta;
  probeNeed0: bigint;
  probeNeed1: bigint;
  maxAmountToken0: bigint;
  maxAmountToken1: bigint;
}): PoolLiquidityDelta {
  const { weights, probeNeed0, probeNeed1, maxAmountToken0, maxAmountToken1 } = params;
  const maxU = 2n ** 256n - 2n;
  const scaleWad0 = probeNeed0 === 0n ? maxU : (maxAmountToken0 * WAD) / probeNeed0;
  const scaleWad1 = probeNeed1 === 0n ? maxU : (maxAmountToken1 * WAD) / probeNeed1;
  const scaleWad = scaleWad0 < scaleWad1 ? scaleWad0 : scaleWad1;
  const shares = weights.shares.map((w, i) => {
    const scaled = (w * scaleWad) / WAD;
    if (w !== 0n && scaled === 0n) {
      throw new Error(`shares rounded to zero at weight index ${i}`);
    }
    return scaled;
  });
  return { binIdxs: weights.binIdxs, shares };
}

/**
 * Encode weighted add for the transaction sender.
 *
 * `weightDeltas` are relative share weights; the adder determines the actual amounts by
 * probing the pool's *live* cursor position at execution time and scales weights to fit
 * `maxAmountToken0` / `maxAmountToken1` accordingly (use {@link scaleWeightedPoolDeltasToFitCaps}
 * to pre-scale). Because that probe reads live state, an attacker who moves the cursor
 * immediately before this transaction (and reverses it after) can skew the deposited
 * composition in their favor — a sandwich on the LP. `minimalCurBin` / `minimalPosition` /
 * `maximalCurBin` / `maximalPosition` bound how far the cursor may have moved by execution
 * time; the call reverts outside that window instead of depositing at a manipulated ratio.
 * They are required here (not defaulted) so that opting out is a visible, deliberate choice —
 * pass {@link UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS} to do so. Prefer
 * {@link prepareLiquidityCursorBounds} to derive a tight bound from the pool's current cursor.
 * Creates or increases the position `(msg.sender, salt)`.
 */
export function encodeAddLiquidityWeightedSelfCalldata(params: {
  pool: Address;
  salt: bigint;
  weightDeltas: PoolLiquidityDelta;
  maxAmountToken0: bigint;
  maxAmountToken1: bigint;
  minimalCurBin: number;
  minimalPosition: bigint;
  maximalCurBin: number;
  maximalPosition: bigint;
  extensionData?: Hex;
}): Hex {
  const bounds = resolveLiquidityCursorBounds(params);
  return encodeFunctionData({
    abi: [getLiquidityAdderFunction("addLiquidityWeighted", 7)],
    functionName: "addLiquidityWeighted",
    args: [
      params.pool,
      params.salt,
      { binIdxs: [...params.weightDeltas.binIdxs], shares: [...params.weightDeltas.shares] },
      params.maxAmountToken0,
      params.maxAmountToken1,
      bounds,
      params.extensionData ?? EMPTY_EXTENSION_DATA,
    ],
  });
}

/**
 * Encode weighted add for an explicit position owner.
 *
 * Same as {@link encodeAddLiquidityWeightedSelfCalldata} but credits liquidity to `(owner, salt)`
 * while `msg.sender` pays for the deposit.
 */
export function encodeAddLiquidityWeightedWithOwnerCalldata(params: {
  pool: Address;
  owner: Address;
  salt: bigint;
  weightDeltas: PoolLiquidityDelta;
  maxAmountToken0: bigint;
  maxAmountToken1: bigint;
  minimalCurBin: number;
  minimalPosition: bigint;
  maximalCurBin: number;
  maximalPosition: bigint;
  extensionData?: Hex;
}): Hex {
  const bounds = resolveLiquidityCursorBounds(params);
  return encodeFunctionData({
    abi: [getLiquidityAdderFunction("addLiquidityWeighted", 8)],
    functionName: "addLiquidityWeighted",
    args: [
      params.pool,
      params.owner,
      params.salt,
      { binIdxs: [...params.weightDeltas.binIdxs], shares: [...params.weightDeltas.shares] },
      params.maxAmountToken0,
      params.maxAmountToken1,
      bounds,
      params.extensionData ?? EMPTY_EXTENSION_DATA,
    ],
  });
}
