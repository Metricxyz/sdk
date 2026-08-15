import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";
import { MAX_UINT128 } from "../src/constants.js";
import { parseBidAskResponse, isQuoteUnavailable } from "../src/bidAsk/parse.js";
import type { BidAskQuote, BidAskResponse, DepthLevelResponse } from "../src/bidAsk/types.js";

function bidAskResponseFixture(overrides: Partial<BidAskResponse> = {}): BidAskResponse {
  return {
    pair: "WETH/USDC",
    poolAddress: "0x0000000000000000000000000000000000000001",
    bidAdj: "1",
    askAdj: "2",
    serverTs: 1_700_000_000,
    depth: { asks: [], bids: [] },
    ...overrides,
  };
}

function levelFixture(
  overrides: Partial<DepthLevelResponse> &
    Pick<DepthLevelResponse, "binIdx" | "cumulativeVolume" | "cumulativeInputVolume">,
): DepthLevelResponse {
  return {
    price: "1",
    priceImpactE6: "0",
    ...overrides,
  };
}

function quoteFixture(overrides: Partial<BidAskQuote> = {}): BidAskQuote {
  return {
    pair: "WETH/USDC",
    poolAddress: getAddress("0x0000000000000000000000000000000000000001"),
    bidAdj: 1n,
    askAdj: 2n,
    totalToken0Available: null,
    totalToken1Available: null,
    serverTs: 1_700_000_000,
    depth: null,
    priceProviderStatus: "healthy",
    ...overrides,
  };
}

/** Asserts `fn` throws a named `Error` (never a bare `TypeError`) whose message matches. */
function assertThrowsNamedError(fn: () => unknown, messagePattern: RegExp): void {
  assert.throws(fn, messagePattern);
  try {
    fn();
    assert.fail("expected fn to throw");
  } catch (error) {
    assert.ok(error instanceof Error, "expected an Error instance");
    assert.ok(!(error instanceof TypeError), "expected a named module error, not a bare TypeError");
  }
}

describe("parseBidAskResponse", () => {
  it("checksums poolAddress even when the wire value is lowercased", () => {
    // Deliberately has hex letters (a-f) so a skipped getAddress() call is actually
    // detectable: an all-numeric address would look "checksummed" either way.
    const lowerCaseAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const expectedChecksum = getAddress(lowerCaseAddress);
    assert.notEqual(expectedChecksum, lowerCaseAddress); // sanity: casing actually changes

    const quote = parseBidAskResponse(bidAskResponseFixture({ poolAddress: lowerCaseAddress }));
    assert.equal(quote.poolAddress, expectedChecksum);
  });

  it("throws naming poolAddress when the wire value is not a valid address", () => {
    assert.throws(
      () => parseBidAskResponse(bidAskResponseFixture({ poolAddress: "not-an-address" })),
      /invalid poolAddress/,
    );
  });

  it("parses totalToken0Available and totalToken1Available without swapping them", () => {
    const quote = parseBidAskResponse(
      bidAskResponseFixture({
        totalToken0Available: "123456789000000000000",
        totalToken1Available: "42000000",
      }),
    );
    assert.equal(quote.totalToken0Available, 123_456_789_000_000_000_000n);
    assert.equal(quote.totalToken1Available, 42_000_000n);
  });

  it("defaults totalToken0Available/totalToken1Available to null when absent", () => {
    const quote = parseBidAskResponse(bidAskResponseFixture());
    assert.equal(quote.totalToken0Available, null);
    assert.equal(quote.totalToken1Available, null);
  });

  it("defaults priceProviderStatus to unknown when absent, not healthy", () => {
    const quote = parseBidAskResponse(bidAskResponseFixture());
    assert.equal(quote.priceProviderStatus, "unknown");
    assert.notEqual(quote.priceProviderStatus, "healthy");
  });

  it("keeps an explicit priceProviderStatus as-is", () => {
    const quote = parseBidAskResponse(bidAskResponseFixture({ priceProviderStatus: "feed_down" }));
    assert.equal(quote.priceProviderStatus, "feed_down");
  });

  it("parses a negative priceImpactE6 on a depth level (impact can be sign-negative)", () => {
    const quote = parseBidAskResponse(
      bidAskResponseFixture({
        depth: {
          bids: [],
          asks: [
            levelFixture({
              binIdx: 0,
              cumulativeVolume: "1",
              cumulativeInputVolume: "1",
              priceImpactE6: "-100000",
            }),
          ],
        },
      }),
    );
    assert.equal(quote.depth?.asks[0]?.priceImpactE6, -100_000n);
  });

  it("rejects a zero price on a depth level (the dedicated > 0 guard)", () => {
    const response = bidAskResponseFixture({
      depth: {
        bids: [],
        asks: [
          levelFixture({
            binIdx: 0,
            cumulativeVolume: "1",
            cumulativeInputVolume: "1",
            price: "0",
          }),
        ],
      },
    });
    assert.throws(
      () => parseBidAskResponse(response),
      /invalid depth\.asks\[0\]\.price: must be > 0/,
    );
  });

  it("rejects a negative price on a depth level (rejected earlier, as a non-negative amount)", () => {
    const response = bidAskResponseFixture({
      depth: {
        bids: [],
        asks: [
          levelFixture({
            binIdx: 0,
            cumulativeVolume: "1",
            cumulativeInputVolume: "1",
            price: "-5",
          }),
        ],
      },
    });
    assert.throws(
      () => parseBidAskResponse(response),
      /depth\.asks\[0\]\.price must be non-negative/,
    );
  });

  it("throws a named error (not a TypeError) when depth.asks is present but not an array", () => {
    const response = bidAskResponseFixture({
      depth: { asks: "not-an-array" as unknown as DepthLevelResponse[], bids: [] },
    });
    assertThrowsNamedError(
      () => parseBidAskResponse(response),
      /invalid depth\.asks: expected an array, got string/,
    );
  });

  it("throws a named error (not a TypeError) when depth.bids is present but not an array", () => {
    const response = bidAskResponseFixture({
      depth: { asks: [], bids: 42 as unknown as DepthLevelResponse[] },
    });
    assertThrowsNamedError(
      () => parseBidAskResponse(response),
      /invalid depth\.bids: expected an array, got number/,
    );
  });

  describe("strict decimal wire parsing", () => {
    const invalidDecimalWireValues: Array<{ label: string; value: unknown }> = [
      { label: "empty string", value: "" },
      { label: "hex-prefixed string", value: "0x10" },
      { label: "decimal-point string", value: "1.5" },
      { label: "leading-space string", value: " 1" },
      { label: "a JSON number (non-string)", value: 5 },
    ];

    for (const { label, value } of invalidDecimalWireValues) {
      it(`rejects ${label} for the scalar field bidAdj`, () => {
        const response = bidAskResponseFixture({ bidAdj: value as unknown as string });
        assert.throws(() => parseBidAskResponse(response), /invalid bidAdj/);
      });
    }

    for (const { label, value } of invalidDecimalWireValues) {
      it(`rejects ${label} for depth.asks[0].cumulativeVolume`, () => {
        const response = bidAskResponseFixture({
          depth: {
            bids: [],
            asks: [
              levelFixture({
                binIdx: 0,
                cumulativeVolume: value as unknown as string,
                cumulativeInputVolume: "1",
              }),
            ],
          },
        });
        assert.throws(
          () => parseBidAskResponse(response),
          /invalid depth\.asks\[0\]\.cumulativeVolume/,
        );
      });
    }

    for (const { label, value } of invalidDecimalWireValues) {
      it(`rejects ${label} for depth.asks[0].price`, () => {
        const response = bidAskResponseFixture({
          depth: {
            bids: [],
            asks: [
              levelFixture({
                binIdx: 0,
                cumulativeVolume: "1",
                cumulativeInputVolume: "1",
                price: value as unknown as string,
              }),
            ],
          },
        });
        assert.throws(() => parseBidAskResponse(response), /invalid depth\.asks\[0\]\.price/);
      });
    }

    for (const { label, value } of invalidDecimalWireValues) {
      it(`rejects ${label} for depth.asks[0].priceImpactE6`, () => {
        const response = bidAskResponseFixture({
          depth: {
            bids: [],
            asks: [
              levelFixture({
                binIdx: 0,
                cumulativeVolume: "1",
                cumulativeInputVolume: "1",
                priceImpactE6: value as unknown as string,
              }),
            ],
          },
        });
        assert.throws(
          () => parseBidAskResponse(response),
          /invalid depth\.asks\[0\]\.priceImpactE6/,
        );
      });
    }
  });
});

describe("isQuoteUnavailable", () => {
  it("is true only when BOTH bidAdj===0 and askAdj===MAX_UINT128 (the full sentinel)", () => {
    const quote = quoteFixture({ bidAdj: 0n, askAdj: MAX_UINT128 });
    assert.equal(isQuoteUnavailable(quote), true);
  });

  it("is false when only the bidAdj half of the sentinel matches", () => {
    const quote = quoteFixture({ bidAdj: 0n, askAdj: MAX_UINT128 - 1n });
    assert.equal(isQuoteUnavailable(quote), false);
  });

  it("is false when only the askAdj half of the sentinel matches", () => {
    const quote = quoteFixture({ bidAdj: 1n, askAdj: MAX_UINT128 });
    assert.equal(isQuoteUnavailable(quote), false);
  });
});
