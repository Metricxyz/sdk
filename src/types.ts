/**
 * MetricAMM SDK Types
 * All interfaces and type definitions
 */

import type { Address } from "viem";

// ============ Core Types ============

export interface LiquidityDelta {
  bin: number; // int24
  deltaShares: bigint; // int104
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
  maxDriftE8: bigint;
  maxDriftDecayPerSecondE8: bigint;
  lowestBin: number;
  highestBin: number;
}

export interface PoolState {
  curBinIdx: number;
  curPosInBin: bigint;
  curBinDistFromProvidedPriceE6: number;
  driftE8: number;
  performanceFeeE6: number;
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

// ============ StateView Types ============

export interface Slot0 {
  curBinIdx: number;
  curPosInBin: bigint;
  curBinDistFromProvidedPriceE6: number;
  driftE8: number;
  performanceFeeE6: number;
}

export interface Slot1 {
  totalScaledToken0InBins: bigint;
  totalScaledToken1InBins: bigint;
}

export interface FeeConfig {
  adminAddr: Address;
  protocolFee: number;
  adminFee: number;
  adminFeeDest: Address;
}

// ============ Swap Types ============

export interface SwapParams {
  pool: Address;
  recipient: Address;
  zeroForOne: boolean;
  amountSpecified: bigint;
  priceLimitX64: bigint;
  deadline: bigint;
}

export interface SwapExactInputParams extends Omit<
  SwapParams,
  "amountSpecified"
> {
  amountIn: bigint;
  minAmountOut: bigint;
}

export interface SwapExactOutputParams extends Omit<
  SwapParams,
  "amountSpecified"
> {
  amountOut: bigint;
  maxAmountIn: bigint;
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
  /** Value given in amount of token to be added to each bin  */
  amountInTokensPerBin: bigint;
  /** True if amountInTokensPerBin is in token0, false if in token1 */
  amountIsInToken0: boolean;
  /** Current market price: token0/token1 (e.g., 3000 means 1 token0 = 3000 token1) */
  currentPrice: number;
  /** Lower bin index (inclusive) */
  lowerBin: number;
  /** Upper bin index (inclusive) */
  upperBin: number;
}

export interface AnyLiquidityBinInput {
  /** Bin index */
  bin: number;
  /** Value amount for this bin */
  amountInToken: bigint;
  /** True if amountInToken is token0, false if token1 */
  amountInToken0: boolean;
}

export interface CalculateAnyLiquidityParams {
  /** Per-bin amounts and token side */
  bins: AnyLiquidityBinInput[];
  /** Current market price: token0/token1 (e.g., 3000 means 1 token0 = 3000 token1) */
  currentPrice: number;
}

export interface PreparedLiquidityDistribution {
  deltas: LiquidityDelta[];
  specAmount0: bigint;
  specAmount1: bigint;
}

export type CalculatedLiquidityDistribution = PreparedLiquidityDistribution;
