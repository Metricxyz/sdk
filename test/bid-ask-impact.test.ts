import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";
import { Q64, MAX_UINT128 } from "../src/constants.js";
import { toDepthBins, computeReferencePriceX64 } from "../src/bidAsk/depth.js";
import { computePriceImpactExactIn, computePriceImpactExactOut } from "../src/bidAsk/impact.js";
import { parseBidAskResponse, isQuoteUnavailable } from "../src/bidAsk/parse.js";
import type {
  BidAskQuote,
  BidAskResponse,
  DepthLevel,
  DepthLevelResponse,
} from "../src/bidAsk/types.js";

const poolAddress = getAddress("0x0000000000000000000000000000000000000001");
const H = Q64 / 2n; // half of Q64 — exact, since Q64 = 2^64 is even.

// Equal-decimal scale multipliers, used by every fixture below except the unequal-decimal
// sections — those are the places where using 1n/1n would hide the bug this suite exists to catch.
const ONE = 1n;

function depthLevel(
  overrides: Partial<DepthLevel> &
    Pick<DepthLevel, "binIdx" | "cumulativeVolume" | "cumulativeInputVolume">,
): DepthLevel {
  return {
    price: 1n,
    priceImpactE6: 0n,
    ...overrides,
  };
}

function quoteFixture(overrides: Partial<BidAskQuote> = {}): BidAskQuote {
  return {
    pair: "WETH/USDC",
    poolAddress,
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

  it("defaults priceProviderStatus to unknown when absent, not healthy", () => {
    const quote = parseBidAskResponse(bidAskResponseFixture());
    assert.equal(quote.priceProviderStatus, "unknown");
  });
});

describe("isQuoteUnavailable", () => {
  it("is true only when BOTH bidAdj===0 and askAdj===MAX_UINT128 (the full sentinel)", () => {
    const quote = quoteFixture({ bidAdj: 0n, askAdj: MAX_UINT128 });
    assert.equal(isQuoteUnavailable(quote), true);
  });

  it("is false when only one half of the sentinel matches", () => {
    assert.equal(isQuoteUnavailable(quoteFixture({ bidAdj: 0n, askAdj: MAX_UINT128 - 1n })), false);
    assert.equal(isQuoteUnavailable(quoteFixture({ bidAdj: 1n, askAdj: MAX_UINT128 })), false);
  });
});

describe("toDepthBins", () => {
  it("skips a non-increasing-input level and keeps a zero-output bin", () => {
    const levels: DepthLevel[] = [
      // cumulativeInputVolume 0 does not strictly increase over previousInput (0) — skipped.
      depthLevel({ binIdx: 0, cumulativeVolume: 0n, cumulativeInputVolume: 0n }),
      // kept: input 1,000,000 - 0 = 1,000,000; output 0 - 0 = 0 (zero-output bin, KEPT).
      depthLevel({ binIdx: 1, cumulativeVolume: 0n, cumulativeInputVolume: 1_000_000n }),
      // duplicate/stale boundary: repeats the previous kept level's input — skipped.
      depthLevel({ binIdx: 1, cumulativeVolume: 0n, cumulativeInputVolume: 1_000_000n }),
      // kept: input 2,000,000 - 1,000,000 = 1,000,000; output 500,000 - 0 = 500,000.
      depthLevel({ binIdx: 2, cumulativeVolume: 500_000n, cumulativeInputVolume: 2_000_000n }),
    ];

    const bins = toDepthBins(levels);

    assert.equal(bins.length, 2);
    assert.equal(bins[0]!.input, 1_000_000n);
    assert.equal(bins[0]!.output, 0n);
    assert.equal(bins[0]!.level.binIdx, 1);
    assert.equal(bins[1]!.input, 1_000_000n);
    assert.equal(bins[1]!.output, 500_000n);
    assert.equal(bins[1]!.level.binIdx, 2);
  });

  it("throws when a level's cumulativeVolume decreased relative to the previous kept level", () => {
    const levels: DepthLevel[] = [
      depthLevel({ binIdx: 0, cumulativeVolume: 500_000n, cumulativeInputVolume: 1_000_000n }),
      depthLevel({ binIdx: 1, cumulativeVolume: 300_000n, cumulativeInputVolume: 2_000_000n }),
    ];

    assert.throws(
      () => toDepthBins(levels),
      /malformed depth: cumulativeVolume decreased at binIdx=1/,
    );
  });

  it("returns no bins for an empty ladder", () => {
    assert.deepEqual(toDepthBins([]), []);
  });
});

describe("computeReferencePriceX64", () => {
  it("recovers the same reference price from two different levels, on both sides", () => {
    // ask: ref = price * E6 / (E6 + impactE6) = 3*Q64 * 1,000,000 / 1,500,000 = 2*Q64.
    const askNoImpact = depthLevel({
      binIdx: 0,
      price: 2n * Q64,
      priceImpactE6: 0n,
      cumulativeVolume: 500_000n,
      cumulativeInputVolume: 1_000_000n,
    });
    const askWithImpact = depthLevel({
      binIdx: 1,
      price: 3n * Q64,
      priceImpactE6: 500_000n,
      cumulativeVolume: 1_000_000n,
      cumulativeInputVolume: 3_000_000n,
    });
    assert.equal(computeReferencePriceX64(askNoImpact, "ask"), 2n * Q64);
    assert.equal(computeReferencePriceX64(askWithImpact, "ask"), 2n * Q64);

    // bid: ref = price * E6 / (E6 - impactE6) = Q64 * 1,000,000 / 500,000 = 2*Q64.
    const bidNoImpact = depthLevel({
      binIdx: 0,
      price: 2n * Q64,
      priceImpactE6: 0n,
      cumulativeVolume: 1_000_000n,
      cumulativeInputVolume: 500_000n,
    });
    const bidWithImpact = depthLevel({
      binIdx: 1,
      price: Q64,
      priceImpactE6: 500_000n,
      cumulativeVolume: 2_000_000n,
      cumulativeInputVolume: 1_500_000n,
    });
    assert.equal(computeReferencePriceX64(bidNoImpact, "bid"), 2n * Q64);
    assert.equal(computeReferencePriceX64(bidWithImpact, "bid"), 2n * Q64);
  });

  it("throws when the denominator is non-positive", () => {
    // ask: E6 + impactE6 <= 0 requires impactE6 <= -E6.
    const badAsk = depthLevel({
      binIdx: 0,
      price: Q64,
      priceImpactE6: -1_000_000n,
      cumulativeVolume: 1n,
      cumulativeInputVolume: 1n,
    });
    assert.throws(() => computeReferencePriceX64(badAsk, "ask"), /denominator <= 0/);

    // bid: E6 - impactE6 <= 0 requires impactE6 >= E6.
    const badBid = depthLevel({
      binIdx: 0,
      price: Q64,
      priceImpactE6: 1_000_000n,
      cumulativeVolume: 1n,
      cumulativeInputVolume: 1n,
    });
    assert.throws(() => computeReferencePriceX64(badBid, "bid"), /denominator <= 0/);
  });
});

describe("computePriceImpactExactIn — unequal-decimal scale basis (WETH(18)/USDC(6))", () => {
  // token0 = WETH (18 decimals): scaled = raw * 1.
  const token0ScaleMultiplier = 1n;
  // token1 = USDC (6 decimals): scaled = raw * 10^12, normalizing both tokens to the same
  // 18-decimal-equivalent internal basis (server: `scaled = external * multiplier`).
  const token1ScaleMultiplier = 10n ** 12n;
  const ONE_WETH = 1_000_000_000_000_000_000n; // 1 WETH, raw base units (18 decimals).

  // Reference pool price: 3000 USDC per WETH. ASK fill (in=token1/USDC, out=token0/WETH): 1 WETH
  // out for 3006 USDC in, a true 0.2% impact. Pre-fix, the code compared the un-scaled RAW ratio
  // (≈3.006e-9 * Q64) against the scaled reference (3000*Q64): it rounds to ~0, giving
  // priceImpactE6 = -1,000,000 — exactly the regression this fixture must catch.
  const askLevel = depthLevel({
    binIdx: 0,
    price: 3006n * Q64,
    priceImpactE6: 2_000n,
    cumulativeVolume: ONE_WETH,
    cumulativeInputVolume: 3_006_000_000n,
  });

  // BID fill (in=token0/WETH, out=token1/USDC): sell exactly 1 WETH for 2994 USDC.
  const bidLevel = depthLevel({
    binIdx: 0,
    price: 2994n * Q64,
    priceImpactE6: 2_000n,
    cumulativeVolume: 2_994_000_000n,
    cumulativeInputVolume: ONE_WETH,
  });

  const quote = quoteFixture({
    depth: { asks: [askLevel], bids: [bidLevel] },
  });

  it("computes a true ~0.2% impact on the ask side, not the un-scaled -100% mistake", () => {
    const result = computePriceImpactExactIn({
      quote,
      amountIn: 3_006_000_000n,
      zeroForOne: false,
      token0ScaleMultiplier,
      token1ScaleMultiplier,
    });

    assert.equal(result.amountOut, ONE_WETH);
    assert.equal(result.executionPriceX64, 3006n * Q64);
    assert.equal(result.referencePriceX64, 3000n * Q64);
    assert.equal(result.priceImpactE6, 2_000n);
    assert.ok(result.priceImpactE6 > 0n, "ask-side impact must be positive (worse for the trader)");
  });

  it("computes a true ~0.2% impact on the bid side, not the un-scaled -100% mistake", () => {
    const result = computePriceImpactExactIn({
      quote,
      amountIn: ONE_WETH,
      zeroForOne: true,
      token0ScaleMultiplier,
      token1ScaleMultiplier,
    });

    assert.equal(result.amountOut, 2_994_000_000n);
    assert.equal(result.executionPriceX64, 2994n * Q64);
    assert.equal(result.referencePriceX64, 3000n * Q64);
    assert.equal(result.priceImpactE6, 2_000n);
    assert.ok(result.priceImpactE6 > 0n, "bid-side impact must be positive (worse for the trader)");
  });

  it("computePriceImpactExactOut lands on the same numbers, ask side (in=token1, out=token0)", () => {
    const result = computePriceImpactExactOut({
      quote,
      amountOut: ONE_WETH,
      zeroForOne: false,
      token0ScaleMultiplier,
      token1ScaleMultiplier,
    });

    assert.equal(result.amountIn, 3_006_000_000n);
    assert.equal(result.executionPriceX64, 3006n * Q64);
    assert.equal(result.referencePriceX64, 3000n * Q64);
    assert.equal(result.priceImpactE6, 2_000n);
  });

  it("computePriceImpactExactOut lands on the same numbers, bid side (in=token0, out=token1)", () => {
    const result = computePriceImpactExactOut({
      quote,
      amountOut: 2_994_000_000n,
      zeroForOne: true,
      token0ScaleMultiplier,
      token1ScaleMultiplier,
    });

    assert.equal(result.amountIn, ONE_WETH);
    assert.equal(result.executionPriceX64, 2994n * Q64);
    assert.equal(result.referencePriceX64, 3000n * Q64);
    assert.equal(result.priceImpactE6, 2_000n);
  });
});

describe("computePriceImpactExactIn — unequal-decimal scale basis (mirrored: 6-decimal token0)", () => {
  // Mirror of the section above with token0/token1 swapped: token0 = a 6-decimal token, token1
  // = an 18-decimal token. Every other fixture in this file leaves token0ScaleMultiplier at
  // `1n`, so without this mirror the token0 half of the basis conversion in
  // `buildPriceImpactResult` would have zero coverage: dropping token0ScaleMultiplier, squaring
  // it, moving it to the numerator, or hardcoding it to `1n` would all silently pass every other
  // test in this suite.
  const token0ScaleMultiplier = 10n ** 12n; // token0: 6 decimals, scaled up to the 18-decimal basis.
  const token1ScaleMultiplier = 1n; // token1: 18 decimals, already at the internal basis.
  const ONE_TOKEN1 = 10n ** 18n; // "1 unit" of the 18-decimal token1, raw base units.

  // Reference (scaled) pool price: 1000 * Q64.
  // ASK fill (in=token1, out=token0): sell 1002 (raw, 18-decimal) token1 for 1 unit (1,000,000
  // raw, 6-decimal) of token0. priceImpactE6 = 2000 (a true 0.2%) — see the WETH/USDC section's
  // comments for the derivation; only the token0/token1 roles are swapped here.
  const askLevel = depthLevel({
    binIdx: 0,
    price: 1002n * Q64,
    priceImpactE6: 2_000n,
    cumulativeVolume: 1_000_000n, // token0 out, raw (1 unit, 6 decimals)
    cumulativeInputVolume: 1002n * ONE_TOKEN1, // token1 in, raw
  });

  // BID fill (in=token0, out=token1): sell 1 unit of token0 for 998 (raw) token1.
  const bidLevel = depthLevel({
    binIdx: 0,
    price: 998n * Q64,
    priceImpactE6: 2_000n,
    cumulativeVolume: 998n * ONE_TOKEN1, // token1 out, raw
    cumulativeInputVolume: 1_000_000n, // token0 in, raw (1 unit, 6 decimals)
  });

  const quote = quoteFixture({
    depth: { asks: [askLevel], bids: [bidLevel] },
  });

  it("computes a true ~0.2% impact on the ask side using token0ScaleMultiplier", () => {
    const result = computePriceImpactExactIn({
      quote,
      amountIn: 1002n * ONE_TOKEN1,
      zeroForOne: false,
      token0ScaleMultiplier,
      token1ScaleMultiplier,
    });

    assert.equal(result.amountOut, 1_000_000n);
    assert.equal(result.executionPriceX64, 1002n * Q64);
    assert.equal(result.referencePriceX64, 1000n * Q64);
    assert.equal(result.priceImpactE6, 2_000n);
    assert.ok(result.priceImpactE6 > 0n, "ask-side impact must be positive (worse for the trader)");
  });

  it("computes a true ~0.2% impact on the bid side using token0ScaleMultiplier", () => {
    const result = computePriceImpactExactIn({
      quote,
      amountIn: 1_000_000n,
      zeroForOne: true,
      token0ScaleMultiplier,
      token1ScaleMultiplier,
    });

    assert.equal(result.amountOut, 998n * ONE_TOKEN1);
    assert.equal(result.executionPriceX64, 998n * Q64);
    assert.equal(result.referencePriceX64, 1000n * Q64);
    assert.equal(result.priceImpactE6, 2_000n);
    assert.ok(result.priceImpactE6 > 0n, "bid-side impact must be positive (worse for the trader)");
  });

  it("rejects a swapped token0ScaleMultiplier/token1ScaleMultiplier (implausible-magnitude guard)", () => {
    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 1002n * ONE_TOKEN1,
          zeroForOne: false,
          token0ScaleMultiplier: token1ScaleMultiplier, // swapped with token1's
          token1ScaleMultiplier: token0ScaleMultiplier, // swapped with token0's
        }),
      /implausible priceImpactE6/,
    );
  });

  it("rejects (1n, 1n) multipliers on this pool (implausible-magnitude guard)", () => {
    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 1002n * ONE_TOKEN1,
          zeroForOne: false,
          token0ScaleMultiplier: 1n,
          token1ScaleMultiplier: 1n,
        }),
      /implausible priceImpactE6/,
    );
  });

  it("computePriceImpactExactOut lands on the same numbers using token0ScaleMultiplier (ask side)", () => {
    const result = computePriceImpactExactOut({
      quote,
      amountOut: 1_000_000n,
      zeroForOne: false,
      token0ScaleMultiplier,
      token1ScaleMultiplier,
    });

    assert.equal(result.amountIn, 1002n * ONE_TOKEN1);
    assert.equal(result.executionPriceX64, 1002n * Q64);
    assert.equal(result.referencePriceX64, 1000n * Q64);
    assert.equal(result.priceImpactE6, 2_000n);
  });

  it("computePriceImpactExactOut lands on the same numbers using token0ScaleMultiplier (bid side)", () => {
    const result = computePriceImpactExactOut({
      quote,
      amountOut: 998n * ONE_TOKEN1,
      zeroForOne: true,
      token0ScaleMultiplier,
      token1ScaleMultiplier,
    });

    assert.equal(result.amountIn, 1_000_000n);
    assert.equal(result.executionPriceX64, 998n * Q64);
    assert.equal(result.referencePriceX64, 1000n * Q64);
    assert.equal(result.priceImpactE6, 2_000n);
  });

  it("computePriceImpactExactOut also rejects a swapped token0ScaleMultiplier/token1ScaleMultiplier (implausible-magnitude guard)", () => {
    assert.throws(
      () =>
        computePriceImpactExactOut({
          quote,
          amountOut: 1_000_000n,
          zeroForOne: false,
          token0ScaleMultiplier: token1ScaleMultiplier, // swapped with token1's
          token1ScaleMultiplier: token0ScaleMultiplier, // swapped with token0's
        }),
      /implausible priceImpactE6/,
    );
  });
});

describe("computePriceImpactExactIn — implausible-impact guards", () => {
  it("rejects a degenerate ratio (ratio===0n) from an absurdly large corrupted price", () => {
    // price is many orders of magnitude larger than any real pool price could be — this is what
    // a corrupted wire `price` (or a caller hand-building JSON) looks like, not a real move.
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({
            binIdx: 0,
            price: Q64 * 10n ** 30n,
            priceImpactE6: 0n,
            cumulativeVolume: 500_000n,
            cumulativeInputVolume: 1_000_000n,
          }),
        ],
      },
    });

    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 1_000_000n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /degenerate price ratio/,
    );
  });

  it("does not reject a legitimately tiny (near-zero, even negative) impact", () => {
    // A fill landing almost exactly on the reference price floors to a small NEGATIVE
    // priceImpactE6 near zero (999,999 raw in against a 1,000,000-for-1,000,000 reference) — this
    // must NOT be treated as an error; only the ratio===0n degeneracy is, never a bare sign check.
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({
            binIdx: 0,
            price: Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 1_000_000n,
            cumulativeInputVolume: 999_999n,
          }),
        ],
      },
    });

    const result = computePriceImpactExactIn({
      quote,
      amountIn: 999_999n,
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });

    assert.equal(result.priceImpactE6, -2n);
  });
});

describe("computePriceImpactExactIn — ladder walk", () => {
  it("fills a bin exactly on its boundary, then mid-bin with pro-rata floor rounding (ask side)", () => {
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({
            binIdx: 0,
            price: 2n * Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 500_000n,
            cumulativeInputVolume: 1_000_000n,
          }),
          depthLevel({
            binIdx: 1,
            price: 3n * Q64,
            priceImpactE6: 500_000n,
            cumulativeVolume: 1_500_000n,
            cumulativeInputVolume: 4_000_000n,
          }),
        ],
      },
    });
    const fill = (amountIn: bigint) =>
      computePriceImpactExactIn({
        quote,
        amountIn,
        zeroForOne: false,
        token0ScaleMultiplier: ONE,
        token1ScaleMultiplier: ONE,
      });

    // Exactly on bin0's boundary: average impact equals the boundary's own impact (0).
    const boundary = fill(1_000_000n);
    assert.equal(boundary.amountOut, 500_000n);
    assert.equal(boundary.binsCrossed, 1);
    assert.equal(boundary.priceImpactE6, 0n);
    assert.equal(boundary.marginalPriceImpactE6, 0n);
    // effectivePriceX64 is un-normalized and so, unlike executionPriceX64, does NOT flip
    // for the ask side — it's the inverse here, not the same value.
    assert.equal(boundary.effectivePriceX64, H);

    // Mid-bin1: fillOutput = floor(1,000,000 * 1,000,000 / 3,000,000) = 333,333 (pro-rata floor).
    const midBin = fill(2_000_000n);
    assert.equal(midBin.amountOut, 500_000n + 333_333n);
    assert.equal(midBin.binsCrossed, 2);
    assert.equal(midBin.marginalPriceImpactE6, 500_000n);
    assert.notEqual(midBin.priceImpactE6, midBin.marginalPriceImpactE6); // average != marginal.
    assert.ok(midBin.priceImpactE6 > 0n);
  });

  it("orientation flips between bid and ask, both positive impact", () => {
    // Bid side: in=token0, out=token1.
    const bidQuote = quoteFixture({
      depth: {
        bids: [
          depthLevel({
            binIdx: 0,
            price: 2n * Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 1_000_000n,
            cumulativeInputVolume: 500_000n,
          }),
          depthLevel({
            binIdx: 1,
            price: Q64,
            priceImpactE6: 500_000n,
            cumulativeVolume: 2_000_000n,
            cumulativeInputVolume: 1_500_000n,
          }),
        ],
        asks: [],
      },
    });
    // amountIn = 500,000 (bin1 full) + 500,000 (half of bin2) -> amountOut = 1,500,000.
    const bidResult = computePriceImpactExactIn({
      quote: bidQuote,
      amountIn: 1_000_000n,
      zeroForOne: true,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });
    assert.equal(bidResult.amountOut, 1_000_000n + 500_000n);
    assert.equal(bidResult.executionPriceX64, 3n * H); // amountOut*Q64/amountIn = 1.5*Q64.
    assert.equal(bidResult.referencePriceX64, 2n * Q64);
    assert.equal(bidResult.priceImpactE6, 250_000n); // E6 - (1.5*Q64*E6/(2*Q64)) = 250,000.
    assert.ok(bidResult.priceImpactE6 > 0n);

    // Ask side: in=token1, out=token0. Land exactly on the second boundary for clean numbers.
    const askQuote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({
            binIdx: 0,
            price: 2n * Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 500_000n,
            cumulativeInputVolume: 1_000_000n,
          }),
          depthLevel({
            binIdx: 1,
            price: 3n * Q64,
            priceImpactE6: 500_000n,
            cumulativeVolume: 1_000_000n,
            cumulativeInputVolume: 3_000_000n,
          }),
        ],
      },
    });
    const askResult = computePriceImpactExactIn({
      quote: askQuote,
      amountIn: 3_000_000n,
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });
    assert.equal(askResult.amountOut, 1_000_000n);
    // ask: executionPriceX64 = amountIn*Q64/amountOut = 3*Q64 (using the BID formula here,
    // amountOut/amountIn, would wrongly give Q64/3).
    assert.equal(askResult.executionPriceX64, 3n * Q64);
    assert.equal(askResult.referencePriceX64, 2n * Q64);
    assert.equal(askResult.priceImpactE6, 500_000n);
    assert.ok(askResult.priceImpactE6 > 0n);
    // Landing exactly on the boundary again makes the average equal the marginal.
    assert.equal(askResult.marginalPriceImpactE6, askResult.priceImpactE6);
  });

  it("skips a zero-output bin without consuming its input", () => {
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          // Zero-output bin: input 1,000,000, output 0. A fill must skip this WITHOUT spending
          // any of amountIn on it — otherwise the second (real) bin never gets filled.
          depthLevel({
            binIdx: 0,
            price: Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 0n,
            cumulativeInputVolume: 1_000_000n,
          }),
          depthLevel({
            binIdx: 1,
            price: 2n * Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 500_000n,
            cumulativeInputVolume: 2_000_000n,
          }),
        ],
      },
    });

    // amountIn equals exactly the real bin's marginal input (2,000,000 - 1,000,000 = 1,000,000).
    // If the zero-output bin's input were consumed instead, this amount would be exhausted on
    // it (producing zero output, then throwing "fill produced zero output").
    const result = computePriceImpactExactIn({
      quote,
      amountIn: 1_000_000n,
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });

    assert.equal(result.amountOut, 500_000n);
    assert.equal(result.binsCrossed, 1);
  });

  it("throws on insufficient depth, naming the requested and available amounts", () => {
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({
            binIdx: 0,
            price: Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 500_000n,
            cumulativeInputVolume: 1_000_000n,
          }),
        ],
      },
    });

    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 5_000_000n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /insufficient depth.*amountIn=5000000.*available/,
    );
  });
});

describe("computePriceImpactExactOut — ladder walk", () => {
  it("rounds the fill input UP so realized output never falls short (666667n, not the floor 666666n)", () => {
    // A single bin from the origin: input=1,000,000, output=3,000,000. `price` is set to this
    // bin's own full-fill rate (floor(Q64/3)) with zero recorded impact, so the plausibility
    // guard sees a consistent ladder rather than a placeholder that happens to diverge from it.
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({
            binIdx: 0,
            price: Q64 / 3n,
            priceImpactE6: 0n,
            cumulativeVolume: 3_000_000n,
            cumulativeInputVolume: 1_000_000n,
          }),
        ],
      },
    });

    const result = computePriceImpactExactOut({
      quote,
      amountOut: 2_000_000n,
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });

    // floor(1,000,000 * 2,000,000 / 3,000,000) = 666,666 would under-deliver the requested
    // output; ceilDiv rounds up to 666,667 (mirrors score_depth_leg_exact_out/mul_div_u128_ceil).
    assert.equal(result.amountIn, 666_667n);
    assert.equal(result.amountOut, 2_000_000n);
  });

  it("throws on insufficient depth, naming the requested and available amounts", () => {
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({
            binIdx: 0,
            price: Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 500_000n,
            cumulativeInputVolume: 1_000_000n,
          }),
        ],
      },
    });

    assert.throws(
      () =>
        computePriceImpactExactOut({
          quote,
          amountOut: 5_000_000n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /insufficient depth.*amountOut=5000000.*available/,
    );
  });
});

describe("computePriceImpactExactIn — input validation", () => {
  it("throws when amountIn, token0ScaleMultiplier, or token1ScaleMultiplier is not positive", () => {
    const quote = quoteFixture({ depth: { bids: [], asks: [] } });
    const base = {
      quote,
      amountIn: 1n,
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    };

    for (const amountIn of [0n, -1n]) {
      assert.throws(() => computePriceImpactExactIn({ ...base, amountIn }), /amountIn must be > 0/);
    }
    assert.throws(
      () => computePriceImpactExactIn({ ...base, token0ScaleMultiplier: 0n }),
      /token0ScaleMultiplier must be > 0/,
    );
    assert.throws(
      () => computePriceImpactExactIn({ ...base, token1ScaleMultiplier: -1n }),
      /token1ScaleMultiplier must be > 0/,
    );
  });

  it("throws when depth is null", () => {
    const quote = quoteFixture({ depth: null });
    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 1n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /depth=false/,
    );
  });

  it("throws mentioning priceProviderStatus when the quote is unavailable", () => {
    const quote = quoteFixture({
      bidAdj: 0n,
      askAdj: MAX_UINT128,
      priceProviderStatus: "feed_down",
      depth: { bids: [], asks: [] },
    });
    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 1n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /unavailable.*feed_down/,
    );
  });
});
