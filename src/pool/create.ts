/**
 * MetricAMM SDK - Pool Creation
 * Functions for creating new pools
 */

import type { Address, PublicClient, WalletClient, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { POOL_FACTORY_ABI } from "../constants.js";
import { createUniformBins } from "../utils/binData.js";

// ============ Types ============

/**
 * Parameters for creating a new pool via the factory.
 * This is the user-friendly interface - no knowledge of packing required.
 *
 * For bin configuration, you can use either:
 * - Pre-packed bigint[] from createBins() or createUniformBins()
 *
 * @example Using createBins (recommended):
 * ```typescript
 * const params: CreatePoolFactoryParams = {
 *   token0, token1, priceProvider, admin,
 *   reportSwapToPriceProvider: false,
 *   adminFeeDestination: admin,
 *   nonNegativeBins: createBins([
 *     { length: 10000, addFeeBuy: 500 },  // 1% bin with +0.05% buy fee
 *     { length: 10000 },                   // 1% bin, no extra fees
 *   ]),
 *   negativeBins: createUniformBins(20, 10000),  // 20 uniform 1% bins
 * };
 * ```
 */
export interface CreatePoolFactoryParams {
  /** Address of token0 */
  token0: Address;
  /** Address of token1 */
  token1: Address;
  /** Address of the price oracle contract */
  priceProvider: Address;
  /** Admin address for the pool */
  admin: Address;

  /**
   * Bin configurations for bins with index >= 0 (non-negative bins).
   * Can be either:
   * - bigint[] from createBins() or createUniformBins() (recommended)
   * First bin (index 0) is the "current" bin at pool creation.
   * Array order: [bin0, bin1, bin2, ...]
   */
  nonNegativeBins: bigint[];

  /**
   * Bin configurations for bins with index < 0 (negative bins).
   * Can be either:
   * - bigint[] from createBins() or createUniformBins() (recommended)
   * Array order: [bin-1, bin-2, bin-3, ...] (closest to 0 first)
   */
  negativeBins: bigint[];

  /** Initial token0 amount per share (in token0's decimal units, typically 1.0 = 1e18 for 18 decimals) */
  initialToken0PerShare: bigint;
  /** Initial token1 amount per share (in token1's decimal units, typically 1.0 = 1e18 for 18 decimals) */
  initialToken1PerShare: bigint;
  /** Minimum liquidity that can be minted */
  minimalMintableLiquidity: bigint;

  /** Whether swaps should be reported to the price provider */
  reportSwapToPriceProvider: boolean;

  /** Maximum allowed drift in percentage (e.g., 5.0 = 5%) */
  maxDriftPercent: number;
  /** Drift decay rate per second in percentage (e.g., 0.01 = 0.01%/s) */
  driftDecayPerSecondPercent: number;

  /** Admin fee as percentage of swap fees (e.g., 5.0 = 5%) */
  adminFeePercent: number;

  /** Address to receive admin fees */
  adminFeeDestination: Address;

  /** Initial left end of bin distance from price provider price */
  curBinDistFromProvidedPricePercent: number;

  /** Salt for deterministic pool address (default: random) */
  salt?: Hex;

  /**
   * Optional pool creation bytecode passed to factory `createPool`.
   * Required by factory variants where PoolParameters includes `poolCreationCode`.
   */
  poolCreationCode?: Hex;

  /**
   * @deprecated Use `poolCreationCode` instead.
   */
  poolInitCode?: Hex;
}

/**
 * @deprecated Use CreatePoolFactoryParams instead
 */
export interface CreatePoolParams {
  token0: Address;
  token1: Address;
  priceProvider: Address;
  numBins: number; // Total bins (e.g., 520 for -260 to 259)
  binLengthE6: number; // Length per bin (e.g., 10000 = 1%)
  baseFeeE6: number; // Base swap fee (e.g., 3000 = 0.3%)
  protocolFeeE6: number; // Protocol fee (e.g., 200000 = 20%)
  maxDriftE8: bigint; // Max drift (e.g., 5000000 = 5%)
  maxDriftDecayPerSecondE8: bigint; // Drift decay rate
}

// ============ Functions ============

/**
 * Prepare factory parameters from user-friendly CreatePoolFactoryParams.
 * Returns the properly formatted parameters for the factory's createPool function.
 */
export function prepareFactoryCreatePoolParams(
  params: CreatePoolFactoryParams,
): {
  token0: Address;
  token1: Address;
  priceProvider: Address;
  admin: Address;
  initialToken0DensityPerLiquidityE18: bigint;
  initialToken1DensityPerLiquidityE18: bigint;
  minimalMintableLiquidity: bigint;
  reportSwapToPriceProvider: boolean;
  maxDriftE8: bigint;
  driftDecayPerSecondE8: bigint;
  adminFee: number;
  adminFeeDestination: Address;
  curBinDistFromProvidedPriceE6: number;
  nonNegativeBinDataArray: bigint[];
  negativeBinDataArray: bigint[];
  salt: Hex;
  poolCreationCode?: Hex;
} {
  const maxDriftE8 = BigInt(Math.round(params.maxDriftPercent * 1_000_000));
  const driftDecayPerSecondE8 = BigInt(
    Math.round(params.driftDecayPerSecondPercent * 1_000_000),
  );

  const adminFee = Math.round(params.adminFeePercent * 10_000);

  const curBinDistFromProvidedPriceE6 = Math.round(
    params.curBinDistFromProvidedPricePercent * 10_000,
  );

  const salt =
    params.salt ??
    (`0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join("")}` as Hex);

  return {
    poolCreationCode: params.poolCreationCode ?? params.poolInitCode ?? ("0x" as Hex),
    token0: params.token0,
    token1: params.token1,
    priceProvider: params.priceProvider,
    admin: params.admin,
    initialToken0DensityPerLiquidityE18: params.initialToken0PerShare,
    initialToken1DensityPerLiquidityE18: params.initialToken1PerShare,
    minimalMintableLiquidity: params.minimalMintableLiquidity,
    reportSwapToPriceProvider: params.reportSwapToPriceProvider,
    maxDriftE8,
    driftDecayPerSecondE8,
    adminFee,
    adminFeeDestination: params.adminFeeDestination,
    curBinDistFromProvidedPriceE6,
    nonNegativeBinDataArray: params.nonNegativeBins,
    negativeBinDataArray: params.negativeBins,
    salt,
  };
}

/**
 * Create a new pool via the factory contract.
 * This is the main user-facing function for pool creation.
 *
 * @example
 * ```typescript
 * const poolAddress = await createPool(
 *   publicClient,
 *   walletClient,
 *   factoryAddress,
 *   {
 *     token0: "0x...",
 *     token1: "0x...",
 *     priceProvider: "0x...",
 *     admin: "0x...",
 *     reportSwapToPriceProvider: false,
 *     adminFeeDestination: "0x...",
 *     // 10 bins on each side, each covering 1% price range
 *     nonNegativeBins: createUniformBins(10, 10000),
 *     negativeBins: createUniformBins(10, 10000),
 *     // Config
 *     initialToken0PerShare: parseUnits("1", 18),
 *     initialToken1PerShare: parseUnits("1", 18),
 *     minimalMintableLiquidity: 1000n,
 *     maxDriftPercent: 5.0,       // 5% max drift
 *     driftDecayPerSecondPercent: 0.001,
 *     adminFeePercent: 5.0,       // 5% admin fee
 *     curBinDistFromProvidedPricePercent: 0, // Start at center of bin 0
 *   },
 *   account
 * );
 * ```
 */
export async function createPool(
  publicClient: PublicClient,
  walletClient: WalletClient,
  factoryAddress: Address,
  params: CreatePoolFactoryParams,
  account: Address,
): Promise<{ hash: Hex; poolAddress?: Address }> {
  const factoryParams = prepareFactoryCreatePoolParams(params);
  const args = buildCreatePoolArgs(factoryParams);

  const { request, result } = await publicClient.simulateContract({
    address: factoryAddress,
    abi: POOL_FACTORY_ABI,
    functionName: "createPool",
    args,
    account,
  });

  const hash = await walletClient.writeContract(request);

  return {
    hash,
    poolAddress: result as Address,
  };
}

/**
 * Encode pool creation calldata for use with multicall or external signers.
 */
export function encodeCreatePoolCalldata(params: CreatePoolFactoryParams): Hex {
  const factoryParams = prepareFactoryCreatePoolParams(params);
  const args = buildCreatePoolArgs(factoryParams);

  return encodeFunctionData({
    abi: POOL_FACTORY_ABI,
    functionName: "createPool",
    args,
  });
}

function buildCreatePoolArgs(factoryParams: unknown): unknown[] {
  const createPoolAbi = (POOL_FACTORY_ABI as readonly any[]).find(
    (item) => item?.type === "function" && item?.name === "createPool",
  );

  const inputCount = createPoolAbi?.inputs?.length ?? 1;

  // Legacy/newer one-arg variant: createPool((PoolParameters))
  if (inputCount === 1) {
    return [factoryParams];
  }

  throw new Error("Unsupported createPool ABI shape");
}

/**
 * @deprecated Use prepareFactoryCreatePoolParams instead
 * Prepare bin data for pool creation
 * Creates uniform bins with specified parameters
 */
export function preparePoolBinData(params: CreatePoolParams): {
  positiveBinData: bigint[];
  negativeBinData: bigint[];
} {
  const halfBins = Math.floor(params.numBins / 2);

  const positiveBinData = createUniformBins(halfBins, params.binLengthE6);
  const negativeBinData = createUniformBins(halfBins, params.binLengthE6);

  return {
    positiveBinData,
    negativeBinData,
  };
}
