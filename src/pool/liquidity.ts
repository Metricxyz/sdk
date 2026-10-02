/**
 * Shared liquidity types and helpers, plus liquidity removal.
 *
 * **Add liquidity:**
 * - `liquidityAddWeighted.ts` — `buildAddLiquidityWeightedParams` → `encodeAddLiquidityWeighted*Calldata`.
 *   Deposits the most that fits the token caps, calibrated on-chain. Use this from frontends.
 * - `liquidityAddExactShares.ts` — `buildModifyLiquidityArgsForAddition` / `ForUniformAddition`
 *   → `encodeAddLiquidityExactShares*Calldata`. Fixed shares planned off-chain.
 * Both target `addresses.liquidityAdder`; approve token0 and token1 on it for the caps.
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
import { MAX_UINT104, MAX_INT128, LIQUIDITY_ADDER_ABI } from "../constants.js";
import { EMPTY_EXTENSION_DATA } from "../extensions/types.js";
import { MetricOmmPoolAbi } from "../abis/MetricOmmPool.js";
import type { LiquidityDelta, PoolLiquidityDelta } from "../types.js";
import { getPoolImmutables } from "./read.js";
import { getPositionBinSharesRange, getPositionBinSharesForBins } from "../dataProvider/read.js";
import { convertToken0ToToken1, convertToken1ToToken0 } from "../utils/liquidityMath.js";
export { convertToken0ToToken1, convertToken1ToToken0 };
export const getPositionShares = getPositionBinSharesRange;
export const getPositionSharesForBins = getPositionBinSharesForBins;

export function getLiquidityAdderFunction(name: string, inputCount: number) {
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

export type ModifyLiquidityParams = {
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

export type OptionalLiquidityCursorBounds = Partial<LiquidityCursorBounds>;

export function resolveLiquidityCursorBounds(
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

export function validateSpecAmountBufferPercent(specAmountBufferPercent: number): void {
  if (!Number.isFinite(specAmountBufferPercent) || specAmountBufferPercent < 0) {
    throw new Error("specAmountBufferPercent must be a non-negative percent number");
  }
}

export function applySpecAmountBuffer(specAmount: bigint, specAmountBufferPercent: number): bigint {
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

export function toModifyLiquidityArgs(
  preparedModifyLiquidity: ModifyLiquidityParams,
): ModifyLiquidityArgs {
  return [
    preparedModifyLiquidity.salt,
    preparedModifyLiquidity.deltas,
    preparedModifyLiquidity.specAmount0,
    preparedModifyLiquidity.specAmount1,
  ];
}
