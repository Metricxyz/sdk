/**
 * MetricAMM SDK - Pool creation (v1 factory `PoolParameters`).
 */

import type { Address, PublicClient, WalletClient, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { POOL_FACTORY_ABI } from "../constants.js";
import { createUniformBins } from "../utils/binData.js";
import { EMPTY_EXTENSION_ORDERS, type ExtensionOrders } from "../extensions/types.js";

export type { ExtensionOrders };

/**
 * Parameters for creating a new pool via the v1 factory.
 */
export interface CreatePoolFactoryParams {
  token0: Address;
  token1: Address;
  priceProvider: Address;
  admin: Address;
  /** Defaults to empty (no extensions). */
  extensions?: Address[];
  /** Defaults to all-zero orders (no extension calls). */
  extensionOrders?: ExtensionOrders;
  /** Defaults to empty; length must match `extensions` when extensions are set. */
  extensionInitData?: Hex[];
  /** Defaults to 0. */
  priceProviderTimelock?: bigint;
  nonNegativeBins: bigint[];
  negativeBins: bigint[];
  /**
   * Empty-bin mint density (P̂0/P̂1) for 1e18 shares; `initialScaledToken1PerShareE18 /
   * initialScaledToken0PerShareE18` must equal the opening price (deployer duty, not
   * validated on-chain). For pools using `OracleValueStopLossExtension`, prefer
   * {@link recommendedInitialScaledAmounts} to derive both fields — see metric-core's
   * `docs/POOL_CONFIGURATION_AND_MANAGEMENT.md` §2.5.
   */
  initialScaledToken0PerShareE18: bigint;
  initialScaledToken1PerShareE18: bigint;
  minimalOperationalLiquidity: bigint;
  /** Protocol spread fee in E6 units; defaults to the factory floor. */
  protocolSpreadFeeE6?: number;
  /** Admin spread fee in E6 units (same convention as on-chain pool fees). */
  adminSpreadFeeE6: number;
  /** Protocol notional fee in E8 units; defaults to the factory floor. */
  protocolNotionalFeeE8?: number;
  /** Admin notional fee in E8 units. */
  adminNotionalFeeE8: number;
  adminFeeDestination: Address;
  /** Distance from oracle price to bin anchor, in pool E6 units. */
  curBinDistFromProvidedPricePercent: number;
  /** Bid/ask/reference asymmetry slack in X8; defaults to uint16 max (disabled). */
  bidAskRefAsymmetryX8?: number;
  salt?: Hex;
}

/**
 * @deprecated Use CreatePoolFactoryParams instead
 */
export interface CreatePoolParams {
  token0: Address;
  token1: Address;
  priceProvider: Address;
  numBins: number;
  binLengthE6: number;
  baseFeeE6: number;
  protocolFeeE6: number;
  maxDriftE8: bigint;
  maxDriftDecayPerSecondE8: bigint;
}

export function prepareFactoryCreatePoolParams(params: CreatePoolFactoryParams) {
  const curBinDistFromProvidedPriceE6 = Math.round(
    params.curBinDistFromProvidedPricePercent * 10_000,
  );
  if (curBinDistFromProvidedPriceE6 < -(2 ** 23) || curBinDistFromProvidedPriceE6 > 2 ** 23 - 1) {
    throw new Error("curBinDistFromProvidedPricePercent maps to int24 out of range");
  }

  const salt =
    params.salt ??
    (`0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join("")}` as Hex);

  return {
    token0: params.token0,
    token1: params.token1,
    priceProvider: params.priceProvider,
    extensions: params.extensions ?? [],
    extensionOrders: params.extensionOrders ?? EMPTY_EXTENSION_ORDERS,
    extensionInitData: params.extensionInitData ?? [],
    priceProviderTimelock: params.priceProviderTimelock ?? 0n,
    admin: params.admin,
    initialScaledAmount0PerE18Shares: params.initialScaledToken0PerShareE18,
    initialScaledAmount1PerE18Shares: params.initialScaledToken1PerShareE18,
    minimalOperationalLiquidity: params.minimalOperationalLiquidity,
    protocolSpreadFeeE6: params.protocolSpreadFeeE6 ?? 0,
    adminSpreadFeeE6: params.adminSpreadFeeE6,
    protocolNotionalFeeE8: params.protocolNotionalFeeE8 ?? 0,
    adminNotionalFeeE8: params.adminNotionalFeeE8,
    adminFeeDestination: params.adminFeeDestination,
    curBinDistFromProvidedPriceE6: curBinDistFromProvidedPriceE6,
    nonNegativeBinDataArray: params.nonNegativeBins,
    negativeBinDataArray: params.negativeBins,
    salt,
    bidAskRefAsymmetryX8: params.bidAskRefAsymmetryX8 ?? 65_535,
  };
}

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

  if (inputCount === 1) {
    return [factoryParams];
  }

  throw new Error("Unsupported createPool ABI shape");
}

/**
 * @deprecated Use prepareFactoryCreatePoolParams instead
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
