import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Q64 } from "../src/constants.js";
import {
  fetchBidAsk,
  getBidAskPriceImpactExactIn,
  getBidAskPriceImpactExactOut,
  METRIC_API_BASE_URL,
  type FetchLike,
  type HttpResponseLike,
} from "../src/bidAsk/client.js";
import type { BidAskResponse } from "../src/bidAsk/types.js";

const poolAddress = "0x0000000000000000000000000000000000000001";
const apiKey = "test-api-key";

type RecordedCall = { url: string; init?: { method?: string; headers?: Record<string, string> } };

function stubFetch(handler: (call: RecordedCall) => HttpResponseLike): {
  fetch: FetchLike;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    return handler(call);
  };
  return { fetch, calls };
}

function jsonResponse(body: unknown, status = 200): HttpResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function bidAskBody(overrides: Partial<BidAskResponse> = {}): BidAskResponse {
  return {
    pair: "WETH/USDC",
    poolAddress,
    bidAdj: "1",
    askAdj: "2",
    serverTs: 1_700_000_000,
    priceProviderStatus: "healthy",
    depth: { bids: [], asks: [] },
    ...overrides,
  };
}

describe("fetchBidAsk", () => {
  it("builds the expected URL with depth=true by default and sends the bearer header", async () => {
    const { fetch, calls } = stubFetch(() => jsonResponse(bidAskBody()));

    await fetchBidAsk({ fetch, apiKey, chainId: 1, poolAddress });

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]!.url,
      `${METRIC_API_BASE_URL}/public/v1/evm/1/${poolAddress}/bid_ask?depth=true`,
    );
    assert.equal(calls[0]!.init?.method, "GET");
    assert.equal(calls[0]!.init?.headers?.["Authorization"], `Bearer ${apiKey}`);
  });

  it("sets depth=false when explicitly requested", async () => {
    const { fetch, calls } = stubFetch(() => jsonResponse(bidAskBody()));

    await fetchBidAsk({ fetch, apiKey, chainId: 8453, poolAddress, depth: false });

    assert.equal(
      calls[0]!.url,
      `${METRIC_API_BASE_URL}/public/v1/evm/8453/${poolAddress}/bid_ask?depth=false`,
    );
  });

  it("trims a trailing slash off a custom baseUrl", async () => {
    const { fetch, calls } = stubFetch(() => jsonResponse(bidAskBody()));

    await fetchBidAsk({
      fetch,
      apiKey,
      chainId: 1,
      poolAddress,
      baseUrl: "https://staging-api.metric.xyz/",
    });

    assert.equal(
      calls[0]!.url,
      `https://staging-api.metric.xyz/public/v1/evm/1/${poolAddress}/bid_ask?depth=true`,
    );
  });

  it("throws, carrying the status, on a non-2xx response", async () => {
    const { fetch } = stubFetch(() => jsonResponse({ error: "nope" }, 503));

    await assert.rejects(
      () => fetchBidAsk({ fetch, apiKey, chainId: 1, poolAddress }),
      /bid_ask request failed: 503/,
    );
  });

  it("parses the response body into a BidAskQuote", async () => {
    const { fetch } = stubFetch(() => jsonResponse(bidAskBody({ bidAdj: "123", askAdj: "456" })));

    const quote = await fetchBidAsk({ fetch, apiKey, chainId: 1, poolAddress });

    assert.equal(quote.bidAdj, 123n);
    assert.equal(quote.askAdj, 456n);
    assert.equal(quote.priceProviderStatus, "healthy");
  });

  describe("fetch defaulting", () => {
    it("uses globalThis.fetch when params.fetch is omitted", async () => {
      const original = globalThis.fetch;
      let calledUrl: string | undefined;
      (globalThis as { fetch?: FetchLike }).fetch = async (url) => {
        calledUrl = url;
        return jsonResponse(bidAskBody());
      };
      try {
        const quote = await fetchBidAsk({ apiKey, chainId: 1, poolAddress });
        assert.equal(
          calledUrl,
          `${METRIC_API_BASE_URL}/public/v1/evm/1/${poolAddress}/bid_ask?depth=true`,
        );
        assert.equal(quote.bidAdj, 1n);
      } finally {
        (globalThis as { fetch?: FetchLike }).fetch = original;
      }
    });

    it("throws a clear error when no fetch is available anywhere", async () => {
      const original = globalThis.fetch;
      delete (globalThis as { fetch?: FetchLike }).fetch;
      try {
        await assert.rejects(
          () => fetchBidAsk({ apiKey, chainId: 1, poolAddress }),
          /no fetch available; pass params\.fetch explicitly/,
        );
      } finally {
        (globalThis as { fetch?: FetchLike }).fetch = original;
      }
    });

    it("throws the module's own error (not a bare TypeError) for a poisoned non-callable global", async () => {
      // resolveFetch checks `typeof resolved !== "function"`, not `!resolved`: a truthy but
      // non-callable globalThis.fetch (e.g. a poisoned global left behind by another script)
      // must still produce this module's clear error, not a downstream "fetch is not a function".
      const original = globalThis.fetch;
      (globalThis as unknown as { fetch: unknown }).fetch = "not-a-function";
      try {
        await assert.rejects(
          () => fetchBidAsk({ apiKey, chainId: 1, poolAddress }),
          /no fetch available; pass params\.fetch explicitly/,
        );
      } finally {
        (globalThis as { fetch?: FetchLike }).fetch = original;
      }
    });
  });
});

describe("getBidAskPriceImpactExactIn", () => {
  it("fetches then computes exact-in price impact end-to-end", async () => {
    const { fetch, calls } = stubFetch(() =>
      jsonResponse(
        bidAskBody({
          depth: {
            bids: [],
            asks: [
              {
                binIdx: 0,
                price: (2n * Q64).toString(),
                priceImpactE6: "0",
                cumulativeVolume: "500000",
                cumulativeInputVolume: "1000000",
              },
            ],
          },
        }),
      ),
    );

    const result = await getBidAskPriceImpactExactIn({
      fetch,
      apiKey,
      chainId: 1,
      poolAddress,
      zeroForOne: false,
      amountIn: 1_000_000n,
      token0ScaleMultiplier: 1n,
      token1ScaleMultiplier: 1n,
    });

    assert.equal(calls.length, 1);
    assert.equal(result.amountIn, 1_000_000n);
    assert.equal(result.amountOut, 500_000n);
    assert.equal(result.scaledExecutionPriceX64, 2n * Q64);
    assert.equal(result.priceImpactE6, 0n);
  });
});

describe("getBidAskPriceImpactExactOut", () => {
  it("returns an exact-out-shaped result, not the exact-in computation", async () => {
    const { fetch, calls } = stubFetch(() =>
      jsonResponse(
        bidAskBody({
          depth: {
            bids: [],
            asks: [
              {
                binIdx: 0,
                price: (2n * Q64).toString(),
                priceImpactE6: "0",
                cumulativeVolume: "300000",
                cumulativeInputVolume: "1000000",
              },
            ],
          },
        }),
      ),
    );

    const result = await getBidAskPriceImpactExactOut({
      fetch,
      apiKey,
      chainId: 1,
      poolAddress,
      zeroForOne: false,
      amountOut: 200_000n,
      token0ScaleMultiplier: 1n,
      token1ScaleMultiplier: 1n,
    });

    assert.equal(calls.length, 1);
    assert.equal(result.amountOut, 200_000n);
    // ceil(1,000,000 * 200,000 / 300,000) = ceil(666,666.67) = 666,667. If this call were
    // mis-wired to computePriceImpactExactIn(amountIn: amountOut), amountIn would come back as
    // exactly the requested 200_000n (the exact-in walk takes amountIn as given) instead of this
    // ceil-rounded value, and amountOut would not land on the requested 200_000n either.
    assert.equal(result.amountIn, 666_667n);
  });
});

// A polluted `Object.prototype` must never be picked up in place of an omitted optional field
// (`fetch`/`baseUrl`/`depth`) — see `ownField`/`resolveFetch` in `../src/bidAsk/client.ts`. Every
// test below mutates `Object.prototype` and MUST restore it in `finally`: these tests share one
// process with the rest of the suite, so a leak here breaks every other test file too.
describe("prototype-pollution hardening", () => {
  it("ignores a polluted Object.prototype.fetch and still throws the module's own error", async () => {
    const originalGlobalFetch = globalThis.fetch;
    delete (globalThis as { fetch?: FetchLike }).fetch;
    let pollutedFetchCalled = false;
    (Object.prototype as Record<string, unknown>).fetch = async () => {
      pollutedFetchCalled = true;
      return jsonResponse(bidAskBody());
    };
    try {
      await assert.rejects(
        () => fetchBidAsk({ apiKey, chainId: 1, poolAddress }),
        /no fetch available; pass params\.fetch explicitly/,
      );
      assert.equal(
        pollutedFetchCalled,
        false,
        "the polluted Object.prototype.fetch must never be invoked",
      );
    } finally {
      delete (Object.prototype as Record<string, unknown>).fetch;
      (globalThis as { fetch?: FetchLike }).fetch = originalGlobalFetch;
    }
  });

  it("ignores a polluted Object.prototype.baseUrl and still targets the default host", async () => {
    (Object.prototype as Record<string, unknown>).baseUrl = "https://attacker.example.com";
    const { fetch, calls } = stubFetch(() => jsonResponse(bidAskBody()));
    try {
      await fetchBidAsk({ fetch, apiKey, chainId: 1, poolAddress });
      assert.equal(calls.length, 1);
      assert.ok(
        calls[0]!.url.startsWith(METRIC_API_BASE_URL),
        `expected the default base URL, got ${calls[0]!.url}`,
      );
    } finally {
      delete (Object.prototype as Record<string, unknown>).baseUrl;
    }
  });

  it("ignores a polluted Object.prototype.depth and still defaults depth=true", async () => {
    (Object.prototype as Record<string, unknown>).depth = false;
    const { fetch, calls } = stubFetch(() => jsonResponse(bidAskBody()));
    try {
      await fetchBidAsk({ fetch, apiKey, chainId: 1, poolAddress });
      assert.equal(calls.length, 1);
      assert.ok(calls[0]!.url.includes("depth=true"), `expected depth=true, got ${calls[0]!.url}`);
    } finally {
      delete (Object.prototype as Record<string, unknown>).depth;
    }
  });

  it("holds through the getBidAskPriceImpactExactIn wrapper's fresh object literal", async () => {
    // getBidAskPriceImpactExactIn rebuilds a fresh `{ ...requestParams, depth: true }` object
    // before calling fetchBidAsk — this must not reopen the gap `ownField` closes for a direct
    // fetchBidAsk call.
    (Object.prototype as Record<string, unknown>).baseUrl = "https://attacker.example.com";
    const { fetch, calls } = stubFetch(() =>
      jsonResponse(
        bidAskBody({
          depth: {
            bids: [],
            asks: [
              {
                binIdx: 0,
                price: (2n * Q64).toString(),
                priceImpactE6: "0",
                cumulativeVolume: "500000",
                cumulativeInputVolume: "1000000",
              },
            ],
          },
        }),
      ),
    );
    try {
      await getBidAskPriceImpactExactIn({
        fetch,
        apiKey,
        chainId: 1,
        poolAddress,
        zeroForOne: false,
        amountIn: 1_000_000n,
        token0ScaleMultiplier: 1n,
        token1ScaleMultiplier: 1n,
      });
      assert.equal(calls.length, 1);
      assert.ok(
        calls[0]!.url.startsWith(METRIC_API_BASE_URL),
        `expected the default base URL, got ${calls[0]!.url}`,
      );
    } finally {
      delete (Object.prototype as Record<string, unknown>).baseUrl;
    }
  });
});
