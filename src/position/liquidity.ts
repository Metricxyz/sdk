/**
 * MetricAMM SDK - Liquidity Position Functions
 * Functions for managing liquidity positions directly on the pool
 */

import type { Address, PublicClient, WalletClient, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { POOL_ABI, MAX_INT128 } from "../constants.js";
import { MetricOmmPoolAbi } from "../abis/MetricOmmPool.js";
import type { LiquidityDelta } from "../types.js";
import {
  getPositionBinSharesRange,
  getPositionBinSharesForBins,
} from "../stateView/read.js";

export {
  getPositionBinSharesRange as getPositionShares,
  getPositionBinSharesForBins as getPositionSharesForBins,
};

/**
 * Max int128 value for disabling slippage protection
 */
export const NO_SLIPPAGE_LIMIT = MAX_INT128;

/**
 * Prepared transaction data for modifyLiquidity
 */
export interface PreparedModifyLiquidity {
  /** Encoded calldata */
  data: Hex;
  /** Function arguments for reference */
  args: {
    salt: bigint;
    deltas: LiquidityDelta[];
    specAmount0: bigint;
    specAmount1: bigint;
  };
}

/**
 * Apply buffer percentage to specAmount values.
 * Increases positive amounts (for adding liquidity) and keeps negative amounts unchanged.
 */
function applySpecAmountBuffer(
  specAmount: bigint,
  bufferPercent: number,
): bigint {
  if (bufferPercent === 0 || specAmount === NO_SLIPPAGE_LIMIT) {
    return specAmount;
  }
  // Only apply buffer to positive amounts (adding liquidity)
  if (specAmount > 0n) {
    // bufferPercent is a decimal, e.g. 0.01 = 1%
    const multiplier = BigInt(Math.floor((1 + bufferPercent) * 1e18));
    return (specAmount * multiplier) / BigInt(1e18);
  }
  return specAmount;
}

/**
 * Prepare modifyLiquidity transaction calldata without sending.
 *
 * Use this when you want to build the transaction yourself,
 * use multicall, or inspect the calldata before sending.
 *
 * @param salt - Unique identifier for the position (80 bits)
 * @param deltas - Array of bin/shares changes (positive to add, negative to remove)
 * @param specAmount0 - Slippage protection for token0 (use NO_SLIPPAGE_LIMIT to disable)
 * @param specAmount1 - Slippage protection for token1 (use NO_SLIPPAGE_LIMIT to disable)
 * @param specAmountBufferPercent - Optional buffer percentage to add to specAmounts (default 0, e.g. 0.01 = 1%)
 * @returns Prepared transaction data with calldata
 *
 * @example
 * const prepared = prepareModifyLiquidityCalldata(
 *   0n,
 *   [{ bin: 0, deltaShares: 1000n }],
 *   NO_SLIPPAGE_LIMIT,
 *   NO_SLIPPAGE_LIMIT
 * );
 * // Use prepared.data to send the transaction to the pool address
 */
export function prepareModifyLiquidityCalldata(
  salt: bigint,
  deltas: LiquidityDelta[],
  specAmount0: bigint = NO_SLIPPAGE_LIMIT,
  specAmount1: bigint = NO_SLIPPAGE_LIMIT,
  specAmountBufferPercent: number = 0,
): PreparedModifyLiquidity {
  const bufferedSpecAmount0 = applySpecAmountBuffer(
    specAmount0,
    specAmountBufferPercent,
  );
  const bufferedSpecAmount1 = applySpecAmountBuffer(
    specAmount1,
    specAmountBufferPercent,
  );

  const data = encodeFunctionData({
    abi: MetricOmmPoolAbi,
    functionName: "modifyLiquidity",
    args: [salt, deltas, bufferedSpecAmount0, bufferedSpecAmount1],
  });

  return {
    data,
    args: {
      salt,
      deltas,
      specAmount0: bufferedSpecAmount0,
      specAmount1: bufferedSpecAmount1,
    },
  };
}

/**
 * Add or remove liquidity from a pool position.
 *
 * Submits a modifyLiquidity transaction and waits for confirmation.
 *
 * @param publicClient - Viem public client
 * @param walletClient - Viem wallet client
 * @param poolAddress - Pool contract address
 * @param salt - Unique identifier for the position (80 bits)
 * @param deltas - Array of bin/shares changes (positive to add, negative to remove)
 * @param account - Account executing the transaction
 * @param specAmount0 - Slippage protection for token0 (use NO_SLIPPAGE_LIMIT to disable)
 * @param specAmount1 - Slippage protection for token1 (use NO_SLIPPAGE_LIMIT to disable)
 * @param specAmountBufferPercent - Optional buffer percentage to add to specAmounts (default 0, e.g. 0.01 = 1%)
 * @returns Object containing transaction hash and token deltas
 *
 * @example
 * // Add liquidity to bins 0, 1, 2 with 1000 shares each
 * const { hash, amount0Delta, amount1Delta } = await modifyLiquidity(
 *   publicClient,
 *   walletClient,
 *   poolAddress,
 *   0n, // salt
 *   [
 *     { bin: 0, deltaShares: 1000n },
 *     { bin: 1, deltaShares: 1000n },
 *     { bin: 2, deltaShares: 1000n },
 *   ],
 *   account,
 *   NO_SLIPPAGE_LIMIT,
 *   NO_SLIPPAGE_LIMIT,
 *   0.01 // 1% buffer
 * );
 */
export async function modifyLiquidity(
  publicClient: PublicClient,
  walletClient: WalletClient,
  poolAddress: Address,
  salt: bigint,
  deltas: LiquidityDelta[],
  account: Address,
  specAmount0: bigint = NO_SLIPPAGE_LIMIT,
  specAmount1: bigint = NO_SLIPPAGE_LIMIT,
  specAmountBufferPercent: number = 0,
): Promise<{ hash: Hex; amount0Delta: bigint; amount1Delta: bigint }> {
  const bufferedSpecAmount0 = applySpecAmountBuffer(
    specAmount0,
    specAmountBufferPercent,
  );
  const bufferedSpecAmount1 = applySpecAmountBuffer(
    specAmount1,
    specAmountBufferPercent,
  );

  const { request, result } = await publicClient.simulateContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "modifyLiquidity",
    args: [salt, deltas, bufferedSpecAmount0, bufferedSpecAmount1],
    account,
  });

  const hash = await walletClient.writeContract(request);

  await publicClient.waitForTransactionReceipt({ hash });

  return {
    hash,
    amount0Delta: result[0] as bigint,
    amount1Delta: result[1] as bigint,
  };
}

/**
 * Parameters for removing liquidity by percentage.
 *
 * Specify which bins to remove from using either:
 * - `bins` - explicit list of non-contiguous bin indices (e.g., [-3, 1, 2])
 * - `lowerBin`/`upperBin` - contiguous range to scan (default: -10 to 10)
 *
 * If `bins` is provided, `lowerBin`/`upperBin` are ignored.
 */
export interface RemoveLiquidityParams {
  /** Percentage of liquidity to remove (0-100) */
  percentageToRemove: number;
  /** Explicit list of bin indices to remove from (non-contiguous supported) */
  bins?: number[];
  /** Lower bin index to scan for positions (default: -10, ignored if bins is set) */
  lowerBin?: number;
  /** Upper bin index to scan for positions (default: 10, ignored if bins is set) */
  upperBin?: number;
}

/**
 * Prepare liquidity deltas to remove a percentage of a position.
 *
 * Queries the position's shares across bins and calculates negative deltas
 * to remove the specified percentage.
 *
 * @param publicClient - Viem public client
 * @param stateViewAddress - StateView contract address
 * @param poolAddress - Pool address
 * @param owner - Position owner address
 * @param salt - Position salt
 * @param params - Removal parameters (percentage, bin range)
 * @returns LiquidityDelta[] with negative deltaShares for removal
 */
export async function prepareRemoveLiquidityDeltas(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  owner: Address,
  salt: bigint,
  params: RemoveLiquidityParams,
): Promise<LiquidityDelta[]> {
  const { percentageToRemove, bins, lowerBin = -10, upperBin = 10 } = params;

  if (percentageToRemove <= 0 || percentageToRemove > 100) {
    throw new Error("percentageToRemove must be between 0 and 100");
  }

  // Discover which bins have shares
  const binsWithShares = bins
    ? bins
    : (
        await getPositionBinSharesRange(
          publicClient,
          stateViewAddress,
          poolAddress,
          owner,
          salt,
          lowerBin,
          upperBin,
        )
      ).map((p) => p.binIdx);

  if (binsWithShares.length === 0) return [];

  // Delegate to the per-bin function with uniform percentage
  const specs: BinRemovalSpec[] = binsWithShares.map((bin) => ({
    bin,
    percentageToRemove,
  }));

  return prepareCustomRemoveLiquidityDeltas(
    publicClient,
    stateViewAddress,
    poolAddress,
    owner,
    salt,
    specs,
  );
}

/**
 * Per-bin removal specification.
 * Specify either a percentage or absolute shares to remove from each bin.
 */
export interface BinRemovalSpec {
  /** Bin index */
  bin: number;
  /** Percentage of shares to remove from this bin (0-100). Mutually exclusive with `shares`. */
  percentageToRemove?: number;
  /** Absolute number of shares to remove. Mutually exclusive with `percentageToRemove`. */
  sharesToRemove?: bigint;
}

/**
 * Prepare liquidity deltas to remove custom amounts from specific bins.
 *
 * Unlike prepareRemoveLiquidityDeltas which removes the same percentage from all bins,
 * this function lets you specify a different percentage or absolute share amount per bin.
 *
 * @param publicClient - Viem public client
 * @param stateViewAddress - StateView contract address
 * @param poolAddress - Pool address
 * @param owner - Position owner address
 * @param salt - Position salt
 * @param specs - Array of per-bin removal specifications
 * @returns LiquidityDelta[] with negative deltaShares for removal
 *
 * @example
 * // Remove 100% from bin -3, 50% from bin 1, and exactly 500 shares from bin 2
 * const deltas = await prepareCustomRemoveLiquidityDeltas(
 *   publicClient, stateViewAddress, poolAddress, owner, salt,
 *   [
 *     { bin: -3, percentageToRemove: 100 },
 *     { bin: 1, percentageToRemove: 50 },
 *     { bin: 2, sharesToRemove: 500n },
 *   ]
 * );
 */
export async function prepareCustomRemoveLiquidityDeltas(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  owner: Address,
  salt: bigint,
  specs: BinRemovalSpec[],
): Promise<LiquidityDelta[]> {
  if (specs.length === 0) return [];

  for (const spec of specs) {
    if (spec.percentageToRemove != null && spec.sharesToRemove != null) {
      throw new Error(
        `Bin ${spec.bin}: specify either percentageToRemove or sharesToRemove, not both`,
      );
    }
    if (spec.percentageToRemove == null && spec.sharesToRemove == null) {
      throw new Error(
        `Bin ${spec.bin}: must specify either percentageToRemove or sharesToRemove`,
      );
    }
    if (
      spec.percentageToRemove != null &&
      (spec.percentageToRemove <= 0 || spec.percentageToRemove > 100)
    ) {
      throw new Error(
        `Bin ${spec.bin}: percentageToRemove must be between 0 and 100`,
      );
    }
  }

  const binIndices = specs.map((s) => s.bin);
  const positionShares = await getPositionBinSharesForBins(
    publicClient,
    stateViewAddress,
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
      // Use absolute value, capped at current shares
      sharesToRemove =
        spec.sharesToRemove > currentShares
          ? currentShares
          : spec.sharesToRemove;
    } else {
      // Use percentage
      sharesToRemove =
        spec.percentageToRemove === 100
          ? currentShares
          : (currentShares *
              BigInt(Math.floor(spec.percentageToRemove! * 100))) /
            10000n;
    }

    if (sharesToRemove > 0n) {
      deltas.push({
        bin: spec.bin,
        deltaShares: -sharesToRemove,
      });
    }
  }

  return deltas;
}

/**
 * Prepare calldata for removing a percentage of liquidity from a position.
 *
 * This is an async function because it needs to query the position's current shares.
 * Use this when you want to build the transaction yourself or use multicall.
 *
 * @param publicClient - Viem public client
 * @param stateViewAddress - StateView contract address
 * @param poolAddress - Pool address
 * @param owner - Position owner address
 * @param salt - Position salt
 * @param params - Removal parameters (percentage, bin range)
 * @param specAmount0 - Slippage protection for token0 (use NO_SLIPPAGE_LIMIT to disable)
 * @param specAmount1 - Slippage protection for token1 (use NO_SLIPPAGE_LIMIT to disable)
 * @returns Prepared transaction data with calldata, or null if no liquidity found
 *
 * @example
 * const prepared = await prepareRemoveLiquidityCalldata(
 *   publicClient,
 *   stateViewAddress,
 *   poolAddress,
 *   ownerAddress,
 *   salt,
 *   { percentageToRemove: 50 }
 * );
 * if (prepared) {
 *   // Use prepared.data to send the transaction to the pool address
 * }
 */
export async function prepareRemoveLiquidityCalldata(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  owner: Address,
  salt: bigint,
  params: RemoveLiquidityParams,
  specAmount0: bigint = NO_SLIPPAGE_LIMIT,
  specAmount1: bigint = NO_SLIPPAGE_LIMIT,
): Promise<PreparedModifyLiquidity | null> {
  const deltas = await prepareRemoveLiquidityDeltas(
    publicClient,
    stateViewAddress,
    poolAddress,
    owner,
    salt,
    params,
  );

  if (deltas.length === 0) {
    return null;
  }

  return prepareModifyLiquidityCalldata(salt, deltas, specAmount0, specAmount1);
}

/**
 * Remove a percentage of liquidity from a position.
 *
 * This is a convenience function that:
 * 1. Queries the position's shares across a bin range
 * 2. Calculates negative deltas for the specified percentage
 * 3. Calls modifyLiquidity to remove the liquidity
 *
 * @param publicClient - Viem public client
 * @param walletClient - Viem wallet client
 * @param stateViewAddress - StateView contract address
 * @param poolAddress - Pool address
 * @param owner - Position owner address
 * @param salt - Position salt
 * @param account - Account executing the transaction
 * @param params - Removal parameters (percentage, bin range)
 * @param specAmount0 - Slippage protection for token0 (use NO_SLIPPAGE_LIMIT to disable)
 * @param specAmount1 - Slippage protection for token1 (use NO_SLIPPAGE_LIMIT to disable)
 * @returns Object containing transaction hash and token deltas
 *
 * @example
 * // Remove 50% of liquidity
 * const { hash } = await removeLiquidity(
 *   publicClient,
 *   walletClient,
 *   stateViewAddress,
 *   poolAddress,
 *   ownerAddress,
 *   salt,
 *   account,
 *   { percentageToRemove: 50 }
 * );
 *
 * @example
 * // Remove 100% of liquidity (full withdrawal)
 * const { hash } = await removeLiquidity(
 *   publicClient,
 *   walletClient,
 *   stateViewAddress,
 *   poolAddress,
 *   ownerAddress,
 *   salt,
 *   account,
 *   { percentageToRemove: 100 }
 * );
 */
export async function removeLiquidity(
  publicClient: PublicClient,
  walletClient: WalletClient,
  stateViewAddress: Address,
  poolAddress: Address,
  owner: Address,
  salt: bigint,
  account: Address,
  params: RemoveLiquidityParams,
  specAmount0: bigint = NO_SLIPPAGE_LIMIT,
  specAmount1: bigint = NO_SLIPPAGE_LIMIT,
): Promise<{ hash: Hex; amount0Delta: bigint; amount1Delta: bigint }> {
  const deltas = await prepareRemoveLiquidityDeltas(
    publicClient,
    stateViewAddress,
    poolAddress,
    owner,
    salt,
    params,
  );

  if (deltas.length === 0) {
    throw new Error("No liquidity found in the specified bin range");
  }

  return modifyLiquidity(
    publicClient,
    walletClient,
    poolAddress,
    salt,
    deltas,
    account,
    specAmount0,
    specAmount1,
  );
}
