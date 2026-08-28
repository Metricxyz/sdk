/**
 * MetricAMM SDK - Liquidity Math Utilities
 */

import { Q64 } from "../constants.js";

export const ONE_E18 = 1_000_000_000_000_000_000n;

/** Convert on-chain Q64 price to 1e18 fixed-point without floating point. */
export function priceX64ToPriceE18(priceX64: bigint): bigint {
  if (priceX64 <= 0n) {
    throw new Error("currentPriceX64 must be > 0");
  }
  const priceE18 = (priceX64 * ONE_E18) / Q64;
  if (priceE18 <= 0n) {
    throw new Error("currentPriceX64 is too small after conversion");
  }
  return priceE18;
}

export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("denominator must be > 0");
  if (numerator < 0n) throw new Error("numerator must be >= 0");
  return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}

export function toPriceE18(currentPrice: number): bigint {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    throw new Error("currentPrice must be a positive finite number");
  }
  const priceE18 = BigInt(Math.round(currentPrice * 1e18));
  if (priceE18 <= 0n) {
    throw new Error("currentPrice is too small");
  }
  return priceE18;
}

export function convertToken0ToToken1(
  amount0: bigint,
  token0ScaleMultiplier: bigint,
  token1ScaleMultiplier: bigint,
  priceE18: bigint,
): bigint {
  return (amount0 * token0ScaleMultiplier * priceE18) / (token1ScaleMultiplier * ONE_E18);
}

export function convertToken1ToToken0(
  amount1: bigint,
  token0ScaleMultiplier: bigint,
  token1ScaleMultiplier: bigint,
  priceX18: bigint,
): bigint {
  return (amount1 * token1ScaleMultiplier * ONE_E18) / (token0ScaleMultiplier * priceX18);
}

export function scaledPositiveDeltaToExternal(
  scaledAmount: bigint,
  scaleMultiplier: bigint,
): bigint {
  return ceilDiv(scaledAmount, scaleMultiplier);
}
