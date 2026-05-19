import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PublicClient } from "viem";
import { buildArgsForSwapExactInput } from "../src/router/swap.js";

const stubClient = {} as PublicClient;

const base = {
  publicClient: stubClient,
  swapperAddress: "0x3333333333333333333333333333333333333333" as const,
  pool: "0x2222222222222222222222222222222222222222" as const,
  recipient: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
  zeroForOne: true,
  amountIn: 1n,
  deadline: 1n,
  prices: { bidPriceX64: 1n, askPriceX64: 1n },
};

describe("slippagePercent bounds (v1)", () => {
  it("rejects slippage above 100%", async () => {
    await assert.rejects(
      () =>
        buildArgsForSwapExactInput({
          ...base,
          slippagePercent: 100.01,
        }),
      /between 0 and 100/,
    );
  });

  it("rejects negative slippage", async () => {
    await assert.rejects(
      () =>
        buildArgsForSwapExactInput({
          ...base,
          slippagePercent: -1,
        }),
      /between 0 and 100/,
    );
  });
});
