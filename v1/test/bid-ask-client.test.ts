import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Q64 } from "../src/constants.js";
import {
  fetchBidAsk,
  getBidAskPriceImpact,
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
  });
});

describe("getBidAskPriceImpact", () => {
  it("fetches then computes price impact end-to-end", async () => {
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

    const result = await getBidAskPriceImpact({
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
    assert.equal(result.executionPriceX64, 2n * Q64);
    assert.equal(result.priceImpactE6, 0n);
  });
});

describe("getBidAskPriceImpactExactOut", () => {
  it("fetches then computes exact-out end-to-end, proving it is not mis-wired to exact-in", async () => {
    const { fetch, calls } = stubFetch(() =>
      jsonResponse(
        bidAskBody({
          depth: {
            bids: [],
            asks: [
              {
                binIdx: 0,
                price: (Q64 / 3n).toString(),
                priceImpactE6: "0",
                cumulativeVolume: "3000000",
                cumulativeInputVolume: "1000000",
              },
            ],
          },
        }),
      ),
    );

    // This bin's input capacity is only 1,000,000. If this wrapper were wired to
    // computePriceImpactExactIn instead, amountOut=3,000,000 would be interpreted as amountIn and
    // immediately exceed that capacity — an "insufficient depth" throw, not a successful fill. A
    // successful fill with amountIn=1,000,000 (the bin's own input, not 3,000,000) proves this
    // called the exact-out walk.
    const result = await getBidAskPriceImpactExactOut({
      fetch,
      apiKey,
      chainId: 1,
      poolAddress,
      zeroForOne: false,
      amountOut: 3_000_000n,
      token0ScaleMultiplier: 1n,
      token1ScaleMultiplier: 1n,
    });

    assert.equal(calls.length, 1);
    assert.equal(result.amountIn, 1_000_000n);
    assert.equal(result.amountOut, 3_000_000n);
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

  it("holds through the getBidAskPriceImpact wrapper's fresh object literal", async () => {
    // getBidAskPriceImpact rebuilds a fresh `{ ...requestParams, depth: true }` object before
    // calling fetchBidAsk — this must not reopen the gap `ownField` closes for a direct
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
      await getBidAskPriceImpact({
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
