import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Address, PublicClient } from "viem";
import { quoteSwap } from "../src/router/swap.js";

const factory = "0x1111111111111111111111111111111111111111" as Address;
const pool = "0x2222222222222222222222222222222222222222" as Address;
const swapper = "0x3333333333333333333333333333333333333333" as Address;
const priceProvider = "0x4444444444444444444444444444444444444444" as Address;

describe("resolve bid/ask (v1 factory.poolImmutables)", () => {
  it("reads poolImmutables then getBidAndAskPriceUi when prices omitted", async () => {
    const calls: { fn: string; address: Address }[] = [];

    const publicClient = {
      readContract: async (req: {
        address: Address;
        functionName: string;
        args?: readonly unknown[];
      }) => {
        calls.push({ fn: req.functionName, address: req.address });

        if (req.functionName === "poolImmutables") {
          assert.equal(req.address, factory);
          assert.deepEqual(req.args, [pool]);
          return { immutablePriceProvider: priceProvider };
        }
        if (req.functionName === "getBidAndAskPriceUi") {
          assert.equal(req.address, priceProvider);
          return [100n, 200n] as const;
        }
        if (req.functionName === "quoteSwap") {
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
      factoryAddress: factory,
      swapperAddress: swapper,
      pool,
      zeroForOne: true,
      amountSpecified: 10n,
    });

    assert.equal(calls[0]?.fn, "poolImmutables");
    assert.equal(calls[1]?.fn, "getBidAndAskPriceUi");
    assert.equal(calls[2]?.fn, "quoteSwap");
    assert.equal(result.amountIn, 1n);
    assert.equal(result.amountOut, 2n);
  });

  it("requires factoryAddress when prices are omitted", async () => {
    await assert.rejects(
      () =>
        quoteSwap({
          publicClient: { readContract: async () => 0n } as unknown as PublicClient,
          swapperAddress: swapper,
          pool,
          zeroForOne: true,
          amountSpecified: 1n,
        }),
      /factoryAddress is required/,
    );
  });
});
