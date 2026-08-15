/**
 * Shared helpers for parsing oracle_api JSON wire values into typed domain values. Stricter
 * than bare `BigInt()`/`getAddress()`: rejects wire shapes the server's own `parse::<u128>()`/
 * `parse::<i128>()` would reject (empty strings, `0x…` hex, non-string JSON numbers that already
 * lost precision), and always names the offending field in the thrown error.
 *
 * Deliberately NOT re-exported from `./index.js` — this is plumbing shared by response parsers
 * (`bidAsk/parse.ts`, `router/fromRoute.ts`), not part of the package's public surface.
 */

import { getAddress, type Address } from "viem";

/** Matches only an optionally-signed run of decimal digits: rejects "", "0x10", "1e30", " 1". */
const DECIMAL_INTEGER_PATTERN = /^-?\d+$/;

/**
 * Parse a wire value into a `bigint`, requiring it to already be a `string` matching
 * {@link DECIMAL_INTEGER_PATTERN}. May be negative; callers that expect a non-negative amount
 * should use {@link parseWireAmount} instead.
 */
export function parseWireInteger(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !DECIMAL_INTEGER_PATTERN.test(value)) {
    throw new Error(
      `invalid ${field}: expected a decimal integer string, got ${JSON.stringify(value)}`,
    );
  }
  return BigInt(value);
}

/** Parse a wire value into a non-negative `bigint`. */
export function parseWireAmount(value: unknown, field: string): bigint {
  const amount = parseWireInteger(value, field);
  if (amount < 0n) {
    throw new Error(`${field} must be non-negative`);
  }
  return amount;
}

/** Checksum a wire address string via viem, naming the offending field on failure. */
export function parseWireAddress(value: string, field: string): Address {
  try {
    return getAddress(value);
  } catch (error) {
    throw new Error(`invalid ${field}: ${value}`, { cause: error });
  }
}
