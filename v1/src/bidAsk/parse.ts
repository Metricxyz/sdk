/**
 * Parse the raw `bid_ask` wire response into typed domain values.
 */

import { MAX_UINT128 } from "../constants.js";
import { parseWireAddress, parseWireAmount, parseWireInteger } from "../utils/wire.js";
import type {
  BidAskQuote,
  BidAskResponse,
  DepthData,
  DepthDataResponse,
  DepthLevel,
  DepthLevelResponse,
  DepthSide,
} from "./types.js";

function parseOptionalAmount(value: string | null | undefined, field: string): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }
  return parseWireAmount(value, field);
}

/**
 * Parse one cumulative depth-ladder boundary. `price` must be strictly positive: the server
 * never emits a non-positive `price`, and a caller feeding hand-built JSON into this parser
 * (`baseUrl` is overridable, and this function is a documented public entry point) must not be
 * able to smuggle in a negative or zero price that would silently invert or corrupt the impact
 * math downstream (see `computeReferencePriceX64` in `./depth.js`).
 */
function parseDepthLevel(raw: DepthLevelResponse, fieldPrefix: string): DepthLevel {
  if (typeof raw.binIdx !== "number" || !Number.isInteger(raw.binIdx)) {
    throw new Error(
      `invalid ${fieldPrefix}.binIdx: expected an integer, got ${JSON.stringify(raw.binIdx)}`,
    );
  }

  const price = parseWireAmount(raw.price, `${fieldPrefix}.price`);
  if (price <= 0n) {
    throw new Error(`invalid ${fieldPrefix}.price: must be > 0, got ${raw.price}`);
  }

  return {
    binIdx: raw.binIdx,
    price,
    cumulativeVolume: parseWireAmount(raw.cumulativeVolume, `${fieldPrefix}.cumulativeVolume`),
    cumulativeInputVolume: parseWireAmount(
      raw.cumulativeInputVolume,
      `${fieldPrefix}.cumulativeInputVolume`,
    ),
    priceImpactE6: parseWireInteger(raw.priceImpactE6, `${fieldPrefix}.priceImpactE6`),
  };
}

function parseDepthSide(levels: unknown, side: DepthSide): DepthLevel[] {
  const field = side === "ask" ? "depth.asks" : "depth.bids";
  if (!Array.isArray(levels)) {
    throw new Error(`invalid ${field}: expected an array, got ${typeof levels}`);
  }
  return levels.map((level, index) =>
    parseDepthLevel(level as DepthLevelResponse, `${field}[${index}]`),
  );
}

function parseDepthData(depth: DepthDataResponse | null | undefined): DepthData | null {
  if (depth === null || depth === undefined) {
    return null;
  }
  return {
    asks: parseDepthSide(depth.asks, "ask"),
    bids: parseDepthSide(depth.bids, "bid"),
  };
}

/**
 * Parse a raw `GET .../bid_ask` response body into a `BidAskQuote`.
 *
 * `bidAdj`/`askAdj` are parsed as `bigint` (Q64.64, RAW oracle prices — see `BidAskResponse`
 * doc comments for why "Adj" is misleading). `poolAddress` is checksummed via viem.
 * `depth`, when present, is parsed into `bigint`-typed levels (still cumulative — see
 * `toDepthBins`/`computePriceImpactExactIn`/`ExactOut` in `./depth.js`/`./impact.js` to
 * interpret it); a non-array `asks`/`bids` throws a clear error naming the field rather than
 * failing later with a context-free `TypeError`.
 *
 * `priceProviderStatus` defaults to `"unknown"` when absent: the server always sends it today,
 * but older cached payloads (written before the field existed) may not.
 */
export function parseBidAskResponse(response: BidAskResponse): BidAskQuote {
  return {
    pair: response.pair,
    poolAddress: parseWireAddress(response.poolAddress, "poolAddress"),
    bidAdj: parseWireAmount(response.bidAdj, "bidAdj"),
    askAdj: parseWireAmount(response.askAdj, "askAdj"),
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
 * for it explicitly before using `bidAdj`/`askAdj` or attempting a depth fill.
 */
export function isQuoteUnavailable(quote: BidAskQuote): boolean {
  return quote.bidAdj === 0n && quote.askAdj === MAX_UINT128;
}
