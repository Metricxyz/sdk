import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";
import { Q64, MAX_UINT128 } from "../src/constants.js";
import { toDepthBins, computeReferencePriceX64, E6 } from "../src/bidAsk/depth.js";
import { computePriceImpactExactIn, computePriceImpactExactOut } from "../src/bidAsk/impact.js";
import type { BidAskQuote, DepthLevel } from "../src/bidAsk/types.js";

const poolAddress = getAddress("0x0000000000000000000000000000000000000001");
const H = Q64 / 2n; // half of Q64 — exact, since Q64 = 2^64 is even.

// Equal-decimal scale multipliers, used by every fixture below except the WETH/USDC one in
// "unequal-decimal scale basis" — that section is the one place where using 1n/1n would hide
// the bug this suite exists to catch.
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

describe("computePriceImpactExactIn — unequal-decimal scale basis (the basis fix)", () => {
  // token0 = WETH (18 decimals): scaled = raw * 1.
  const token0ScaleMultiplier = 1n;
  // token1 = USDC (6 decimals): scaled = raw * 10^12, normalizing both tokens to the same
  // 18-decimal-equivalent internal basis (server: `scaled = external * multiplier`).
  const token1ScaleMultiplier = 10n ** 12n;
  const ONE_WETH = 1_000_000_000_000_000_000n; // 1 WETH, raw base units (18 decimals).

  // Reference pool price: 3000 USDC per WETH. With token0's multiplier = 1 and token1's
  // multiplier normalizing USDC up to 18-decimal-equivalent, the SCALED price ratio equals
  // the plain human price — so referencePriceX64 = 3000 * Q64.
  //
  // ASK fill (in=token1/USDC, out=token0/WETH): fill exactly 1 WETH out for 3006 USDC in.
  // scaledExecutionPriceX64 = (3,006,000,000 raw-USDC * 1e12 * Q64) / (1e18 raw-WETH * 1)
  //                         = (3,006,000,000 * 1e12 / 1e18) * Q64 = 3006 * Q64.
  // referencePriceX64 (recovered) = 3006*Q64 * E6 / (E6 + 2000) = 3006*Q64 * 1,000,000/1,002,000
  //                                = 3000 * Q64 (1,002,000 * 3000 == 3,006,000,000, exact).
  // priceImpactE6 = 3006*Q64*E6/(3000*Q64) - E6 = 1,002,000 - 1,000,000 = 2000 — a true 0.2%.
  //
  // Pre-fix, the code compared the RAW ratio (3,006,000,000 * Q64 / 1e18 ≈ 3.006e-9 * Q64)
  // against this same scaled reference (3000*Q64): the ratio rounds to ~0, giving
  // priceImpactE6 = 0 - E6 = -1,000,000 — exactly the regression this fixture must catch.
  const askLevel = depthLevel({
    binIdx: 0,
    price: 3006n * Q64,
    priceImpactE6: 2_000n,
    cumulativeVolume: ONE_WETH,
    cumulativeInputVolume: 3_006_000_000n,
  });

  // BID fill (in=token0/WETH, out=token1/USDC): sell exactly 1 WETH for 2994 USDC.
  // scaledExecutionPriceX64 = (2,994,000,000 * 1e12 * Q64) / (1e18 * 1) = 2994 * Q64.
  // referencePriceX64 = 2994*Q64 * E6 / (E6 - 2000) = 2994*Q64 * 1,000,000/998,000
  //                    = 3000 * Q64 (998,000 * 3000 == 2,994,000,000, exact).
  // priceImpactE6 = E6 - 2994*Q64*E6/(3000*Q64) = 1,000,000 - 998,000 = 2000 — again 0.2%.
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
    assert.equal(result.scaledExecutionPriceX64, 3006n * Q64);
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
    assert.equal(result.scaledExecutionPriceX64, 2994n * Q64);
    assert.equal(result.referencePriceX64, 3000n * Q64);
    assert.equal(result.priceImpactE6, 2_000n);
    assert.ok(result.priceImpactE6 > 0n, "bid-side impact must be positive (worse for the trader)");
  });

  it("rejects a non-positive token0ScaleMultiplier", () => {
    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: ONE_WETH,
          zeroForOne: true,
          token0ScaleMultiplier: 0n,
          token1ScaleMultiplier,
        }),
      /token0ScaleMultiplier must be > 0/,
    );
  });

  it("rejects a non-positive token1ScaleMultiplier", () => {
    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 3_006_000_000n,
          zeroForOne: false,
          token0ScaleMultiplier,
          token1ScaleMultiplier: -1n,
        }),
      /token1ScaleMultiplier must be > 0/,
    );
  });
});

describe("computePriceImpactExactOut — unequal-decimal scale basis", () => {
  it("rejects non-positive scale multipliers the same way exact-in does", () => {
    const quote = quoteFixture({ depth: { asks: [], bids: [] } });
    assert.throws(
      () =>
        computePriceImpactExactOut({
          quote,
          amountOut: 1n,
          zeroForOne: true,
          token0ScaleMultiplier: -5n,
          token1ScaleMultiplier: 1n,
        }),
      /token0ScaleMultiplier must be > 0/,
    );
    assert.throws(
      () =>
        computePriceImpactExactOut({
          quote,
          amountOut: 1n,
          zeroForOne: true,
          token0ScaleMultiplier: 1n,
          token1ScaleMultiplier: 0n,
        }),
      /token1ScaleMultiplier must be > 0/,
    );
  });
});

describe("computePriceImpactExactIn — unequal-decimal scale basis (mirrored: 6-decimal token0)", () => {
  // Mirror of the "unequal-decimal scale basis (the basis fix)" fixture above with token0/token1
  // swapped: token0 = a 6-decimal token, token1 = an 18-decimal token — the OPPOSITE direction
  // from that fixture, so this exercises `token0ScaleMultiplier` specifically. Every fixture
  // above (and every other fixture in this file) leaves token0ScaleMultiplier at `1n`, so the
  // token0 half of the basis conversion in `buildPriceImpactResult` has zero coverage without
  // this: dropping token0ScaleMultiplier, squaring it, moving it to the numerator, or hardcoding
  // it to `1n` would all silently pass every other test in this suite.
  const token0ScaleMultiplier = 10n ** 12n; // token0: 6 decimals, scaled up to the 18-decimal basis.
  const token1ScaleMultiplier = 1n; // token1: 18 decimals, already at the internal basis.
  const ONE_TOKEN1 = 10n ** 18n; // "1 unit" of the 18-decimal token1, raw base units.

  // Reference (scaled) pool price: 1000 * Q64.
  //
  // ASK fill (in=token1, out=token0): sell 1002 (raw, 18-decimal) token1 for 1 unit (1,000,000
  // raw, 6-decimal) of token0.
  // scaledExecutionPriceX64 = (1002*1e18 * 1 * Q64) / (1,000,000 * 1e12) = 1002 * Q64.
  // referencePriceX64 = 1002*Q64 * E6/(E6+2000) = 1002*Q64*1,000,000/1,002,000 = 1000*Q64
  //                     (1,002,000 * 1000 == 1,002,000,000 == 1002 * 1,000,000, exact).
  // priceImpactE6 = 1002*Q64*E6/(1000*Q64) - E6 = 1,002,000 - 1,000,000 = 2000 — a true 0.2%.
  const askLevel = depthLevel({
    binIdx: 0,
    price: 1002n * Q64,
    priceImpactE6: 2_000n,
    cumulativeVolume: 1_000_000n, // token0 out, raw (1 unit, 6 decimals)
    cumulativeInputVolume: 1002n * ONE_TOKEN1, // token1 in, raw
  });

  // BID fill (in=token0, out=token1): sell 1 unit of token0 for 998 (raw) token1.
  // scaledExecutionPriceX64 = (998*1e18 * 1 * Q64) / (1,000,000 * 1e12) = 998 * Q64.
  // referencePriceX64 = 998*Q64 * E6/(E6-2000) = 998*Q64*1,000,000/998,000 = 1000*Q64
  //                    (998,000 * 1000 == 998,000,000 == 998 * 1,000,000, exact).
  // priceImpactE6 = E6 - 998*Q64*E6/(1000*Q64) = 1,000,000 - 998,000 = 2000.
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
    assert.equal(result.scaledExecutionPriceX64, 1002n * Q64);
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
    assert.equal(result.scaledExecutionPriceX64, 998n * Q64);
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

    const { bins, truncatedAtLevel } = toDepthBins(levels);

    assert.equal(truncatedAtLevel, null);
    assert.equal(bins.length, 2);
    assert.equal(bins[0]!.input, 1_000_000n);
    assert.equal(bins[0]!.output, 0n);
    assert.equal(bins[0]!.level.binIdx, 1);
    assert.equal(bins[1]!.input, 1_000_000n);
    assert.equal(bins[1]!.output, 500_000n);
    assert.equal(bins[1]!.level.binIdx, 2);
  });

  it("stops (without throwing) at a level whose cumulativeVolume decreased, and reports it", () => {
    const decreasing = depthLevel({
      binIdx: 1,
      cumulativeVolume: 300_000n,
      cumulativeInputVolume: 2_000_000n,
    });
    const levels: DepthLevel[] = [
      depthLevel({ binIdx: 0, cumulativeVolume: 500_000n, cumulativeInputVolume: 1_000_000n }),
      decreasing,
    ];

    const { bins, truncatedAtLevel } = toDepthBins(levels);

    assert.equal(bins.length, 1);
    assert.equal(bins[0]!.level.binIdx, 0);
    assert.equal(truncatedAtLevel, decreasing);
  });

  it("returns no bins and no truncation for an empty ladder", () => {
    assert.deepEqual(toDepthBins([]), { bins: [], truncatedAtLevel: null });
  });
});

describe("computeReferencePriceX64", () => {
  const askLevelA = depthLevel({
    binIdx: 0,
    price: 2n * Q64,
    priceImpactE6: 0n,
    cumulativeVolume: 500_000n,
    cumulativeInputVolume: 1_000_000n,
  });
  const askLevelB = depthLevel({
    binIdx: 1,
    price: 3n * Q64,
    // ref = price * E6 / (E6 + impactE6) = 3*Q64 * 1,000,000 / 1,500,000 = 2*Q64.
    priceImpactE6: 500_000n,
    cumulativeVolume: 1_000_000n,
    cumulativeInputVolume: 3_000_000n,
  });

  it("recovers the same ask reference price from two different levels", () => {
    assert.equal(computeReferencePriceX64(askLevelA, "ask"), 2n * Q64);
    assert.equal(computeReferencePriceX64(askLevelB, "ask"), 2n * Q64);
  });

  it("round-trips a level's own priceImpactE6 from its recovered reference (ask)", () => {
    const ref = computeReferencePriceX64(askLevelB, "ask");
    const recomputed = (askLevelB.price * E6) / ref - E6;
    assert.equal(recomputed, askLevelB.priceImpactE6);
  });

  const bidLevelA = depthLevel({
    binIdx: 0,
    price: 2n * Q64,
    priceImpactE6: 0n,
    cumulativeVolume: 1_000_000n,
    cumulativeInputVolume: 500_000n,
  });
  const bidLevelB = depthLevel({
    binIdx: 1,
    price: Q64,
    // ref = price * E6 / (E6 - impactE6) = Q64 * 1,000,000 / 500,000 = 2*Q64.
    priceImpactE6: 500_000n,
    cumulativeVolume: 2_000_000n,
    cumulativeInputVolume: 1_500_000n,
  });

  it("recovers the same bid reference price from two different levels", () => {
    assert.equal(computeReferencePriceX64(bidLevelA, "bid"), 2n * Q64);
    assert.equal(computeReferencePriceX64(bidLevelB, "bid"), 2n * Q64);
  });

  it("round-trips a level's own priceImpactE6 from its recovered reference (bid)", () => {
    const ref = computeReferencePriceX64(bidLevelB, "bid");
    const recomputed = E6 - (bidLevelB.price * E6) / ref;
    assert.equal(recomputed, bidLevelB.priceImpactE6);
  });

  it("recovers a higher-than-price reference for a negative (price-improving) ask impact", () => {
    // ref = price * E6 / (E6 + impactE6) = 9*Q64 * 1,000,000 / 900,000 = 9*Q64 * 10/9 = 10*Q64.
    const level = depthLevel({
      binIdx: 0,
      price: 9n * Q64,
      priceImpactE6: -100_000n,
      cumulativeVolume: 1n,
      cumulativeInputVolume: 1n,
    });
    assert.equal(computeReferencePriceX64(level, "ask"), 10n * Q64);
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

describe("computePriceImpactExactIn", () => {
  it("fills exactly on a bin boundary (ask side)", () => {
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
        ],
      },
    });

    const result = computePriceImpactExactIn({
      quote,
      amountIn: 1_000_000n,
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });

    // Single bin fully consumed: fillInput = min(1,000,000, 1,000,000) = 1,000,000;
    // fillOutput = floor(500,000 * 1,000,000 / 1,000,000) = 500,000.
    assert.equal(result.amountIn, 1_000_000n);
    assert.equal(result.amountOut, 500_000n);
    assert.equal(result.binsCrossed, 1);
    // ask: scaledExecutionPriceX64 = amountIn * Q64 / amountOut = 1,000,000 * Q64 / 500,000 = 2*Q64
    // (equal multipliers, so scaled == raw here).
    assert.equal(result.scaledExecutionPriceX64, 2n * Q64);
    assert.equal(result.referencePriceX64, 2n * Q64);
    // Landing exactly on the boundary: average impact equals the boundary's own impact (0).
    assert.equal(result.priceImpactE6, 0n);
    assert.equal(result.marginalPriceImpactE6, 0n);
    // effectivePriceX64 is un-normalized (always amountOut * Q64 / amountIn, regardless of side)
    // and so, unlike scaledExecutionPriceX64, does NOT flip for the ask side: 500,000 * Q64 /
    // 1,000,000 = 0.5 * Q64 — the inverse of scaledExecutionPriceX64 here, not the same value.
    assert.equal(result.effectivePriceX64, H);
  });

  it("fills mid-bin with pro-rata floor rounding (ask side)", () => {
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
    // bin2 marginal: input = 4,000,000 - 1,000,000 = 3,000,000; output = 1,500,000 - 500,000 = 1,000,000.

    const result = computePriceImpactExactIn({
      quote,
      amountIn: 2_000_000n,
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });

    // bin1 fully consumed (input 1,000,000 -> output 500,000).
    // bin2 partially consumed: fillInput = min(1,000,000 remaining, 3,000,000) = 1,000,000;
    // fillOutput = floor(1,000,000 * 1,000,000 / 3,000,000) = floor(333,333.33...) = 333,333.
    assert.equal(result.amountIn, 2_000_000n);
    assert.equal(result.amountOut, 500_000n + 333_333n);
    assert.equal(result.binsCrossed, 2);
    // The average impact and the marginal (last-level) impact are DIFFERENT numbers.
    assert.equal(result.marginalPriceImpactE6, 500_000n);
    assert.notEqual(result.priceImpactE6, result.marginalPriceImpactE6);
    assert.ok(result.priceImpactE6 > 0n);
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
    // bin1: input 500,000 -> output 1,000,000. bin2 marginal: input 1,000,000 -> output 1,000,000.
    // amountIn = 500,000 (bin1 full) + 500,000 (half of bin2) = 1,000,000.
    const bidResult = computePriceImpactExactIn({
      quote: bidQuote,
      amountIn: 1_000_000n,
      zeroForOne: true,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });
    // fillOutput bin2 = floor(1,000,000 * 500,000 / 1,000,000) = 500,000.
    assert.equal(bidResult.amountOut, 1_000_000n + 500_000n);
    // bid: scaledExecutionPriceX64 = amountOut * Q64 / amountIn = 1,500,000 * Q64 / 1,000,000 = 1.5*Q64.
    assert.equal(bidResult.scaledExecutionPriceX64, 3n * H);
    assert.equal(bidResult.referencePriceX64, 2n * Q64);
    // ratio = 1.5*Q64 * E6 / (2*Q64) = 0.75*E6 = 750,000; priceImpactE6 = E6 - ratio = 250,000.
    assert.equal(bidResult.priceImpactE6, 250_000n);
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
    // ask: scaledExecutionPriceX64 = amountIn * Q64 / amountOut = 3,000,000 * Q64 / 1,000,000 = 3*Q64.
    // (Using the BID formula here — amountOut/amountIn — would wrongly give Q64/3.)
    assert.equal(askResult.scaledExecutionPriceX64, 3n * Q64);
    assert.equal(askResult.referencePriceX64, 2n * Q64);
    // ratio = 3*Q64 * E6 / (2*Q64) = 1.5*E6 = 1,500,000; priceImpactE6 = ratio - E6 = 500,000.
    assert.equal(askResult.priceImpactE6, 500_000n);
    assert.ok(askResult.priceImpactE6 > 0n);
    // Landing exactly on the boundary again makes the average equal the marginal.
    assert.equal(askResult.marginalPriceImpactE6, askResult.priceImpactE6);
  });

  it("recovers the reference price from the FIRST crossed level, even when a deep fill's last level would trip the denominator guard", () => {
    // level0 (first crossed): small impact, denominator fine for reference recovery.
    const level0 = depthLevel({
      binIdx: 0,
      price: 2n * Q64,
      priceImpactE6: 0n,
      cumulativeVolume: 1_000_000n,
      cumulativeInputVolume: 500_000n,
    });
    // level1 (last crossed, deepest): priceImpactE6 = E6 exactly — using this level to recover
    // the bid-side reference would give denominator = E6 - E6 = 0 and throw. The fix reads the
    // reference from level0 instead, so a deep fill through both levels must still succeed.
    const level1 = depthLevel({
      binIdx: 1,
      price: Q64,
      priceImpactE6: 1_000_000n,
      cumulativeVolume: 1_500_000n,
      cumulativeInputVolume: 1_000_000n,
    });
    const quote = quoteFixture({
      depth: { bids: [level0, level1], asks: [] },
    });

    // amountIn = 500,000 (bin0 full) + 500,000 (bin1 full) = 1,000,000 — crosses both bins.
    const result = computePriceImpactExactIn({
      quote,
      amountIn: 1_000_000n,
      zeroForOne: true,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });

    assert.equal(result.binsCrossed, 2);
    assert.equal(result.amountOut, 1_500_000n);
    assert.equal(result.referencePriceX64, 2n * Q64);
    // scaledExecutionPriceX64 = 1,500,000*Q64/1,000,000 = 1.5*Q64 = 3*H.
    // ratio = 3*H*E6/(2*Q64) = 750,000; priceImpactE6 = E6 - 750,000 = 250,000.
    assert.equal(result.priceImpactE6, 250_000n);
  });

  it("skips a zero-output bin without consuming its input (exact-in)", () => {
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

  it("does not abort when a malformed level lies past the amount the fill actually needs", () => {
    const malformed = depthLevel({
      binIdx: 1,
      cumulativeVolume: 300_000n, // decreased from 500,000 — malformed from here on.
      cumulativeInputVolume: 2_000_000n,
    });
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
          malformed,
        ],
      },
    });

    // amountIn exactly fills the valid prefix (bin0); the walk never needs to reach `malformed`.
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

  it("throws naming the malformed level when the fill needs to cross it", () => {
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
          depthLevel({
            binIdx: 1,
            cumulativeVolume: 300_000n,
            cumulativeInputVolume: 2_000_000n,
          }),
        ],
      },
    });

    // amountIn exceeds the valid prefix's total input (1,000,000) — the fill needs more depth
    // than the ladder can honestly provide, so this must be reported as malformed depth, not
    // ordinary insufficient depth.
    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 1_500_000n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /malformed depth.*binIdx=1.*ask side/,
    );
  });

  it("throws the zero-output error for 1 wei against a coarse bin", () => {
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({
            binIdx: 0,
            price: Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 1n,
            cumulativeInputVolume: 1_000_000n,
          }),
        ],
      },
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
      /fill produced zero output for amountIn=1;/,
    );
  });

  it("throws a distinct empty-ladder error when the side has no levels at all", () => {
    const quote = quoteFixture({ depth: { bids: [], asks: [] } });

    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 100n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /no depth available on the ask side/,
    );
  });

  it("throws the empty-ladder error (not insufficient-depth) for an all-zero-output ladder", () => {
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({ binIdx: 0, cumulativeVolume: 0n, cumulativeInputVolume: 500_000n }),
          depthLevel({ binIdx: 1, cumulativeVolume: 0n, cumulativeInputVolume: 1_000_000n }),
        ],
      },
    });

    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 100n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /no depth available on the ask side/,
    );
  });

  it("fills exactly when amountIn equals total available across multiple bins", () => {
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({
            binIdx: 0,
            price: Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 250_000n,
            cumulativeInputVolume: 500_000n,
          }),
          depthLevel({
            binIdx: 1,
            price: 2n * Q64,
            priceImpactE6: 500_000n,
            cumulativeVolume: 500_000n,
            cumulativeInputVolume: 1_000_000n,
          }),
        ],
      },
    });

    const result = computePriceImpactExactIn({
      quote,
      amountIn: 1_000_000n, // total available input across both bins.
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });

    assert.equal(result.amountOut, 500_000n);
    assert.equal(result.binsCrossed, 2);
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

  it("throws when amountIn is not positive", () => {
    const quote = quoteFixture({ depth: { bids: [], asks: [] } });
    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: 0n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /amountIn must be > 0/,
    );
    assert.throws(
      () =>
        computePriceImpactExactIn({
          quote,
          amountIn: -1n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /amountIn must be > 0/,
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

describe("computePriceImpactExactOut", () => {
  it("rounds the required input UP (ceil), not down", () => {
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          depthLevel({
            binIdx: 0,
            price: 2n * Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 300_000n,
            cumulativeInputVolume: 1_000_000n,
          }),
        ],
      },
    });

    const result = computePriceImpactExactOut({
      quote,
      amountOut: 200_000n,
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });

    // fillOutput = min(200,000, 300,000) = 200,000.
    // fillInput = ceil(1,000,000 * 200,000 / 300,000) = ceil(666,666.66...) = 666,667.
    // A floor division here would give 666,666 — asserting the exact literal proves ceiling.
    assert.equal(result.amountIn, 666_667n);
    assert.equal(result.amountOut, 200_000n);
    assert.equal(result.binsCrossed, 1);
  });

  it("skips a zero-output bin without consuming its input (exact-out)", () => {
    const quote = quoteFixture({
      depth: {
        bids: [],
        asks: [
          // Zero-output bin. Without the skip guard, ceilDiv(bin.input * 0, bin.output=0) would
          // throw "denominator must be > 0" instead of moving on to the real bin.
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

    const result = computePriceImpactExactOut({
      quote,
      amountOut: 500_000n, // exactly the real bin's marginal output.
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });

    assert.equal(result.amountIn, 1_000_000n);
    assert.equal(result.binsCrossed, 1);
  });

  it("does not abort when a malformed level lies past the amount the fill actually needs", () => {
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
          depthLevel({
            binIdx: 1,
            cumulativeVolume: 300_000n,
            cumulativeInputVolume: 2_000_000n,
          }),
        ],
      },
    });

    const result = computePriceImpactExactOut({
      quote,
      amountOut: 500_000n, // exactly bin0's output; never needs to reach the malformed level.
      zeroForOne: false,
      token0ScaleMultiplier: ONE,
      token1ScaleMultiplier: ONE,
    });

    assert.equal(result.amountIn, 1_000_000n);
    assert.equal(result.binsCrossed, 1);
  });

  it("throws naming the malformed level when the fill needs to cross it", () => {
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
          depthLevel({
            binIdx: 1,
            cumulativeVolume: 300_000n,
            cumulativeInputVolume: 2_000_000n,
          }),
        ],
      },
    });

    assert.throws(
      () =>
        computePriceImpactExactOut({
          quote,
          amountOut: 600_000n, // exceeds bin0's 500,000 available output.
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /malformed depth.*binIdx=1.*ask side/,
    );
  });

  it("throws a distinct empty-ladder error when the side has no levels at all", () => {
    const quote = quoteFixture({ depth: { bids: [], asks: [] } });

    assert.throws(
      () =>
        computePriceImpactExactOut({
          quote,
          amountOut: 100n,
          zeroForOne: false,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /no depth available on the ask side/,
    );
  });

  it("throws on insufficient depth, naming the requested and available amounts", () => {
    const quote = quoteFixture({
      depth: {
        bids: [
          depthLevel({
            binIdx: 0,
            price: Q64,
            priceImpactE6: 0n,
            cumulativeVolume: 500_000n,
            cumulativeInputVolume: 1_000_000n,
          }),
        ],
        asks: [],
      },
    });

    assert.throws(
      () =>
        computePriceImpactExactOut({
          quote,
          amountOut: 5_000_000n,
          zeroForOne: true,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /insufficient depth.*amountOut=5000000.*available/,
    );
  });

  it("throws when amountOut is not positive", () => {
    const quote = quoteFixture({ depth: { bids: [], asks: [] } });
    assert.throws(
      () =>
        computePriceImpactExactOut({
          quote,
          amountOut: 0n,
          zeroForOne: true,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /amountOut must be > 0/,
    );
  });

  it("throws when depth is null", () => {
    const quote = quoteFixture({ depth: null });
    assert.throws(
      () =>
        computePriceImpactExactOut({
          quote,
          amountOut: 1n,
          zeroForOne: true,
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
      priceProviderStatus: "internal_error",
      depth: { bids: [], asks: [] },
    });
    assert.throws(
      () =>
        computePriceImpactExactOut({
          quote,
          amountOut: 1n,
          zeroForOne: true,
          token0ScaleMultiplier: ONE,
          token1ScaleMultiplier: ONE,
        }),
      /unavailable.*internal_error/,
    );
  });
});
