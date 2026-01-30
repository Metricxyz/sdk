/**
 * MetricAMM SDK - Liquidity Calculations
 * Functions for calculating liquidity distributions
 */

import type { Address, PublicClient } from "viem";
import { MAX_UINT104, MAX_INT104 } from "../constants.js";
import type {
  LiquidityDelta,
  CalculateUniformLiquidityParams,
} from "../types.js";
import { getPoolImmutables } from "./read.js";
import { getSlot0, getBinStatesExternal } from "../stateView/read.js";

/**
 * Calculate uniform liquidity distribution across multiple bins.
 *
 * ## Algorithm Overview
 *
 * This function distributes liquidity uniformly BY VALUE across a range of bins.
 * The user specifies an amount per bin (in either token0 or token1), and the function
 * calculates the number of shares to add to each bin such that each bin receives
 * approximately the same value of liquidity.
 *
 * ## Steps:
 *
 * 1. **Convert amount to both tokens**: Using current price, convert the per-bin amount
 *    to equivalent values in both token0 and token1 (amount0PerBin, amount1PerBin).
 *
 * 2. **Fetch pool state**: Get pool immutables, current bin index, position within bin,
 *    and existing bin states (balances and total shares).
 *
 * 3. **Classify each bin**: as below current bin, above current bin, or current bin.
 *
 * 4. **Calculate shares for each bin**:
 *    - If bin has existing liquidity: shares = (targetAmount * totalShares) / binBalance
 *    - If bin is empty: shares = (targetAmount * scaleMultiplier * 1e18) / initialPerShare
 *    - Use ceiling division to avoid under-provisioning
 *
 * 5. **Accumulate token requirements**: Sum up specAmount0 and specAmount1 needed
 *    across all bins. For the current bin, add safety margin to ensure target value.
 *
 * @param publicClient Viem public client for reading blockchain state
 * @param stateViewAddress Address of MetricOmmPoolStateView contract
 * @param poolAddress Address of the MetricOmmPool
 * @param params Distribution parameters
 * @returns Object with deltas array and actual specAmount0/specAmount1 needed
 */
export async function calculateUniformLiquidityDistribution(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  params: CalculateUniformLiquidityParams,
): Promise<{
  deltas: LiquidityDelta[];
  specAmount0: bigint;
  specAmount1: bigint;
}> {
  const {
    amountInTokensPerBin,
    amountIsInToken0,
    currentPrice,
    lowerBin,
    upperBin,
  } = params;

  if (lowerBin > upperBin) {
    throw new Error("lowerBin must be <= upperBin");
  }

  const immutables = await getPoolImmutables(publicClient, poolAddress);
  const slot0 = await getSlot0(publicClient, stateViewAddress, poolAddress);

  const priceX18 = BigInt(Math.round(currentPrice * 1e18));

  const amount0PerBin = amountIsInToken0
    ? amountInTokensPerBin
    : (amountInTokensPerBin * immutables.token1ScaleMultiplier * BigInt(1e18)) /
      (immutables.token0ScaleMultiplier * priceX18);
  const amount1PerBin = amountIsInToken0
    ? (amountInTokensPerBin * immutables.token0ScaleMultiplier * priceX18) /
      (immutables.token1ScaleMultiplier * BigInt(1e18))
    : amountInTokensPerBin;

  const targetPerBinToken1 = amount1PerBin;

  if (amount0PerBin <= 0n)
    throw new Error("small amount results in 0 amount0PerBin");
  if (amount1PerBin <= 0n)
    throw new Error("small amount results in 0 amount1PerBin");

  if (amount0PerBin > MAX_INT104) {
    throw new Error(
      `amount0PerBin (${amount0PerBin}) exceeds int104 max. ` +
        `This can happen when price is very low and amount is specified in token1. ` +
        `Try using a smaller amount or specifying amount in token0.`,
    );
  }
  if (amount1PerBin > MAX_INT104) {
    throw new Error(
      `amount1PerBin (${amount1PerBin}) exceeds int104 max. ` +
        `This can happen when price is very high and amount is specified in token0. ` +
        `Try using a smaller amount or specifying amount in token1.`,
    );
  }

  const curBinIdx = slot0.curBinIdx;
  const curPosInBin = slot0.curPosInBin;

  const binIndices: number[] = [];
  for (let bin = lowerBin; bin <= upperBin; bin++) {
    binIndices.push(bin);
  }

  const binStates = await getBinStatesExternal(
    publicClient,
    stateViewAddress,
    poolAddress,
    binIndices,
  );

  const deltas: LiquidityDelta[] = [];
  let specAmount0 = 0n;
  let specAmount1 = 0n;

  for (let i = 0; i < binIndices.length; i++) {
    const binIdx = binIndices[i];
    const totalShares = binStates.totalShares[i];
    let sharesToAdd: bigint;

    const isBelowBin =
      binIdx < curBinIdx ||
      (binIdx === curBinIdx && curPosInBin === MAX_UINT104);
    const isAboveBin =
      binIdx > curBinIdx || (binIdx === curBinIdx && curPosInBin === 0n);

    if (isBelowBin) {
      if (totalShares >= 1n) {
        const denom = binStates.token1Balances[i] + 1n;
        const numer = amount1PerBin * totalShares;
        sharesToAdd = (numer + denom - 1n) / denom;
        if (sharesToAdd === 0n) sharesToAdd = 1n;
      } else {
        sharesToAdd =
          (amount1PerBin * immutables.token1ScaleMultiplier * BigInt(1e18) +
            immutables.initialScaledToken1PerShareE18 -
            1n) /
          immutables.initialScaledToken1PerShareE18;
        if (sharesToAdd === 0n) sharesToAdd = 1n;
      }
      specAmount1 += amount1PerBin;
    } else if (isAboveBin) {
      if (totalShares >= 1n) {
        const denom = binStates.token0Balances[i] + 1n;
        const numer = amount0PerBin * totalShares;
        sharesToAdd = (numer + denom - 1n) / denom;
        if (sharesToAdd === 0n) sharesToAdd = 1n;
      } else {
        sharesToAdd =
          (amount0PerBin * immutables.token0ScaleMultiplier * BigInt(1e18) +
            immutables.initialScaledToken0PerShareE18 -
            1n) /
          immutables.initialScaledToken0PerShareE18;
        if (sharesToAdd === 0n) sharesToAdd = 1n;
      }
      if (sharesToAdd > MAX_INT104) {
        throw new Error(
          `sharesToAdd (${sharesToAdd}) for bin ${binIdx} exceeds int104 max. ` +
            `The converted amount is too large for this bin. ` +
            `Try using a smaller amount or specifying amount in the token needed by this bin.`,
        );
      }
      specAmount0 += amount0PerBin;
    } else {
      let shares: bigint;
      let amount0: bigint;
      let amount1: bigint;
      if (totalShares >= 1n) {
        const shares0 =
          (amount0PerBin * totalShares) / (binStates.token0Balances[i] + 1n);
        const shares1 =
          (amount1PerBin * totalShares) / (binStates.token1Balances[i] + 1n);
        shares = shares0 > shares1 ? shares0 : shares1;
        amount0 = (shares * binStates.token0Balances[i]) / totalShares;
        amount1 = (shares * binStates.token1Balances[i]) / totalShares;
      } else {
        const token0Portion = MAX_UINT104 - curPosInBin;
        const token1Portion = curPosInBin;

        const shares0 =
          (amount0PerBin *
            immutables.token0ScaleMultiplier *
            BigInt(1e18) *
            token0Portion) /
          (immutables.initialScaledToken0PerShareE18 * MAX_UINT104);
        const shares1 =
          (amount1PerBin *
            immutables.token1ScaleMultiplier *
            BigInt(1e18) *
            token1Portion) /
          (immutables.initialScaledToken1PerShareE18 * MAX_UINT104);
        shares = shares0 > shares1 ? shares0 : shares1;
        amount0 =
          (shares * immutables.initialScaledToken0PerShareE18 * token0Portion) /
          BigInt(1e18);
        amount1 =
          (shares * immutables.initialScaledToken1PerShareE18 * token1Portion) /
          BigInt(1e18);
      }
      const providedValueInToken1 =
        amount1 +
        (amount0 * immutables.token0ScaleMultiplier * priceX18) /
          (immutables.token1ScaleMultiplier * BigInt(1e18));

      if (providedValueInToken1 <= 0n)
        throw new Error("small amount results in 0 providedValueInToken1");

      const numerator = shares * amount1PerBin;
      let sharesToAddCeil =
        (numerator + providedValueInToken1 - 1n) / providedValueInToken1;
      if (sharesToAddCeil === 0n) sharesToAddCeil = 1n;
      sharesToAdd =
        amount0PerBin > sharesToAddCeil ? amount0PerBin : sharesToAddCeil;

      const added0 = (amount0 * sharesToAdd) / shares + 1n;
      const added1 = (amount1 * sharesToAdd) / shares + 1n;
      specAmount0 += added0;
      specAmount1 += added1;

      const providedValueBin =
        added1 +
        (added0 * immutables.token0ScaleMultiplier * priceX18) /
          (immutables.token1ScaleMultiplier * BigInt(1e18));
      const targetValueBin = targetPerBinToken1;
      if (providedValueBin < targetValueBin) {
        const topUp = targetValueBin - providedValueBin;
        specAmount1 += topUp;
      }

      specAmount1 += targetValueBin;
    }

    deltas.push({
      bin: binIdx,
      deltaShares: sharesToAdd,
    });
  }

  return {
    deltas,
    specAmount0,
    specAmount1,
  };
}
