import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Address, PublicClient } from "viem";
import { zeroAddress } from "viem";
import { quoteSwap } from "../src/router/swap.js";

const pool = "0x2222222222222222222222222222222222222222" as Address;
const swapper = "0x3333333333333333333333333333333333333333" as Address;
const priceProvider = "0x4444444444444444444444444444444444444444" as Address;

describe("resolve bid/ask (pool.getImmutables)", () => {
  it("reads getImmutables then getBidAndAskPriceUi when prices omitted", async () => {
    const calls: { fn: string; address: Address }[] = [];

    const publicClient = {
      readContract: async (req: {
        address: Address;
        functionName: string;
        args?: readonly unknown[];
      }) => {
        calls.push({ fn: req.functionName, address: req.address });

        if (req.functionName === "getImmutables") {
          assert.equal(req.address, pool);
          return { immutablePriceProvider: priceProvider };
        }
        if (req.functionName === "getBidAndAskPriceUi") {
          assert.equal(req.address, priceProvider);
          return [100n, 200n] as const;
        }
        if (req.functionName === "quoteSwap") {
          assert.deepEqual(req.args, [
            pool,
            zeroAddress,
            true,
            10n,
            0n,
            100n,
            200n,
            "0x",
          ]);
          return [1n, -2n] as const;
        }
        throw new Error(`unexpected readContract: ${req.functionName}`);
      },
      simulateContract: async () => {
        throw new Error("simulateContract should not be called");
      },
    } as unknown as PublicClient;

    const result = await quoteSwap({
      publicClient,
      swapperAddress: swapper,
      pool,
      zeroForOne: true,
      amountSpecified: 10n,
    });

    assert.equal(calls[0]?.fn, "getImmutables");
    assert.equal(calls[1]?.fn, "getBidAndAskPriceUi");
    assert.equal(calls[2]?.fn, "quoteSwap");
    assert.equal(result.amountIn, 1n);
    assert.equal(result.amountOut, 2n);
  });
});
