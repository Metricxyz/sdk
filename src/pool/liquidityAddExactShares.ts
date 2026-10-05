/**
 * Exact-shares liquidity adds: compute per-bin `deltaShares` and token caps off-chain from
 * per-bin target amounts, then send `LiquidityAdder.addLiquidityExactShares`.
 * The plan is fixed at build time, so caps can fail if pool state moves before execution.
 * Frontends adding from wallet amounts should use `liquidityAddWeighted.ts` instead.
 */

import type { Address, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { MAX_UINT104, MAX_INT104, MAX_INT128 } from "../constants.js";
import { EMPTY_EXTENSION_DATA } from "../extensions/types.js";
import type { LiquidityDelta, LiquidityBinValueInput, PoolLiquidityDelta } from "../types.js";
import { getPoolImmutables } from "./read.js";
import { getSlot0, getBinStatesScaled } from "../dataProvider/read.js";
import {
  ONE_E18,
  ceilDiv,
  toPriceE18,
  priceX64ToPriceE18,
  convertToken0ToToken1,
  convertToken1ToToken0,
  scaledPositiveDeltaToExternal,
} from "../utils/liquidityMath.js";
import {
  additionPlanToPoolLiquidityDelta,
  applySpecAmountBuffer,
  getLiquidityAdderFunction,
  resolveLiquidityCursorBounds,
  toModifyLiquidityArgs,
  validateSpecAmountBufferPercent,
  type BuildModifyLiquidityArgsBase,
  type ModifyLiquidityArgs,
  type ModifyLiquidityParams,
  type OptionalLiquidityCursorBounds,
} from "./liquidity.js";

/** Addition builders need the factory to read pool immutables (decimals, bin range). */
export interface BuildModifyLiquidityArgsWithFactory extends BuildModifyLiquidityArgsBase {
  factoryAddress: Address;
}

/** Per-bin target amounts for {@link buildModifyLiquidityArgsForAddition}. */
export interface BuildModifyLiquidityArgsForAdditionParams extends BuildModifyLiquidityArgsWithFactory {
  bins: LiquidityBinValueInput[];
  /** Human price token1/token0; omit when `currentPriceX64` is set. */
  currentPrice?: number;
  /** Q64.64 price from slot0; preferred over `currentPrice`. */
  currentPriceX64?: bigint;
  /** Position salt; default `0n`. Reuse across adds to the same position. */
  salt?: bigint;
}

/** Same value in every bin from `lowerBin` through `upperBin` inclusive. */
export interface BuildModifyLiquidityArgsForUniformAdditionParams extends BuildModifyLiquidityArgsWithFactory {
  amountInTokensPerBin: bigint;
  amountIsInToken0: boolean;
  currentPrice: number;
  lowerBin: number;
  upperBin: number;
  salt?: bigint;
}

function resolvePriceE18(params: { currentPrice?: number; currentPriceX64?: bigint }): bigint {
  if (params.currentPriceX64 != null) {
    return priceX64ToPriceE18(params.currentPriceX64);
  }
  if (params.currentPrice != null) {
    return toPriceE18(params.currentPrice);
  }
  throw new Error("currentPrice or currentPriceX64 is required");
}

/**
 * Uniform liquidity: same token amount in every bin from `lowerBin` to `upperBin`.
 * Delegates to {@link buildModifyLiquidityArgsForAddition}.
 *
 * @returns `[salt, deltas, specAmount0, specAmount1]` — max token caps for the adder.
 */
export async function buildModifyLiquidityArgsForUniformAddition({
  publicClient,
  factoryAddress,
  dataProviderAddress,
  poolAddress,
  amountInTokensPerBin,
  amountIsInToken0,
  currentPrice,
  lowerBin,
  upperBin,
  salt = 0n,
  specAmountBufferPercent = 0,
}: BuildModifyLiquidityArgsForUniformAdditionParams): Promise<ModifyLiquidityArgs> {
  if (lowerBin > upperBin) {
    throw new Error("lowerBin must be <= upperBin");
  }

  const bins: LiquidityBinValueInput[] = [];
  for (let bin = lowerBin; bin <= upperBin; bin++) {
    bins.push({
      bin,
      targetValueInToken: amountInTokensPerBin,
      targetValueInToken0: amountIsInToken0,
    });
  }

  return buildModifyLiquidityArgsForAddition({
    publicClient,
    factoryAddress,
    dataProviderAddress,
    poolAddress,
    bins,
    currentPrice,
    salt,
    specAmountBufferPercent,
  });
}

/**
 * Prepare per-bin liquidity distribution from arbitrary per-bin amounts.
 *
 * Each input entry defines a single bin and a value expressed in token0 or token1.
 * The function computes `deltaShares` for every bin and totals `specAmount0/specAmount1`
 * needed to execute `modifyLiquidity` safely.
 *
 * ## Algorithm Overview
 *
 * This is the core distribution engine used by both:
 * - direct per-bin plans (computeModifyLiquidityForAddition)
 * - uniform plans via adapter (computeModifyLiquidityForUniformAddition)
 *
 * ## Steps
 *
 * 1. Validate inputs, price, bin range, and reject duplicate bins.
 * 2. Convert each bin target into both token0/token1 amounts using current price.
 * 3. Fetch slot0 and bin states, then classify each bin as below/current/above.
 * 4. Compute shares to add using ceiling division to avoid under-provisioning:
 *    - Existing bins: proportional to current scaled balances and total shares.
 *    - Empty bins: derived from initial scaled per-share constants.
 * 5. Convert scaled amounts back to external token amounts and accumulate
 *    `specAmount0/specAmount1` with overflow checks.
 */
export async function buildModifyLiquidityArgsForAddition({
  publicClient,
  factoryAddress,
  dataProviderAddress,
  poolAddress,
  bins,
  currentPrice,
  currentPriceX64,
  salt = 0n,
  specAmountBufferPercent = 0,
}: BuildModifyLiquidityArgsForAdditionParams): Promise<ModifyLiquidityArgs> {
  validateSpecAmountBufferPercent(specAmountBufferPercent);

  if (!Array.isArray(bins)) {
    throw new Error("bins must be an array");
  }
  if (bins.length === 0) {
    return [salt, [], 0n, 0n];
  }

  const immutables = await getPoolImmutables(publicClient, factoryAddress, poolAddress);
  const priceE18 = resolvePriceE18({ currentPrice, currentPriceX64 });

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
    if (entry.targetValueInToken <= 0n) {
      throw new Error(`amountInToken for bin ${entry.bin} must be > 0`);
    }

    const amount0 = entry.targetValueInToken0
      ? entry.targetValueInToken
      : convertToken1ToToken0(
          entry.targetValueInToken,
          immutables.token0ScaleMultiplier,
          immutables.token1ScaleMultiplier,
          priceE18,
        );
    const amount1 = entry.targetValueInToken0
      ? convertToken0ToToken1(
          entry.targetValueInToken,
          immutables.token0ScaleMultiplier,
          immutables.token1ScaleMultiplier,
          priceE18,
        )
      : entry.targetValueInToken;
    const targetValueInToken1 = entry.targetValueInToken0
      ? convertToken0ToToken1(
          entry.targetValueInToken,
          immutables.token0ScaleMultiplier,
          immutables.token1ScaleMultiplier,
          priceE18,
        )
      : entry.targetValueInToken;

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
    getSlot0(publicClient, dataProviderAddress, poolAddress),
    getBinStatesScaled(publicClient, dataProviderAddress, poolAddress, binIndices),
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

    const targetAmount0Scaled = target.targetAmount0 * immutables.token0ScaleMultiplier;
    const targetAmount1Scaled = target.targetAmount1 * immutables.token1ScaleMultiplier;

    const targetValueInToken1Scaled = target.targetValueInToken1 * immutables.token1ScaleMultiplier;

    const token0BalanceScaled = binStates.token0BalancesScaled[i];
    const token1BalanceScaled = binStates.token1BalancesScaled[i];
    const totalShares = binStates.totalShares[i];

    const isBelowBin = binIdx < curBinIdx || (binIdx === curBinIdx && curPosInBin === MAX_UINT104);
    const isAboveBin = binIdx > curBinIdx || (binIdx === curBinIdx && curPosInBin === 0n);

    let sharesToAdd: bigint;

    if (isBelowBin) {
      if (targetAmount1Scaled <= 0n) {
        throw new Error(
          `amount for bin ${binIdx} is too small after conversion and results in 0 token1 target`,
        );
      }
      if (totalShares > 0n) {
        if (token1BalanceScaled <= 0n) {
          throw new Error(`bin ${binIdx} has zero token1 balance with non-zero shares`);
        }
        sharesToAdd = ceilDiv(targetAmount1Scaled * totalShares, token1BalanceScaled);
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
          throw new Error(`bin ${binIdx} has zero token0 balance with non-zero shares`);
        }
        sharesToAdd = ceilDiv(targetAmount0Scaled * totalShares, token0BalanceScaled);
      } else {
        sharesToAdd = ceilDiv(
          targetAmount0Scaled * ONE_E18,
          immutables.initialScaledToken0PerShareE18,
        );
      }
    } else {
      if (totalShares > 0n) {
        const totalValueInToken1Scaled =
          token1BalanceScaled + convertToken0ToToken1(token0BalanceScaled, 1n, 1n, priceE18);

        sharesToAdd = (targetValueInToken1Scaled * totalShares) / totalValueInToken1Scaled;
      } else {
        const token0Portion = MAX_UINT104 - curPosInBin;
        const token1Portion = curPosInBin;

        sharesToAdd =
          (targetValueInToken1Scaled * ONE_E18) /
          ((immutables.initialScaledToken1PerShareE18 * token1Portion +
            (immutables.initialScaledToken0PerShareE18 * token0Portion * priceE18) / ONE_E18) /
            MAX_UINT104);
      }
    }

    if (sharesToAdd === 0n) {
      sharesToAdd = 1n;
    }

    if (sharesToAdd > MAX_INT104) {
      throw new Error(`sharesToAdd (${sharesToAdd}) for bin ${binIdx} exceeds int104 max`);
    }

    const [amount0ScaledToAdd, amount1ScaledToAdd] =
      totalShares > 0n
        ? [
            ceilDiv(sharesToAdd * token0BalanceScaled, totalShares),
            ceilDiv(sharesToAdd * token1BalanceScaled, totalShares),
          ]
        : isBelowBin
          ? [0n, ceilDiv(sharesToAdd * immutables.initialScaledToken1PerShareE18, ONE_E18)]
          : isAboveBin
            ? [ceilDiv(sharesToAdd * immutables.initialScaledToken0PerShareE18, ONE_E18), 0n]
            : (() => {
                const token0Portion = MAX_UINT104 - curPosInBin;
                const token1Portion = curPosInBin;
                return [
                  ceilDiv(
                    sharesToAdd * immutables.initialScaledToken0PerShareE18 * token0Portion,
                    ONE_E18 * MAX_UINT104,
                  ),
                  ceilDiv(
                    sharesToAdd * immutables.initialScaledToken1PerShareE18 * token1Portion,
                    ONE_E18 * MAX_UINT104,
                  ),
                ] as const;
              })();

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

  const computed: ModifyLiquidityParams = {
    salt,
    deltas,
    specAmount0: applySpecAmountBuffer(specAmount0, specAmountBufferPercent),
    specAmount1: applySpecAmountBuffer(specAmount1, specAmountBufferPercent),
  };

  return toModifyLiquidityArgs(computed);
}

/**
 * Convenience wrapper: bin targets → adder-ready `{ salt, poolLiquidityDelta, maxAmountToken0, maxAmountToken1 }`.
 *
 * @example
 * ```ts
 * const add = await buildAddLiquidityExactSharesParamsFromBinTargets({
 *   publicClient, factoryAddress, dataProviderAddress, poolAddress,
 *   bins: [{ bin: 0, targetValueInToken: parseUnits("100", 6), targetValueInToken0: false }],
 *   currentPriceX64: slot0.priceX64,
 * });
 * const data = encodeAddLiquidityExactSharesSelfCalldata({ pool: poolAddress, ...add });
 * ```
 */
export async function buildAddLiquidityExactSharesParamsFromBinTargets(
  params: BuildModifyLiquidityArgsForAdditionParams,
): Promise<{
  salt: bigint;
  poolLiquidityDelta: PoolLiquidityDelta;
  maxAmountToken0: bigint;
  maxAmountToken1: bigint;
}> {
  const [salt, deltas, max0, max1] = await buildModifyLiquidityArgsForAddition(params);
  return {
    salt,
    poolLiquidityDelta: additionPlanToPoolLiquidityDelta(deltas),
    maxAmountToken0: max0,
    maxAmountToken1: max1,
  };
}

/**
 * Encode `LiquidityAdder.addLiquidityExactShares` for the transaction sender.
 *
 * Creates or increases the position `(msg.sender, salt)` — liquidity is credited to whoever
 * sends the transaction. Approve both pool tokens on the LiquidityAdder before sending.
 */
export function encodeAddLiquidityExactSharesSelfCalldata(
  params: {
    pool: Address;
    salt: bigint;
    deltas: PoolLiquidityDelta;
    maxAmountToken0: bigint;
    maxAmountToken1: bigint;
    extensionData?: Hex;
  } & OptionalLiquidityCursorBounds,
): Hex {
  const bounds = resolveLiquidityCursorBounds(params);
  return encodeFunctionData({
    abi: [getLiquidityAdderFunction("addLiquidityExactShares", 7)],
    functionName: "addLiquidityExactShares",
    args: [
      params.pool,
      params.salt,
      { binIdxs: [...params.deltas.binIdxs], shares: [...params.deltas.shares] },
      params.maxAmountToken0,
      params.maxAmountToken1,
      bounds,
      params.extensionData ?? EMPTY_EXTENSION_DATA,
    ],
  });
}

/**
 * Encode `LiquidityAdder.addLiquidityExactShares` for an explicit position owner.
 *
 * Creates or increases the position `(owner, salt)` while `msg.sender` pays for the deposit
 * (e.g. router, vault, or meta-transaction relayer acting on behalf of `owner`).
 * Approve both pool tokens on the LiquidityAdder before sending.
 */
export function encodeAddLiquidityExactSharesWithOwnerCalldata(
  params: {
    pool: Address;
    owner: Address;
    salt: bigint;
    deltas: PoolLiquidityDelta;
    maxAmountToken0: bigint;
    maxAmountToken1: bigint;
    extensionData?: Hex;
  } & OptionalLiquidityCursorBounds,
): Hex {
  const bounds = resolveLiquidityCursorBounds(params);
  return encodeFunctionData({
    abi: [getLiquidityAdderFunction("addLiquidityExactShares", 8)],
    functionName: "addLiquidityExactShares",
    args: [
      params.pool,
      params.owner,
      params.salt,
      { binIdxs: [...params.deltas.binIdxs], shares: [...params.deltas.shares] },
      params.maxAmountToken0,
      params.maxAmountToken1,
      bounds,
      params.extensionData ?? EMPTY_EXTENSION_DATA,
    ],
  });
}
