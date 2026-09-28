/**
 * Convert a human slippage percent to basis points (1 bp = 0.01%).
 * @example toSlippageBps(0.5) // 50n
 */
export function toSlippageBps(slippagePercent: number): bigint {
  if (!Number.isFinite(slippagePercent) || slippagePercent < 0 || slippagePercent > 100) {
    throw new Error("slippagePercent must be a finite number between 0 and 100");
  }
  return BigInt(Math.round(slippagePercent * 100));
}

/** Ceiling division for bigint values. Used when rounding slippage up on exact-output swaps. */
export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error("denominator must be > 0");
  }
  return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}
