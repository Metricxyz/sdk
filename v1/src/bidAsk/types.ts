/**
 * Wire and domain types for the oracle_api `GET /public/v1/evm/:chain_id/:pool_address/bid_ask`
 * endpoint.
 */

import type { Address } from "viem";

// ============ Wire types (as returned by the server) ============

/**
 * One cumulative depth-ladder boundary, as returned by the server. Amounts are cumulative from
 * the current pool position out to this boundary, not marginal (see `computePriceImpactExactIn`
 * in `./impact.js` for the differencing step).
 */
export type DepthLevelResponse = {
  /** Bin index of this boundary (signed — can be negative). */
  binIdx: number;
  /** Q64.64 fixed-point price at this boundary, fee-adjusted, token1-per-token0 on both sides. */
  price: string;
  /** Cumulative OUTPUT amount to this boundary, raw base units. */
  cumulativeVolume: string;
  /** Cumulative INPUT amount required to reach this boundary, raw base units, rounded up. */
  cumulativeInputVolume: string;
  /** Signed E6 price impact vs the current pool bid/ask at this boundary; positive = worse. */
  priceImpactE6: string;
};

/** Both sides of the depth ladder, as returned by the server. */
export type DepthDataResponse = {
  asks: DepthLevelResponse[];
  bids: DepthLevelResponse[];
};

// ============ Parsed depth types ============

/**
 * One cumulative depth-ladder boundary, parsed: wire strings converted to `bigint`. `price` is
 * guaranteed `> 0n` (see `parseBidAskResponse` in `./parse.js`).
 */
export interface DepthLevel {
  binIdx: number;
  /** Q64.64 fixed-point, fee-adjusted, token1-per-token0 on both sides. Always `> 0n`. */
  price: bigint;
  /** Cumulative OUTPUT to this boundary, raw base units. */
  cumulativeVolume: bigint;
  /** Cumulative INPUT to this boundary, raw base units, rounded up. */
  cumulativeInputVolume: bigint;
  /** Signed E6 price impact vs the current pool bid/ask; positive = worse for the trader. */
  priceImpactE6: bigint;
}

/** Both sides of the depth ladder, parsed from {@link DepthDataResponse}. */
export interface DepthData {
  asks: DepthLevel[];
  bids: DepthLevel[];
}

/**
 * Live health of a pool's price feed. `unknown` is the wire-only default for "no current
 * reading" — it is never part of the Redis signal vocabulary readers derive it from.
 */
export type PriceProviderStatus = "healthy" | "feed_down" | "internal_error" | "unknown";

/** Raw `GET .../bid_ask` response body. */
export type BidAskResponse = {
  /** Trading pair label, e.g. `"WETH/USDC"`. */
  pair: string;
  /** Pool contract address (not guaranteed to be checksummed on the wire). */
  poolAddress: string;
  /**
   * Q64.64. RAW oracle bid price from `getBidAndAskPrice` — despite the name, NOT fee-adjusted.
   * The fee-adjusted (executable) pool bid only exists on the wire under `?debug=true` (as
   * `debug.poolBid`), which this SDK deliberately never requests.
   */
  bidAdj: string;
  /** Q64.64. RAW oracle ask price — see `bidAdj`; NOT fee-adjusted. */
  askAdj: string;
  /** Raw `balanceOf(pool)` for token0, in token0's own decimals. */
  totalToken0Available?: string | null;
  /** Raw `balanceOf(pool)` for token1, in token1's own decimals. */
  totalToken1Available?: string | null;
  /** Unix timestamp in SECONDS when this quote was produced. */
  serverTs: number;
  /**
   * With `depth=true` (the client default) the server always sends this key, including when the
   * quote itself is unavailable (`make_unavailable` sets it to `{ asks: [], bids: [] }` rather
   * than omitting it). `null`/absent only when the request used `depth=false`.
   */
  depth?: DepthDataResponse | null;
  /** Opaque; only populated when the caller requests `?debug=true`. Never fetched by this SDK. */
  debug?: unknown;
  /** Always present on fresh responses; defaults to `"unknown"` on older cached payloads. */
  priceProviderStatus?: PriceProviderStatus;
};

// ============ Parsed domain types ============

/** Parsed `bid_ask` quote: wire strings converted to `bigint`, address checksummed. */
export interface BidAskQuote {
  pair: string;
  poolAddress: Address;
  /** Q64.64. RAW oracle bid price — NOT fee-adjusted (see `BidAskResponse.bidAdj`). */
  bidAdj: bigint;
  /** Q64.64. RAW oracle ask price — NOT fee-adjusted (see `BidAskResponse.askAdj`). */
  askAdj: bigint;
  /** Raw `balanceOf(pool)` for token0; `null` if omitted on the wire. */
  totalToken0Available: bigint | null;
  /** Raw `balanceOf(pool)` for token1; `null` if omitted on the wire. */
  totalToken1Available: bigint | null;
  /** Unix seconds. */
  serverTs: number;
  /**
   * Parsed depth ladder (still cumulative — see `computePriceImpactExactIn` in `./impact.js`).
   * `null` only when the request used `depth=false`; an unavailable quote still gets a non-null
   * `depth` with empty `asks`/`bids` (see `BidAskResponse.depth`).
   */
  depth: DepthData | null;
  priceProviderStatus: PriceProviderStatus;
}

/** Which side of the depth ladder a level/price belongs to. */
export type DepthSide = "bid" | "ask";

/** One marginal (input, output) delta between two consecutive cumulative depth levels. */
export interface DepthBin {
  /** Marginal input consumed to cross this bin, raw base units. */
  input: bigint;
  /** Marginal output produced crossing this bin, raw base units. */
  output: bigint;
  /** The originating cumulative level, so callers can inspect its `price`/`priceImpactE6`. */
  level: DepthLevel;
}

/** Result of walking a depth ladder for a caller-supplied amount. */
export interface PriceImpactResult {
  amountIn: bigint;
  amountOut: bigint;
  /**
   * Execution price of this fill, normalized to token1-per-token0 in the pool's SCALED basis
   * (same basis as `referencePriceX64`, both derived via `token0ScaleMultiplier`/
   * `token1ScaleMultiplier`). NOT the same as `effectivePriceX64`: that field is the raw
   * external-units ratio (un-normalized for decimals, and inverted on the ask side since
   * `amountIn`/`amountOut` swap which token is which side of the ratio).
   */
  scaledExecutionPriceX64: bigint;
  /**
   * Pre-trade, fee-adjusted pool reference price recovered from the FIRST crossed level, Q64.64,
   * same scaled basis as `scaledExecutionPriceX64`. NOT the same as `debug.poolBid`/`poolAsk`
   * (those skip the notional fee this value bakes in).
   */
  referencePriceX64: bigint;
  /** Signed E6 price impact AVERAGED over the whole fill; positive = worse for the trader. */
  priceImpactE6: bigint;
  /**
   * Signed E6 price impact of the LAST crossed level only — exactly what `/route` reports for a
   * leg. Differs from `priceImpactE6` (the average): a deep fill's marginal impact can be far
   * worse than its average.
   */
  marginalPriceImpactE6: bigint;
  /** `amountOut * Q64 / amountIn`, un-normalized — matches the route API's field of the same name. */
  effectivePriceX64: bigint;
  /** Number of depth bins crossed to fill the request. */
  binsCrossed: number;
}
