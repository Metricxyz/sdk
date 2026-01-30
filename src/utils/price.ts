/**
 * MetricAMM SDK - Price Utilities
 * Functions for price conversions
 */

import { Q64 } from "../constants.js";

/**
 * Convert regular price to Q64 format
 */
export function priceToQ64(price: number | bigint): bigint {
  if (typeof price === "number") {
    return BigInt(Math.floor(price * Number(Q64)));
  }
  return price * Q64;
}

/**
 * Convert Q64 format to regular price
 */
export function q64ToPrice(priceX64: bigint): number {
  return Number(priceX64) / Number(Q64);
}
