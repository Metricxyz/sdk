/**
 * HTTP client for the oracle_api `bid_ask` endpoint. The only file in `bidAsk/` that touches
 * I/O — everything else is pure and takes data the caller already has.
 */

import { computePriceImpactExactIn, computePriceImpactExactOut } from "./impact.js";
import { parseBidAskResponse } from "./parse.js";
import type { Address } from "viem";
import type { BidAskQuote, BidAskResponse, PriceImpactResult } from "./types.js";

/**
 * Production API base URL — the default when `baseUrl` is omitted. Pass
 * `baseUrl: "https://staging-api.metric.xyz"` (or another host) to target a non-production
 * environment instead.
 */
export const METRIC_API_BASE_URL = "https://api.metric.xyz";

/**
 * Structural subset of the DOM `Response` this module needs. `v1` has no `@types/node` and no
 * `DOM` lib, so `fetch`/`Response` are untyped here — callers inject their own `fetch`
 * (`globalThis.fetch`, `node-fetch`, a test stub, …) rather than this module referencing a host
 * global directly.
 */
export type HttpResponseLike = { ok: boolean; status: number; json(): Promise<unknown> };

/** Structural subset of the DOM `fetch` this module needs. See {@link HttpResponseLike}. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<HttpResponseLike>;

/**
 * Read an optional field via its OWN property only, ignoring anything inherited from
 * `Object.prototype`. A plain `params.fetch`/`params.baseUrl` read walks the prototype chain: if
 * a caller omits the field and some other dependency has polluted `Object.prototype` with a
 * same-named property, a plain read silently picks up the attacker's value instead of
 * `undefined` — a polluted `Object.prototype.fetch` captures the bearer API key, a polluted
 * `Object.prototype.baseUrl` redirects the (still-authenticated) request to an attacker's host.
 * `Object.hasOwn` bypasses the prototype chain, so an omitted field always reads as `undefined`.
 */
function ownField<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

/**
 * Request/transport params shared by {@link fetchBidAsk} and the price-impact convenience
 * function — named once so a future transport option (a header, a timeout, …) can't be added
 * to one and silently missed by the other.
 */
export type BidAskRequestParams = {
  /**
   * Injected fetch implementation. Optional: when omitted, resolves to `globalThis.fetch` (Node
   * >= 18's built-in, or a browser's). Passing it explicitly (e.g. a test stub) always wins.
   */
  fetch?: FetchLike;
  apiKey: string;
  chainId: number;
  poolAddress: Address;
  baseUrl?: string;
};

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveFetch(fetchImpl: FetchLike | undefined): FetchLike {
  // Same own-property discipline as `ownField` above, applied to the global: a polluted
  // `Object.prototype.fetch` must not be picked up just because `globalThis` doesn't have its
  // own `fetch` (e.g. in a non-browser, non-Node-18+ environment).
  const globalFetch = Object.hasOwn(globalThis, "fetch")
    ? (globalThis as { fetch?: FetchLike }).fetch
    : undefined;
  const resolved = fetchImpl ?? globalFetch;
  // `typeof resolved !== "function"` (not `!resolved`): a poisoned non-callable global (or a
  // caller passing a non-function by mistake) must fail here with this module's own clear error,
  // not propagate into a downstream `TypeError` from calling a non-function.
  if (typeof resolved !== "function") {
    throw new Error("no fetch available; pass params.fetch explicitly");
  }
  return resolved;
}

/**
 * Fetch and parse a `bid_ask` quote for one pool.
 *
 * Builds `${baseUrl}/public/v1/evm/${chainId}/${poolAddress}/bid_ask?depth=${depth}`
 * (address is `encodeURIComponent`-escaped) and sends `Authorization: Bearer ${apiKey}`.
 *
 * `?debug=true` is deliberately NOT exposed as an option here: it bypasses the server's Redis
 * cache entirely on every call, so it is expensive and not something a generic client should
 * be able to trigger by accident. Use the raw endpoint directly if you need it.
 */
export async function fetchBidAsk(
  params: BidAskRequestParams & { depth?: boolean },
): Promise<BidAskQuote> {
  const { apiKey, chainId, poolAddress } = params;
  const baseUrl = ownField(params, "baseUrl") ?? METRIC_API_BASE_URL;
  const depth = ownField(params, "depth") ?? true;

  const resolvedFetch = resolveFetch(ownField(params, "fetch"));
  const base = trimTrailingSlash(baseUrl);
  const path = `${base}/public/v1/evm/${chainId}/${encodeURIComponent(poolAddress)}/bid_ask?depth=${depth}`;

  const response = await resolvedFetch(path, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`bid_ask request failed: ${response.status} ${path}`);
  }

  const body = (await response.json()) as BidAskResponse;
  return parseBidAskResponse(body);
}

export type GetBidAskPriceImpactExactInParams = BidAskRequestParams & {
  zeroForOne: boolean;
  amountIn: bigint;
  token0ScaleMultiplier: bigint;
  token1ScaleMultiplier: bigint;
};

/**
 * One-call convenience: fetch a pool's `bid_ask` quote (always with depth — a fill can't be
 * scored without it) and compute the price impact of `amountIn` against it.
 *
 * `token0ScaleMultiplier`/`token1ScaleMultiplier` are NOT on the `bid_ask` response; get them
 * from the pool's own immutables (`getPoolImmutables`'s `PoolImmutables.token0ScaleMultiplier`/
 * `token1ScaleMultiplier`, `../types.js`) — see `computePriceImpactExactIn` in `./impact.js` for
 * why they're required.
 *
 * Builds the `fetchBidAsk` params via object-rest destructuring (`...requestParams`), which only
 * copies `params`'s OWN enumerable properties — so a polluted `Object.prototype.fetch`/`baseUrl`
 * is excluded here too, the same as the `ownField` reads inside `fetchBidAsk` itself.
 */
export async function getBidAskPriceImpactExactIn(
  params: GetBidAskPriceImpactExactInParams,
): Promise<PriceImpactResult> {
  const { zeroForOne, amountIn, token0ScaleMultiplier, token1ScaleMultiplier, ...requestParams } =
    params;

  const quote = await fetchBidAsk({ ...requestParams, depth: true });
  return computePriceImpactExactIn({
    quote,
    amountIn,
    zeroForOne,
    token0ScaleMultiplier,
    token1ScaleMultiplier,
  });
}

export type GetBidAskPriceImpactExactOutParams = BidAskRequestParams & {
  zeroForOne: boolean;
  amountOut: bigint;
  token0ScaleMultiplier: bigint;
  token1ScaleMultiplier: bigint;
};

/**
 * One-call convenience, exact-out: fetch a pool's `bid_ask` quote (always with depth) and
 * compute the price impact of receiving `amountOut` against it — the same "one call" shape as
 * {@link getBidAskPriceImpactExactIn}, just asking the other direction of the same question ("what does
 * it cost to receive this much?" rather than "what do I receive for this much?").
 *
 * See `computePriceImpactExactOut` in `./impact.js` for the ceil-rounding semantics this implies,
 * and {@link getBidAskPriceImpactExactIn}'s doc comment for `token0ScaleMultiplier`/
 * `token1ScaleMultiplier` and the prototype-pollution hardening this wrapper inherits.
 */
export async function getBidAskPriceImpactExactOut(
  params: GetBidAskPriceImpactExactOutParams,
): Promise<PriceImpactResult> {
  const { zeroForOne, amountOut, token0ScaleMultiplier, token1ScaleMultiplier, ...requestParams } =
    params;

  const quote = await fetchBidAsk({ ...requestParams, depth: true });
  return computePriceImpactExactOut({
    quote,
    amountOut,
    zeroForOne,
    token0ScaleMultiplier,
    token1ScaleMultiplier,
  });
}
