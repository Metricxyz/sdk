/**
 * MetricAMM SDK Types
 * All interfaces and type definitions
 */

import type { Address } from "viem";
import type { ExtensionOrders, PoolExtensions } from "./extensions/types.js";

// ============ Core Types ============

export interface LiquidityDelta {
  bin: number; // int24
  deltaShares: bigint; // int104
}

/**
 * v1 pool and LiquidityAdder payload: parallel arrays of bin indices and share magnitudes (add or remove).
 */
export interface PoolLiquidityDelta {
  binIdxs: readonly bigint[];
  shares: readonly bigint[];
}

/**
 * Bin configuration for pool creation.
 * All values are in E6 format (1e6 = 100%).
 *
 * @example
 * // Bin with 1% length, 0.3% buy fee, 0.1% sell fee
 * { lengthE6: 10000, addFeeBuyE6: 3000, addFeeSellE6: 1000 }
 */
export interface BinData {
  /** Bin length in E6 format (10000 = 1%, 1000000 = 100%) */
  lengthE6: number;
  /** Additional buy fee in E6 format */
  addFeeBuyE6: number;
  /** Additional sell fee in E6 format */
  addFeeSellE6: number;
}

// ============ Pool Types ============

export interface PoolImmutables {
  factory: Address;
  token0: Address;
  token1: Address;
  token0ScaleMultiplier: bigint;
  token1ScaleMultiplier: bigint;
  initialScaledToken0PerShareE18: bigint;
  initialScaledToken1PerShareE18: bigint;
  minimalMintableLiquidity: bigint;
  immutablePriceProvider?: Address;
  extensions: PoolExtensions;
  extensionOrders: ExtensionOrders;
  lowestBin: number;
  highestBin: number;
}

export interface PoolState {
  pauseLevel: number;
  curBinIdx: number;
  curPosInBin: bigint;
  curBinDistFromProvidedPrice: number;
  spreadFeeE6: number;
  notionalFeeE8: number;
  totalScaledToken0InBins: bigint;
  totalScaledToken1InBins: bigint;
}

export interface BinState {
  token0BalanceScaled: bigint;
  token1BalanceScaled: bigint;
  lengthE6: number;
  addFeeBuyE6: number;
  addFeeSellE6: number;
}

export interface BinStateExternal {
  token0Balance: bigint; // Unscaled, in native token decimals
  token1Balance: bigint; // Unscaled, in native token decimals
  lengthE6: number;
  addFeeBuyE6: number;
  addFeeSellE6: number;
}

export interface BinStatesExternal {
  token0Balances: bigint[];
  token1Balances: bigint[];
  lengthsInUnits: number[];
  addFeeBuysE6: number[];
  addFeeSellsE6: number[];
  totalShares: bigint[];
}

export interface BinStatesScaled {
  token0BalancesScaled: bigint[];
  token1BalancesScaled: bigint[];
  lengthsInUnits: number[];
  addFeeBuysE6: number[];
  addFeeSellsE6: number[];
  totalShares: bigint[];
}

// ============ DataProvider read types ============

export interface Slot0 {
  pauseLevel: number;
  curBinIdx: number;
  curPosInBin: bigint;
  curBinDistFromProvidedPrice: number;
  spreadFeeE6: number;
  notionalFeeE8: number;
}

export interface Slot1 {
  totalScaledToken0InBins: bigint;
  totalScaledToken1InBins: bigint;
}

/** Protocol and admin fee components for a pool (factory.poolFeeConfig). */
export interface PoolFeeConfig {
  protocolSpreadFeeE6: number;
  adminSpreadFeeE6: number;
  protocolNotionalFeeE8: number;
  adminNotionalFeeE8: number;
}

// ============ Position Types ============

/**
 * Result type for getPositionBinSharesRange
 */
export interface PositionBinSharesResult {
  binIdx: number;
  shares: bigint;
}

// ============ Liquidity Types ============

export interface CalculateUniformLiquidityParams {
  valuePerBinInToken: bigint;
  valueIsInToken0: boolean;
  currentPrice: number;
  lowerBin: number;
  upperBin: number;
}

export interface LiquidityBinValueInput {
  bin: number;
  targetValueInToken: bigint;
  targetValueInToken0: boolean;
}

export interface CalculateAnyLiquidityParams {
  bins: LiquidityBinValueInput[];
  currentPrice: number;
}

export interface PreparedLiquidityDistribution {
  deltas: LiquidityDelta[];
  specAmount0: bigint;
  specAmount1: bigint;
}

export type CalculatedLiquidityDistribution = PreparedLiquidityDistribution;
