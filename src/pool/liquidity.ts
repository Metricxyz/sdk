/**
 * MetricAMM SDK - Liquidity Calculations
 * Functions for calculating liquidity distributions
 */

import type { Address, PublicClient } from "viem";
import { MAX_UINT104, MAX_INT104, MAX_INT128 } from "../constants.js";
import type {
  LiquidityDelta,
  CalculateUniformLiquidityParams,
  CalculateAnyLiquidityParams,
  CalculatedLiquidityDistribution,
} from "../types.js";
import { getPoolImmutables } from "./read.js";
import {
  getSlot0,
  getBinStatesExternal,
  getBinStatesScaled,
} from "../stateView/read.js";

const ONE_E18 = 1_000_000_000_000_000_000n;

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("denominator must be > 0");
  if (numerator < 0n) throw new Error("numerator must be >= 0");
  return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}

function toPriceX18(currentPrice: number): bigint {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    throw new Error("currentPrice must be a positive finite number");
  }
  const priceX18 = BigInt(Math.round(currentPrice * 1e18));
  if (priceX18 <= 0n) {
    throw new Error("currentPrice is too small");
  }
  return priceX18;
}

function convertToken0ToToken1(
  amount0: bigint,
  token0ScaleMultiplier: bigint,
  token1ScaleMultiplier: bigint,
  priceX18: bigint,
): bigint {
  return (
    (amount0 * token0ScaleMultiplier * priceX18) /
    (token1ScaleMultiplier * ONE_E18)
  );
}

function convertToken1ToToken0(
  amount1: bigint,
  token0ScaleMultiplier: bigint,
  token1ScaleMultiplier: bigint,
  priceX18: bigint,
): bigint {
  return (
    (amount1 * token1ScaleMultiplier * ONE_E18) /
    (token0ScaleMultiplier * priceX18)
  );
}

function scaledPositiveDeltaToExternal(
  scaledAmount: bigint,
  scaleMultiplier: bigint,
): bigint {
  return ceilDiv(scaledAmount, scaleMultiplier);
}

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
): Promise<CalculatedLiquidityDistribution> {
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

/**
 * Calculate per-bin liquidity distribution from arbitrary per-bin amounts.
 *
 * Each input entry defines a single bin and a value expressed in token0 or token1.
 * The function computes `deltaShares` for every bin and totals `specAmount0/specAmount1`
 * needed to execute `modifyLiquidity` safely.
 */
export async function calculateAnyLiquidityDistribution(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  params: CalculateAnyLiquidityParams,
): Promise<CalculatedLiquidityDistribution> {
  const { bins, currentPrice } = params;

  if (!Array.isArray(bins)) {
    throw new Error("bins must be an array");
  }
  if (bins.length === 0) {
    return {
      deltas: [],
      specAmount0: 0n,
      specAmount1: 0n,
    };
  }

  const immutables = await getPoolImmutables(publicClient, poolAddress);
  const priceX18 = toPriceX18(currentPrice);

  const targetsByBin = new Map<
    number,
    {
      targetAmount0: bigint;
      targetAmount1: bigint;
      targetValueInToken1: bigint;
    }
  >();

  for (const entry of bins) {
    if (!Number.isInteger(entry.bin)) {
      throw new Error(`bin must be an integer, got ${entry.bin}`);
    }
    if (entry.bin < immutables.lowestBin || entry.bin > immutables.highestBin) {
      throw new Error(
        `bin ${entry.bin} is out of range [${immutables.lowestBin}, ${immutables.highestBin}]`,
      );
    }
    if (entry.amountInToken <= 0n) {
      throw new Error(`amountInToken for bin ${entry.bin} must be > 0`);
    }

    const amount0 = entry.amountInToken0
      ? entry.amountInToken
      : convertToken1ToToken0(
          entry.amountInToken,
          immutables.token0ScaleMultiplier,
          immutables.token1ScaleMultiplier,
          priceX18,
        );
    const amount1 = entry.amountInToken0
      ? convertToken0ToToken1(
          entry.amountInToken,
          immutables.token0ScaleMultiplier,
          immutables.token1ScaleMultiplier,
          priceX18,
        )
      : entry.amountInToken;
    const targetValueInToken1 = entry.amountInToken0
      ? convertToken0ToToken1(
          entry.amountInToken,
          immutables.token0ScaleMultiplier,
          immutables.token1ScaleMultiplier,
          priceX18,
        )
      : entry.amountInToken;

    if (targetsByBin.has(entry.bin)) {
      throw new Error(`duplicate bin ${entry.bin} is not supported`);
    }

    targetsByBin.set(entry.bin, {
      targetAmount0: amount0,
      targetAmount1: amount1,
      targetValueInToken1,
    });
  }

  const binIndices = Array.from(targetsByBin.keys()).sort((a, b) => a - b);
  const [slot0, binStates] = await Promise.all([
    getSlot0(publicClient, stateViewAddress, poolAddress),
    getBinStatesScaled(publicClient, stateViewAddress, poolAddress, binIndices),
  ]);

  const deltas: LiquidityDelta[] = [];
  let specAmount0 = 0n;
  let specAmount1 = 0n;

  const curBinIdx = slot0.curBinIdx;
  const curPosInBin = slot0.curPosInBin;

  for (let i = 0; i < binIndices.length; i++) {
    const binIdx = binIndices[i];
    const target = targetsByBin.get(binIdx);
    if (!target) {
      throw new Error(`internal error: missing target for bin ${binIdx}`);
    }

    const targetAmount0Scaled =
      target.targetAmount0 * immutables.token0ScaleMultiplier;
    const targetAmount1Scaled =
      target.targetAmount1 * immutables.token1ScaleMultiplier;

    const token0BalanceScaled = binStates.token0BalancesScaled[i];
    const token1BalanceScaled = binStates.token1BalancesScaled[i];
    const totalShares = binStates.totalShares[i];

    const isBelowBin =
      binIdx < curBinIdx ||
      (binIdx === curBinIdx && curPosInBin === MAX_UINT104);
    const isAboveBin =
      binIdx > curBinIdx || (binIdx === curBinIdx && curPosInBin === 0n);

    let sharesToAdd = 0n;

    if (isBelowBin) {
      if (targetAmount1Scaled <= 0n) {
        throw new Error(
          `amount for bin ${binIdx} is too small after conversion and results in 0 token1 target`,
        );
      }
      if (totalShares > 0n) {
        if (token1BalanceScaled <= 0n) {
          throw new Error(
            `bin ${binIdx} has zero token1 balance with non-zero shares`,
          );
        }
        sharesToAdd = ceilDiv(
          targetAmount1Scaled * totalShares,
          token1BalanceScaled,
        );
      } else {
        sharesToAdd = ceilDiv(
          targetAmount1Scaled * ONE_E18,
          immutables.initialScaledToken1PerShareE18,
        );
      }
    } else if (isAboveBin) {
      if (targetAmount0Scaled <= 0n) {
        throw new Error(
          `amount for bin ${binIdx} is too small after conversion and results in 0 token0 target`,
        );
      }
      if (totalShares > 0n) {
        if (token0BalanceScaled <= 0n) {
          throw new Error(
            `bin ${binIdx} has zero token0 balance with non-zero shares`,
          );
        }
        sharesToAdd = ceilDiv(
          targetAmount0Scaled * totalShares,
          token0BalanceScaled,
        );
      } else {
        sharesToAdd = ceilDiv(
          targetAmount0Scaled * ONE_E18,
          immutables.initialScaledToken0PerShareE18,
        );
      }
    } else {
      if (totalShares > 0n) {
        const sharesFromToken0 =
          targetAmount0Scaled > 0n
            ? ceilDiv(targetAmount0Scaled * totalShares, token0BalanceScaled)
            : 0n;
        const sharesFromToken1 =
          targetAmount1Scaled > 0n
            ? ceilDiv(targetAmount1Scaled * totalShares, token1BalanceScaled)
            : 0n;
        sharesToAdd =
          sharesFromToken0 > sharesFromToken1
            ? sharesFromToken0
            : sharesFromToken1;
      } else {
        const token0Portion = MAX_UINT104 - curPosInBin;
        const token1Portion = curPosInBin;

        const sharesFromToken0 =
          targetAmount0Scaled > 0n
            ? ceilDiv(
                targetAmount0Scaled * ONE_E18 * MAX_UINT104,
                immutables.initialScaledToken0PerShareE18 * token0Portion,
              )
            : 0n;
        const sharesFromToken1 =
          targetAmount1Scaled > 0n
            ? ceilDiv(
                targetAmount1Scaled * ONE_E18 * MAX_UINT104,
                immutables.initialScaledToken1PerShareE18 * token1Portion,
              )
            : 0n;
        sharesToAdd =
          sharesFromToken0 > sharesFromToken1
            ? sharesFromToken0
            : sharesFromToken1;
      }
    }

    if (sharesToAdd === 0n) {
      sharesToAdd = 1n;
    }

    let amount0ScaledToAdd = 0n;
    let amount1ScaledToAdd = 0n;
    if (sharesToAdd > MAX_INT104) {
      throw new Error(
        `sharesToAdd (${sharesToAdd}) for bin ${binIdx} exceeds int104 max`,
      );
    }

    if (totalShares > 0n) {
      amount0ScaledToAdd = ceilDiv(
        sharesToAdd * token0BalanceScaled,
        totalShares,
      );
      amount1ScaledToAdd = ceilDiv(
        sharesToAdd * token1BalanceScaled,
        totalShares,
      );
    } else if (isBelowBin) {
      amount0ScaledToAdd = 0n;
      amount1ScaledToAdd = ceilDiv(
        sharesToAdd * immutables.initialScaledToken1PerShareE18,
        ONE_E18,
      );
    } else if (isAboveBin) {
      amount0ScaledToAdd = ceilDiv(
        sharesToAdd * immutables.initialScaledToken0PerShareE18,
        ONE_E18,
      );
      amount1ScaledToAdd = 0n;
    } else {
      const token0Portion = MAX_UINT104 - curPosInBin;
      const token1Portion = curPosInBin;

      amount0ScaledToAdd = ceilDiv(
        sharesToAdd * immutables.initialScaledToken0PerShareE18 * token0Portion,
        ONE_E18 * MAX_UINT104,
      );
      amount1ScaledToAdd = ceilDiv(
        sharesToAdd * immutables.initialScaledToken1PerShareE18 * token1Portion,
        ONE_E18 * MAX_UINT104,
      );
    }

    const amount0External = scaledPositiveDeltaToExternal(
      amount0ScaledToAdd,
      immutables.token0ScaleMultiplier,
    );
    const amount1External = scaledPositiveDeltaToExternal(
      amount1ScaledToAdd,
      immutables.token1ScaleMultiplier,
    );

    specAmount0 += amount0External;
    specAmount1 += amount1External;

    if (specAmount0 > MAX_INT128 || specAmount1 > MAX_INT128) {
      throw new Error("specAmount exceeds int128 max");
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

/**
 * Backward-compatible alias with the originally requested misspelled name.
 */
export const calculateAnyLiquididtyDistributinon =
  calculateAnyLiquidityDistribution;
