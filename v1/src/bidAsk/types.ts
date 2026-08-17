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
   * Q64.64. The pool's top-of-book bid, as oracle_api computes it right now — do NOT infer a
   * fee-adjustment answer from the "Adj" suffix; that name is a leftover and not a reliable guide
   * to what this value is. On oracle_suite `main` today this is the RAW oracle bid from
   * `getBidAndAskPrice()` (the fee-adjusted pool bid only exists on the wire under `?debug=true`,
   * as `debug.poolBid`, which this SDK deliberately never requests). A pending oracle_suite
   * change (#429) repoints this field at the pool's executable sell price instead, specifically
   * because callers were wrongly treating the raw value as executable. Since which of those two
   * meanings applies depends on server deploy state this SDK cannot observe, treat the value as
   * opaque beyond the `isQuoteUnavailable` sentinel — do not hard-code either interpretation.
   *
   * This SDK's price-impact output (`computePriceImpactExactIn`/`computePriceImpactExactOut`)
   * never reads this field: it derives everything from `depth`, which is already fee-adjusted
   * server-side under both the current behavior and #429. The only place this SDK reads
   * `bidAdj`/`askAdj` at all is `isQuoteUnavailable`'s sentinel check (`bidAdj === 0` and
   * `askAdj === MAX_UINT128`), and #429 preserves that exact sentinel encoding — so neither this
   * field's current meaning nor #429's change to it affects any number this SDK computes.
   */
  bidAdj: string;
  /** Q64.64. Ask-side counterpart of `bidAdj` — see its doc comment; every caveat there applies here too. */
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
  /**
   * Q64.64. Meaning depends on server deploy state — see `BidAskResponse.bidAdj`'s doc comment.
   * Not read by this SDK's price-impact math; only by `isQuoteUnavailable`'s sentinel check.
   */
  bidAdj: bigint;
  /** Q64.64. Ask-side counterpart of `bidAdj` — see its doc comment. */
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
   * The post-fee price this size actually executes at: Q64.64, token1-per-token0, in the pool's
   * SCALED basis (same basis as `referencePriceX64`, both derived via `token0ScaleMultiplier`/
   * `token1ScaleMultiplier`). Directly comparable to `referencePriceX64` and to `depth[].price`
   * — all three live in the same fee-adjusted, scaled, token1-per-token0 space, since the server
   * bakes fees into `depth[].price` before this SDK ever sees it. Nothing in this SDK applies a
   * fee, and nothing here should be read as needing one applied by the caller.
   *
   * NOT the same as `effectivePriceX64`: that field is the raw `amountOut/amountIn` ratio,
   * un-normalized for decimals, and — on the ask side — in the INVERSE orientation to this field
   * (see `effectivePriceX64`'s own doc comment). The two are not interchangeable.
   */
  executionPriceX64: bigint;
  /**
   * Pre-trade, fee-adjusted pool reference price recovered from the FIRST crossed level, Q64.64,
   * same scaled basis as `executionPriceX64`. NOT the same as `debug.poolBid`/`poolAsk`
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
  /**
   * The raw `amountOut / amountIn` ratio, un-normalized for decimals — matches the route API's
   * field of the same name. Also already post-fee (derived from the same fee-adjusted fill), but
   * NOT in the same basis as `executionPriceX64`: on the bid side `amountIn`/`amountOut` are
   * token0/token1, so this ratio happens to be token1-per-token0 like `executionPriceX64`; on the
   * ask side `amountIn`/`amountOut` are token1/token0, so this ratio comes out token0-per-token1
   * — the INVERSE orientation of `executionPriceX64` there. Do not compare this field directly
   * against `executionPriceX64`/`referencePriceX64`/`depth[].price` without accounting for that.
   */
  effectivePriceX64: bigint;
  /** Number of depth bins crossed to fill the request. */
  binsCrossed: number;
}
