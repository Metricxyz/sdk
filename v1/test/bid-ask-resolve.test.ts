import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Address, PublicClient } from "viem";
import { zeroAddress } from "viem";
import { quoteSwap } from "../src/router/swap.js";

const pool = "0x2222222222222222222222222222222222222222" as Address;
const swapper = "0x3333333333333333333333333333333333333333" as Address;
const MAX_UINT128 = (1n << 128n) - 1n;

describe("resolve bid/ask (pool.getBidAndAskPrice)", () => {
  it("simulates pool.getBidAndAskPrice when prices omitted", async () => {
    const calls: { fn: string; address: Address }[] = [];

    const publicClient = {
      simulateContract: async (req: { address: Address; functionName: string }) => {
        calls.push({ fn: req.functionName, address: req.address });
        if (req.functionName === "getBidAndAskPrice") {
          assert.equal(req.address, pool);
          return { result: [100n, 200n] as const };
        }
        throw new Error(`unexpected simulateContract: ${req.functionName}`);
      },
      readContract: async (req: {
        address: Address;
        functionName: string;
        args?: readonly unknown[];
      }) => {
        calls.push({ fn: req.functionName, address: req.address });
        if (req.functionName === "quoteSwap") {
          assert.deepEqual(req.args, [pool, zeroAddress, true, 10n, 0n, 100n, 200n, "0x"]);
          return [1n, -2n] as const;
        }
        throw new Error(`unexpected readContract: ${req.functionName}`);
      },
    } as unknown as PublicClient;

    const result = await quoteSwap({
      publicClient,
      swapperAddress: swapper,
      pool,
      zeroForOne: true,
      amountSpecified: 10n,
    });

    assert.equal(calls[0]?.fn, "getBidAndAskPrice");
    assert.equal(calls[1]?.fn, "quoteSwap");
    assert.equal(result.amountIn, 1n);
    assert.equal(result.amountOut, 2n);
  });

  it("falls back to (0, uint128.max) sentinel when getBidAndAskPrice fails", async () => {
    const publicClient = {
      simulateContract: async () => {
        throw new Error("price provider halted");
      },
      readContract: async (req: {
        address: Address;
        functionName: string;
        args?: readonly unknown[];
      }) => {
        if (req.functionName === "quoteSwap") {
          // bid/ask resolve to the fail-closed sentinel (0, uint128.max).
          assert.deepEqual(req.args, [pool, zeroAddress, true, 10n, 0n, 0n, MAX_UINT128, "0x"]);
          return [1n, -2n] as const;
        }
        throw new Error(`unexpected readContract: ${req.functionName}`);
      },
    } as unknown as PublicClient;

    const result = await quoteSwap({
      publicClient,
      swapperAddress: swapper,
      pool,
      zeroForOne: true,
      amountSpecified: 10n,
    });
    assert.equal(result.amountIn, 1n);
    assert.equal(result.amountOut, 2n);
  });
});
