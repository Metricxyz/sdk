/**
 * Liquidity position builders and calldata encoders.
 *
 * **Add liquidity (recommended path):**
 * 1. `buildModifyLiquidityArgsForAddition` / `ForUniformAddition` / `ForUniformAdditionWithTotalTokenAmount`
 * 2. `buildAddLiquidityExactSharesParamsFromBinTargets` (optional convenience)
 * 3. `encodeAddLiquidityExactSharesSelfCalldata` or `encodeAddLiquidityExactSharesWithOwnerCalldata`
 *    — target `addresses.liquidityAdder`
 * 4. Approve token0 and token1 on the LiquidityAdder for `maxAmountToken0` / `maxAmountToken1`
 *
 * **Self vs WithOwner encoders:**
 * - `*SelfCalldata` — credits liquidity to **`msg.sender`** (the transaction sender owns the position).
 * - `*WithOwnerCalldata` — credits liquidity to **`owner`** (e.g. router, vault, or relayer paying on behalf of a user).
 *   The caller still supplies tokens and must approve the LiquidityAdder; only the position owner differs.
 *
 * **Remove liquidity:** `buildModifyLiquidityArgsForRemoval` → `buildRemoveLiquidityPoolDelta`
 * → `encodeRemoveLiquidityCalldata` — call the **pool** directly (no adder approval).
 *
 * Position identity is `(owner, salt)`; use the same `salt` for adds and removes.
 */

import type { Address, PublicClient, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { MAX_UINT104, MAX_INT104, MAX_INT128, LIQUIDITY_ADDER_ABI } from "../constants.js";
import { EMPTY_EXTENSION_DATA } from "../extensions/types.js";
import { MetricOmmPoolAbi } from "../abis/MetricOmmPool.js";
import type { LiquidityDelta, LiquidityBinValueInput, PoolLiquidityDelta } from "../types.js";
import { getPoolImmutables } from "./read.js";
import { createSnapshotClient } from "../utils/readSnapshot.js";
import {
  getSlot0,
  getBinStatesScaled,
  getPositionBinSharesRange,
  getPositionBinSharesForBins,
} from "../dataProvider/read.js";
import {
  ONE_E18,
  ceilDiv,
  toPriceE18,
  priceX64ToPriceE18,
  convertToken0ToToken1,
  convertToken1ToToken0,
  scaledPositiveDeltaToExternal,
} from "../utils/liquidityMath.js";
export { convertToken0ToToken1, convertToken1ToToken0 };
export const getPositionShares = getPositionBinSharesRange;
export const getPositionSharesForBins = getPositionBinSharesForBins;

function getLiquidityAdderFunction(name: string, inputCount: number) {
  const item = (LIQUIDITY_ADDER_ABI as readonly any[]).find(
    (entry) =>
      entry?.type === "function" && entry?.name === name && entry?.inputs?.length === inputCount,
  );
  if (!item) {
    throw new Error(`LiquidityAdder ABI missing ${name} overload (${inputCount} inputs)`);
  }
  return item;
}

/** High-level removal options (used by UI helpers). Prefer {@link BuildModifyLiquidityArgsForRemovalParams} in SDK code. */
export interface RemoveLiquidityParams {
  /** Percent of each selected bin's shares to burn (0–100). */
  percentageToRemove: number;
  /** Explicit bin list; when omitted, scans `lowerBin`–`upperBin` for position shares. */
  bins?: number[];
  lowerBin?: number;
  upperBin?: number;
}

/** Per-bin removal: specify exactly one of `percentageToRemove` or `sharesToRemove`. */
export interface BinRemovalSpec {
  bin: number;
  percentageToRemove?: number;
  sharesToRemove?: bigint;
}

/**
 * Sentinel passed as `specAmount0` / `specAmount1` on removals — no minimum output enforced.
 * Same value the pool uses for "accept any amount" on `modifyLiquidity` removes.
 */
export const NO_SLIPPAGE_LIMIT = MAX_INT128;

type ModifyLiquidityParams = {
  salt: bigint;
  deltas: LiquidityDelta[];
  specAmount0: bigint;
  specAmount1: bigint;
};

/**
 * Tuple for low-level `modifyLiquidity` on the pool:
 * `[salt, deltas, specAmount0, specAmount1]`.
 * Prefer LiquidityAdder encode helpers for additions.
 */
export type ModifyLiquidityArgs = readonly [bigint, LiquidityDelta[], bigint, bigint];

export interface BuildModifyLiquidityArgsBase {
  publicClient: PublicClient;
  /** MetricOmmPoolDataProvider (`addresses.dataProvider`). */
  dataProviderAddress: Address;
  poolAddress: Address;
  /** Extra headroom on spec amounts (percent); `0` = exact computed caps. */
  specAmountBufferPercent?: number;
}

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

/** Split a total token budget across `bins` (optional `weights`); calibrates share scaling on-chain. */
export interface BuildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmountParams extends BuildModifyLiquidityArgsWithFactory {
  bins: number[];
  weights?: number[];
  totalValueToAddInToken: bigint;
  totalValueInToken0: boolean;
  currentPriceX64: bigint;
  salt?: bigint;
}

/** Remove the same percentage from all bins with liquidity (or from explicit `bins`). */
export interface BuildModifyLiquidityArgsForPercentageRemovalParams extends BuildModifyLiquidityArgsBase {
  owner: Address;
  salt: bigint;
  percentageToRemove: number;
  bins?: number[];
  /** Defaults to the pool's actual `lowestBin`/`highestBin` (via `getPoolImmutables`) when omitted. */
  lowerBin?: number;
  upperBin?: number;
}

/** Granular per-bin removal specs. */
export interface BuildModifyLiquidityArgsForRemovalParams extends BuildModifyLiquidityArgsBase {
  owner: Address;
  salt: bigint;
  specs: BinRemovalSpec[];
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
 * Prepare uniform liquidity across arbitrary bins from a TOTAL value budget.
 *
 * Algorithm:
 * 1. Read one block snapshot and calibrate weighted per-bin targets with zero buffer.
 * 2. Scale targets toward totalValueToAddInToken.
 * 3. Rebuild shares, reducing targets if rounding or the requested buffer exceeds
 *    the source budget. The returned source spec, including buffer, never exceeds
 *    totalValueToAddInToken; the opposite token is not budget-constrained.
 */
export async function buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount({
  publicClient,
  factoryAddress,
  dataProviderAddress,
  poolAddress,
  bins,
  weights,
  totalValueToAddInToken,
  totalValueInToken0,
  currentPriceX64,
  salt = 0n,
  specAmountBufferPercent = 0,
}: BuildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmountParams): Promise<ModifyLiquidityArgs> {
  validateSpecAmountBufferPercent(specAmountBufferPercent);

  if (!Array.isArray(bins) || bins.length === 0) {
    throw new Error("bins must be a non-empty array");
  }
  if (weights != null) {
    if (!Array.isArray(weights) || weights.length !== bins.length) {
      throw new Error("weights must be an array with the same length as bins");
    }
  }
  const uniqueBins = new Set(bins);
  if (uniqueBins.size !== bins.length) {
    throw new Error("bins must not contain duplicates");
  }
  if (totalValueToAddInToken <= 0n) {
    throw new Error("totalValueToAddInToken must be > 0");
  }
  if (currentPriceX64 <= 0n) {
    throw new Error("currentPriceX64 must be > 0");
  }

  publicClient = await createSnapshotClient(publicClient);

  const calibrationValue = totalValueToAddInToken / BigInt(bins.length) + 1n;
  const calibrationTargets: bigint[] = weights
    ? weights.map((w) => (calibrationValue * BigInt(Math.ceil(w * 1e6) + 1)) / 1_000_000n)
    : Array(bins.length).fill(calibrationValue);

  const calibrationBins: LiquidityBinValueInput[] = bins.map((bin, i) => ({
    bin,
    targetValueInToken: calibrationTargets[i],
    targetValueInToken0: totalValueInToken0,
  }));

  const [, , calibrationSpecAmount0, calibrationSpecAmount1] =
    await buildModifyLiquidityArgsForAddition({
      publicClient,
      factoryAddress,
      dataProviderAddress,
      poolAddress,
      bins: calibrationBins,
      currentPriceX64,
      salt,
      specAmountBufferPercent: 0,
    });

  const calibrationSpecAmount = totalValueInToken0
    ? calibrationSpecAmount0
    : calibrationSpecAmount1;

  if (calibrationSpecAmount <= 0n) {
    throw new Error("failed to calibrate uniform total amount scaling: specAmount is zero");
  }

  // Include requested cap headroom in the source budget, even for large buffers.
  const bufferMultiplier = applySpecAmountBuffer(ONE_E18, specAmountBufferPercent);
  let target = (totalValueToAddInToken * ONE_E18) / bufferMultiplier;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scaledBins: LiquidityBinValueInput[] = bins.map((bin, i) => ({
      bin,
      targetValueInToken: (calibrationTargets[i] * target) / calibrationSpecAmount,
      targetValueInToken0: totalValueInToken0,
    }));

    const result = await buildModifyLiquidityArgsForAddition({
      publicClient,
      factoryAddress,
      dataProviderAddress,
      poolAddress,
      bins: scaledBins,
      currentPriceX64,
      salt,
      specAmountBufferPercent,
    });
    const sourceSpec = result[totalValueInToken0 ? 2 : 3];
    if (sourceSpec <= totalValueToAddInToken) return result;

    // Rebuild actual shares, never clip a cap that the shares still require.
    // Leave one correction of headroom for discrete rounding on the next pass.
    const excess = sourceSpec - totalValueToAddInToken;
    const correction = ceilDiv(target * excess, sourceSpec);
    target -= correction * 2n + 1n;
    if (target <= 0n) break;
  }

  throw new Error("Liquidity amount is too small after conversion to fit the selected bins");
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
 * Remove liquidity by explicit per-bin specs (percentage or absolute shares).
 *
 * `specAmount0` / `specAmount1` are set to {@link NO_SLIPPAGE_LIMIT} (accept any output).
 */
export async function buildModifyLiquidityArgsForRemoval(
  params: BuildModifyLiquidityArgsForRemovalParams,
): Promise<ModifyLiquidityArgs> {
  const {
    publicClient,
    dataProviderAddress,
    poolAddress,
    owner,
    salt,
    specs,
    specAmountBufferPercent = 0,
  } = params;
  validateSpecAmountBufferPercent(specAmountBufferPercent);

  if (specs.length === 0) {
    return [salt, [], NO_SLIPPAGE_LIMIT, NO_SLIPPAGE_LIMIT];
  }

  for (const spec of specs) {
    if (spec.percentageToRemove != null && spec.sharesToRemove != null) {
      throw new Error(
        `Bin ${spec.bin}: specify either percentageToRemove or sharesToRemove, not both`,
      );
    }
    if (spec.percentageToRemove == null && spec.sharesToRemove == null) {
      throw new Error(`Bin ${spec.bin}: must specify either percentageToRemove or sharesToRemove`);
    }
    if (
      spec.percentageToRemove != null &&
      (spec.percentageToRemove <= 0 || spec.percentageToRemove > 100)
    ) {
      throw new Error(`Bin ${spec.bin}: percentageToRemove must be between 0 and 100`);
    }
  }

  const binIndices = specs.map((s) => s.bin);
  const positionShares = await getPositionBinSharesForBins(
    publicClient,
    dataProviderAddress,
    poolAddress,
    owner,
    salt,
    binIndices,
  );

  const sharesMap = new Map(positionShares.map((p) => [p.binIdx, p.shares]));
  const deltas: LiquidityDelta[] = [];

  for (const spec of specs) {
    const currentShares = sharesMap.get(spec.bin) ?? 0n;
    if (currentShares === 0n) continue;

    let sharesToRemove: bigint;

    if (spec.sharesToRemove != null) {
      sharesToRemove = spec.sharesToRemove > currentShares ? currentShares : spec.sharesToRemove;
    } else {
      sharesToRemove =
        spec.percentageToRemove === 100
          ? currentShares
          : (currentShares * BigInt(Math.floor(spec.percentageToRemove! * 100))) / 10000n;
    }

    if (sharesToRemove > 0n) {
      deltas.push({
        bin: spec.bin,
        deltaShares: -sharesToRemove,
      });
    }
  }

  const computed: ModifyLiquidityParams = {
    salt,
    deltas,
    specAmount0: applySpecAmountBuffer(NO_SLIPPAGE_LIMIT, specAmountBufferPercent),
    specAmount1: applySpecAmountBuffer(NO_SLIPPAGE_LIMIT, specAmountBufferPercent),
  };

  return toModifyLiquidityArgs(computed);
}

/**
 * Remove the same `percentageToRemove` from every bin that has position shares.
 * When `bins` is omitted, discovers bins via `getPositionBinSharesRange(lowerBin, upperBin)`.
 * `lowerBin`/`upperBin` default to the pool's actual configured `lowestBin`/`highestBin` (read
 * via `getPoolImmutables`) rather than a fixed guess — a position outside a hardcoded window
 * would otherwise be silently left partially withdrawn with no error.
 */
export async function buildModifyLiquidityArgsForPercentageRemoval({
  publicClient,
  dataProviderAddress,
  poolAddress,
  owner,
  salt,
  percentageToRemove,
  bins,
  lowerBin,
  upperBin,
  specAmountBufferPercent = 0,
}: BuildModifyLiquidityArgsForPercentageRemovalParams): Promise<ModifyLiquidityArgs> {
  validateSpecAmountBufferPercent(specAmountBufferPercent);

  if (percentageToRemove <= 0 || percentageToRemove > 100) {
    throw new Error("percentageToRemove must be between 0 and 100");
  }

  let binsWithShares: number[];
  if (bins) {
    binsWithShares = bins;
  } else {
    let scanLowerBin = lowerBin;
    let scanUpperBin = upperBin;
    if (scanLowerBin === undefined || scanUpperBin === undefined) {
      // getPoolImmutables reads getImmutables() straight from the pool; its factoryAddress
      // param is unused, so there's no real factory address to pass here.
      const immutables = await getPoolImmutables(publicClient, poolAddress, poolAddress);
      scanLowerBin ??= immutables.lowestBin;
      scanUpperBin ??= immutables.highestBin;
    }
    binsWithShares = (
      await getPositionBinSharesRange(
        publicClient,
        dataProviderAddress,
        poolAddress,
        owner,
        salt,
        scanLowerBin,
        scanUpperBin,
      )
    ).map((p) => p.binIdx);
  }

  if (binsWithShares.length === 0) {
    return [salt, [], NO_SLIPPAGE_LIMIT, NO_SLIPPAGE_LIMIT];
  }

  const specs: BinRemovalSpec[] = binsWithShares.map((bin) => ({
    bin,
    percentageToRemove,
  }));

  return buildModifyLiquidityArgsForRemoval({
    publicClient,
    dataProviderAddress,
    poolAddress,
    owner,
    salt,
    specs,
    specAmountBufferPercent,
  });
}

/** Convert positive `deltaShares` from a modify plan into `PoolLiquidityDelta` for the adder. */
export function additionPlanToPoolLiquidityDelta(
  deltas: readonly LiquidityDelta[],
): PoolLiquidityDelta {
  const pos = deltas.filter((d) => d.deltaShares > 0n).sort((a, b) => a.bin - b.bin);
  return {
    binIdxs: pos.map((d) => BigInt(d.bin)),
    shares: pos.map((d) => d.deltaShares),
  };
}

/** Convert negative `deltaShares` from a modify plan into burn `PoolLiquidityDelta` for `removeLiquidity`. */
export function removalPlanToPoolLiquidityDelta(
  deltas: readonly LiquidityDelta[],
): PoolLiquidityDelta {
  const burn = deltas.filter((d) => d.deltaShares < 0n).sort((a, b) => a.bin - b.bin);
  return {
    binIdxs: burn.map((d) => BigInt(d.bin)),
    shares: burn.map((d) => -d.deltaShares),
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
 * Cursor bounds that disable the on-chain cursor check entirely (matches on-chain test
 * helpers). For `addLiquidityWeighted*`, this also disables the LP-sandwich protection
 * the bounds exist for (see {@link encodeAddLiquidityWeightedSelfCalldata}) — only pass
 * this explicitly if that protection is genuinely not wanted. Prefer
 * {@link prepareLiquidityCursorBounds} for a live, tight bound instead.
 */
export const UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS = {
  minimalCurBin: -32768,
  minimalPosition: 0n,
  maximalCurBin: 32767,
  maximalPosition: MAX_UINT104,
} as const;

export type LiquidityCursorBounds = {
  minimalCurBin: number;
  minimalPosition: bigint;
  maximalCurBin: number;
  maximalPosition: bigint;
};

type OptionalLiquidityCursorBounds = Partial<LiquidityCursorBounds>;

function resolveLiquidityCursorBounds(
  bounds: OptionalLiquidityCursorBounds,
): LiquidityCursorBounds {
  return {
    minimalCurBin: bounds.minimalCurBin ?? UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS.minimalCurBin,
    minimalPosition:
      bounds.minimalPosition ?? UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS.minimalPosition,
    maximalCurBin: bounds.maximalCurBin ?? UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS.maximalCurBin,
    maximalPosition:
      bounds.maximalPosition ?? UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS.maximalPosition,
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

/**
 * Encode `Pool.removeLiquidity(owner, salt, deltas, extensionData)`.
 * Send to the **pool** contract; no token approval required (tokens are sent out).
 */
export function encodeRemoveLiquidityCalldata(params: {
  owner: Address;
  salt: bigint;
  deltas: PoolLiquidityDelta;
  extensionData?: Hex;
}): Hex {
  return encodeFunctionData({
    abi: MetricOmmPoolAbi,
    functionName: "removeLiquidity",
    args: [
      params.owner,
      params.salt,
      { binIdxs: [...params.deltas.binIdxs], shares: [...params.deltas.shares] },
      params.extensionData ?? EMPTY_EXTENSION_DATA,
    ],
  });
}

/** Build `{ salt, poolLiquidityDelta }` for {@link encodeRemoveLiquidityCalldata}. */
export async function buildRemoveLiquidityPoolDelta(
  params: BuildModifyLiquidityArgsForRemovalParams,
): Promise<{ salt: bigint; poolLiquidityDelta: PoolLiquidityDelta }> {
  const [salt, deltas] = await buildModifyLiquidityArgsForRemoval(params);
  return { salt, poolLiquidityDelta: removalPlanToPoolLiquidityDelta(deltas) };
}

function validateSpecAmountBufferPercent(specAmountBufferPercent: number): void {
  if (!Number.isFinite(specAmountBufferPercent) || specAmountBufferPercent < 0) {
    throw new Error("specAmountBufferPercent must be a non-negative percent number");
  }
}

function applySpecAmountBuffer(specAmount: bigint, specAmountBufferPercent: number): bigint {
  if (specAmountBufferPercent === 0 || specAmount === NO_SLIPPAGE_LIMIT) {
    return specAmount;
  }

  const bufferRatio = specAmountBufferPercent / 100;

  if (specAmount > 0n) {
    const multiplier = BigInt(Math.floor((1 + bufferRatio) * 1e18));
    return (specAmount * multiplier) / BigInt(1e18);
  }

  if (specAmount < 0n) {
    const multiplier = BigInt(Math.floor((1 - bufferRatio) * 1e18));
    if (multiplier <= 0n) {
      return 0n;
    }
    return (specAmount * multiplier) / BigInt(1e18);
  }

  return specAmount;
}

function toModifyLiquidityArgs(
  preparedModifyLiquidity: ModifyLiquidityParams,
): ModifyLiquidityArgs {
  return [
    preparedModifyLiquidity.salt,
    preparedModifyLiquidity.deltas,
    preparedModifyLiquidity.specAmount0,
    preparedModifyLiquidity.specAmount1,
  ];
}
