/**
 * Parse the raw `bid_ask` wire response into typed domain values.
 */

import { getAddress, type Address } from "viem";
import { MAX_UINT128 } from "../constants.js";
import type {
  BidAskQuote,
  BidAskResponse,
  DepthData,
  DepthDataResponse,
  DepthLevel,
  DepthLevelResponse,
} from "./types.js";

function parseAddress(value: string, field: string): Address {
  try {
    return getAddress(value);
  } catch (error) {
    throw new Error(`invalid ${field}: ${value}`, { cause: error });
  }
}

function parseAmount(value: string, field: string): bigint {
  try {
    const amount = BigInt(value);
    if (amount < 0n) {
      throw new Error(`${field} must be non-negative`);
    }
    return amount;
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be non-negative")) {
      throw error;
    }
    throw new Error(`invalid ${field}: ${value}`, { cause: error });
  }
}

function parseOptionalAmount(value: string | null | undefined, field: string): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }
  return parseAmount(value, field);
}

/**
 * Parse one cumulative depth-ladder boundary. `price` must be strictly positive: a non-positive
 * price would silently invert or corrupt the impact math downstream (see `computeReferencePriceX64`
 * in `./depth.js`).
 */
function parseDepthLevel(raw: DepthLevelResponse, fieldPrefix: string): DepthLevel {
  const price = parseAmount(raw.price, `${fieldPrefix}.price`);
  if (price <= 0n) {
    throw new Error(`invalid ${fieldPrefix}.price: must be > 0, got ${raw.price}`);
  }

  return {
    binIdx: raw.binIdx,
    price,
    cumulativeVolume: parseAmount(raw.cumulativeVolume, `${fieldPrefix}.cumulativeVolume`),
    cumulativeInputVolume: parseAmount(
      raw.cumulativeInputVolume,
      `${fieldPrefix}.cumulativeInputVolume`,
    ),
    priceImpactE6: BigInt(raw.priceImpactE6),
  };
}

function parseDepthData(depth: DepthDataResponse | null | undefined): DepthData | null {
  if (depth === null || depth === undefined) {
    return null;
  }
  return {
    asks: depth.asks.map((level, index) => parseDepthLevel(level, `depth.asks[${index}]`)),
    bids: depth.bids.map((level, index) => parseDepthLevel(level, `depth.bids[${index}]`)),
  };
}

/**
 * Parse a raw `GET .../bid_ask` response body into a `BidAskQuote`.
 *
 * `bidAdj`/`askAdj` are parsed as `bigint` (Q64.64 — see `BidAskResponse.bidAdj`'s doc comment
 * for what they currently mean, why the "Adj" name is not a reliable guide, and why this SDK's
 * price-impact math never reads them). `poolAddress` is checksummed via viem. `depth`, when
 * present, is parsed into `bigint`-typed levels (still cumulative — see `toDepthBins`/
 * `computePriceImpactExactIn` in `./depth.js`/`./impact.js` to interpret it).
 *
 * `priceProviderStatus` defaults to `"unknown"` when absent: the server always sends it today,
 * but older cached payloads (written before the field existed) may not.
 */
export function parseBidAskResponse(response: BidAskResponse): BidAskQuote {
  return {
    pair: response.pair,
    poolAddress: parseAddress(response.poolAddress, "poolAddress"),
    bidAdj: parseAmount(response.bidAdj, "bidAdj"),
    askAdj: parseAmount(response.askAdj, "askAdj"),
    totalToken0Available: parseOptionalAmount(
      response.totalToken0Available,
      "totalToken0Available",
    ),
    totalToken1Available: parseOptionalAmount(
      response.totalToken1Available,
      "totalToken1Available",
    ),
    serverTs: response.serverTs,
    depth: parseDepthData(response.depth),
    priceProviderStatus: response.priceProviderStatus ?? "unknown",
  };
}

/**
 * True when the quote is the server's fail-closed "no usable price" sentinel:
 * `bidAdj === 0` and `askAdj === MAX_UINT128`.
 *
 * This sentinel arrives as an ordinary HTTP 200, not an error status — callers must check
 * for it explicitly before using `bidAdj`/`askAdj` or attempting a depth fill. An unavailable
 * quote also carries a non-null `depth` whose `asks`/`bids` are empty, so a fill attempt would
 * otherwise fail as "no depth" rather than as "no price".
 *
 * `priceProviderStatus` says WHY: `"feed_down"` for a provider that reverted or returned its own
 * fail-closed sentinel (expected, and what the server's backoff exists for), `"internal_error"`
 * for anything on the server's side — a response it could not decode, an RPC failure, or a pool
 * whose contract generation it cannot price. That last case is indistinguishable from a genuine
 * decode bug here, because the server reports the distinction only in its own traces.
 */
export function isQuoteUnavailable(quote: BidAskQuote): boolean {
  return quote.bidAdj === 0n && quote.askAdj === MAX_UINT128;
}
