/**
 * Bid/ask depth interpretation for oracle_api's `GET .../bid_ask` endpoint: query a pool's
 * live quote and depth ladder, and turn a caller-supplied amount + direction into the price
 * impact of that trade.
 */

export type {
  DepthLevelResponse,
  DepthDataResponse,
  DepthLevel,
  DepthData,
  PriceProviderStatus,
  BidAskResponse,
  BidAskQuote,
  DepthSide,
  DepthBin,
  PriceImpactResult,
} from "./types.js";

export { parseBidAskResponse, isQuoteUnavailable } from "./parse.js";

export { toDepthBins, computeReferencePriceX64, type DepthBinsResult } from "./depth.js";

export { computePriceImpactExactIn, computePriceImpactExactOut } from "./impact.js";

export {
  METRIC_API_BASE_URL,
  fetchBidAsk,
  getBidAskPriceImpactExactIn,
  getBidAskPriceImpactExactOut,
  type HttpResponseLike,
  type FetchLike,
  type BidAskRequestParams,
  type GetBidAskPriceImpactExactInParams,
  type GetBidAskPriceImpactExactOutParams,
} from "./client.js";
