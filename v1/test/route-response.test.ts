import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAddress, type PublicClient } from "viem";
import {
  prepareExactInputFromRoute,
  type RouteResponse,
} from "../src/router/fromRoute.js";
import { encodeExactInputCalldata, encodeExactInputSingleCalldata } from "../src/router/index.js";

const tokenA = "0x0000000000000000000000000000000000000001";
const tokenB = "0x0000000000000000000000000000000000000002";
const tokenC = "0x0000000000000000000000000000000000000003";
const poolAB = "0x00000000000000000000000000000000000000aa";
const poolBC = "0x00000000000000000000000000000000000000bb";
const recipient = "0xcccccccccccccccccccccccccccccccccccccccc";

function mockPublicClient(token0ByPool: Record<string, { token0: string; token1: string }>): PublicClient {
  return {
    readContract: async ({ address, functionName }: { address: string; functionName: string }) => {
      if (functionName !== "getImmutables") {
        throw new Error(`unexpected function: ${functionName}`);
      }
      const imm = token0ByPool[address.toLowerCase()];
      if (!imm) {
        throw new Error(`unknown pool: ${address}`);
      }
      return imm;
    },
  } as unknown as PublicClient;
}

describe("prepareExactInputFromRoute", () => {
  it("maps a direct route to ExactInputSingleParams", async () => {
    const route: RouteResponse = {
      tokenIn: tokenA,
      tokenOut: tokenB,
      amountIn: "1000000",
      amountOut: "997500",
      effectivePriceX64: "1",
      priceImpactE6: "2500",
      routeType: "direct",
      intermediaryToken: null,
      legs: [
        {
          poolAddress: poolAB,
          pair: "A/B",
          tokenIn: tokenA,
          tokenOut: tokenB,
          amountIn: "1000000",
          amountOut: "997500",
          effectivePriceX64: "1",
          priceImpactE6: "2500",
          priceLimitX64: "0",
        },
      ],
      serverTs: 1718640000,
      candidatesConsidered: 3,
    };

    const publicClient = mockPublicClient({
      [poolAB.toLowerCase()]: { token0: tokenA, token1: tokenB },
    });

    const prepared = await prepareExactInputFromRoute({
      publicClient,
      route,
      recipient,
      deadline: 123n,
      slippagePercent: 0.5,
    });

    assert.equal(prepared.kind, "single");
    assert.equal(prepared.params.pool, getAddress(poolAB));
    assert.equal(prepared.params.tokenIn, tokenA);
    assert.equal(prepared.params.tokenOut, tokenB);
    assert.equal(prepared.params.zeroForOne, true);
    assert.equal(prepared.params.amountIn, 1_000_000n);
    assert.equal(prepared.params.amountOutMinimum, 992_512n);
    assert.equal(prepared.params.priceLimitX64, 0n);

    const calldata = encodeExactInputSingleCalldata(prepared.params);
    assert.ok(calldata.startsWith("0x"));
  });

  it("maps a one-hop route to ExactInputParams", async () => {
    const route: RouteResponse = {
      tokenIn: tokenA,
      tokenOut: tokenC,
      amountIn: "1000000",
      amountOut: "990000",
      effectivePriceX64: "1",
      priceImpactE6: "10000",
      routeType: "oneHop",
      intermediaryToken: tokenB,
      legs: [
        {
          poolAddress: poolAB,
          pair: "A/B",
          tokenIn: tokenA,
          tokenOut: tokenB,
          amountIn: "1000000",
          amountOut: "995000",
          effectivePriceX64: "1",
          priceImpactE6: "5000",
          priceLimitX64: "0",
        },
        {
          poolAddress: poolBC,
          pair: "B/C",
          tokenIn: tokenB,
          tokenOut: tokenC,
          amountIn: "995000",
          amountOut: "990000",
          effectivePriceX64: "1",
          priceImpactE6: "5000",
          priceLimitX64: "0",
        },
      ],
      serverTs: 1718640000,
      candidatesConsidered: 5,
    };

    const publicClient = mockPublicClient({
      [poolAB.toLowerCase()]: { token0: tokenA, token1: tokenB },
      [poolBC.toLowerCase()]: { token0: tokenB, token1: tokenC },
    });

    const prepared = await prepareExactInputFromRoute({
      publicClient,
      route,
      recipient,
      deadline: 456n,
      slippagePercent: 1,
    });

    assert.equal(prepared.kind, "multihop");
    assert.deepEqual(prepared.params.tokens, [tokenA, tokenB, tokenC]);
    assert.deepEqual(prepared.params.pools, [getAddress(poolAB), getAddress(poolBC)]);
    assert.equal(prepared.params.zeroForOneBitMap, 3n);
    assert.equal(prepared.params.amountIn, 1_000_000n);
    assert.equal(prepared.params.amountOutMinimum, 980_100n);

    const calldata = encodeExactInputCalldata(prepared.params);
    assert.ok(calldata.startsWith("0x"));
  });

  it("rejects disconnected legs", async () => {
    const route: RouteResponse = {
      tokenIn: tokenA,
      tokenOut: tokenC,
      amountIn: "1",
      amountOut: "1",
      effectivePriceX64: "1",
      priceImpactE6: "0",
      routeType: "oneHop",
      intermediaryToken: tokenB,
      legs: [
        {
          poolAddress: poolAB,
          pair: "A/B",
          tokenIn: tokenA,
          tokenOut: tokenB,
          amountIn: "1",
          amountOut: "1",
          effectivePriceX64: "1",
          priceImpactE6: "0",
          priceLimitX64: "0",
        },
        {
          poolAddress: poolBC,
          pair: "B/C",
          tokenIn: tokenC,
          tokenOut: tokenC,
          amountIn: "1",
          amountOut: "1",
          effectivePriceX64: "1",
          priceImpactE6: "0",
          priceLimitX64: "0",
        },
      ],
      serverTs: 1,
      candidatesConsidered: 1,
    };

    const publicClient = mockPublicClient({
      [poolAB.toLowerCase()]: { token0: tokenA, token1: tokenB },
      [poolBC.toLowerCase()]: { token0: tokenB, token1: tokenC },
    });

    await assert.rejects(
      () =>
        prepareExactInputFromRoute({
          publicClient,
          route,
          recipient,
          deadline: 1n,
          slippagePercent: 0,
        }),
      /does not connect/,
    );
  });
});
