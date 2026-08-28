import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PublicClient } from "viem";
import { buildExactInputSingleParams } from "../src/router/swap.js";

const stubClient = {} as PublicClient;

const base = {
  publicClient: stubClient,
  quoterAddress: "0x4444444444444444444444444444444444444444" as const,
  pool: "0x2222222222222222222222222222222222222222" as const,
  tokenIn: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
  tokenOut: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const,
  recipient: "0xcccccccccccccccccccccccccccccccccccccccc" as const,
  amountIn: 1n,
  deadline: 1n,
};

describe("slippagePercent bounds (v1)", () => {
  it("rejects slippage above 100%", async () => {
    await assert.rejects(
      () =>
        buildExactInputSingleParams({
          ...base,
          slippagePercent: 100.01,
        }),
      /between 0 and 100/,
    );
  });

  it("rejects negative slippage", async () => {
    await assert.rejects(
      () =>
        buildExactInputSingleParams({
          ...base,
          slippagePercent: -1,
        }),
      /between 0 and 100/,
    );
  });
});
