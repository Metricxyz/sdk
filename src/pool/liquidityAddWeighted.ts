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
import { MAX_UINT104 } from "../constants.js";
import { getSlot0 } from "../dataProvider/read.js";
import { getPoolImmutables } from "./read.js";
import { prepareLiquidityCursorBounds } from "./cursorBounds.js";
import { buildModifyLiquidityArgsForAddition } from "./liquidityAddExactShares.js";
import {
  additionPlanToPoolLiquidityDelta,
  getLiquidityAdderFunction,
  resolveLiquidityCursorBounds,
  type LiquidityCursorBounds,
} from "./liquidity.js";
import { ceilDiv, ONE_E18, priceX64ToPriceE18 } from "../utils/liquidityMath.js";

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
  /** Largest change in the pool's distance from the oracle, in percent of price, before the add reverts. */
  maxOracleDistanceChangePercent: number;
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
 * Calibration uses a funded token needed by the selected bins, retaining its native units.
 * Small budgets are enlarged for the probe to preserve the requested relative weights;
 * the on-chain adder scales the final deposit back to the original caps.
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
  maxOracleDistanceChangePercent,
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

  if (maxAmountToken0 === 0n && maxAmountToken1 === 0n) {
    throw new Error("maxAmountToken0 or maxAmountToken1 must be > 0");
  }

  const [immutables, slot0] = await Promise.all([
    getPoolImmutables(publicClient, factoryAddress, poolAddress),
    getSlot0(publicClient, dataProviderAddress, poolAddress),
  ]);
  const needsToken0 = bins.some(
    (bin) => bin > slot0.curBinIdx || (bin === slot0.curBinIdx && slot0.curPosInBin < MAX_UINT104),
  );
  const needsToken1 = bins.some(
    (bin) => bin < slot0.curBinIdx || (bin === slot0.curBinIdx && slot0.curPosInBin > 0n),
  );
  const token0UnitValue = immutables.token0ScaleMultiplier * priceX64ToPriceE18(currentPriceX64);
  const token1UnitValue = immutables.token1ScaleMultiplier * ONE_E18;
  if ((needsToken0 && maxAmountToken0 === 0n) || (needsToken1 && maxAmountToken1 === 0n)) {
    throw new Error("selected bins require a positive cap for every token they need");
  }
  const useToken0 =
    needsToken0 &&
    (!needsToken1 || maxAmountToken0 * token0UnitValue <= maxAmountToken1 * token1UnitValue);
  const budget = useToken0 ? maxAmountToken0 : maxAmountToken1;

  const relativeWeights = weights ?? bins.map(() => 1);
  const smallestWeight = relativeWeights.reduce((min, weight) => Math.min(min, weight));
  const weightUnits = relativeWeights.map((weight) => {
    const units = Math.ceil((weight / smallestWeight) * 1e6);
    if (!Number.isFinite(units)) {
      throw new Error("relative weight ratio is too large");
    }
    return BigInt(units);
  });
  const totalWeightUnits = weightUnits.reduce((sum, w) => sum + w, 0n);
  // Each calibration unit must remain nonzero when converted to the other required token.
  const minimumTarget = useToken0
    ? needsToken1
      ? ceilDiv(token1UnitValue, token0UnitValue)
      : 1n
    : needsToken0
      ? ceilDiv(token0UnitValue, token1UnitValue)
      : 1n;
  const minimumBudget = totalWeightUnits * minimumTarget;
  const calibrationBudget = budget > minimumBudget ? budget : minimumBudget;
  const valueTargets: LiquidityBinValueInput[] = bins.map((bin, i) => ({
    bin,
    targetValueInToken: (calibrationBudget * weightUnits[i]) / totalWeightUnits,
    targetValueInToken0: useToken0,
  }));

  const [cursorBounds, [, deltas]] = await Promise.all([
    prepareLiquidityCursorBounds({
      publicClient,
      pool: poolAddress,
      maxOracleDistanceChangePercent,
      factoryAddress,
      dataProviderAddress,
    }),
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
    ...cursorBounds,
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
