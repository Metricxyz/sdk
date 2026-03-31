import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as sdk from "../index.js";

describe("Swap args builders", () => {
  it("encodes exact-input calldata from tx params and args", () => {
    const inputParams: sdk.SwapExactInputParams = {
      pool: "0x0000000000000000000000000000000000000001",
      recipient: "0x0000000000000000000000000000000000000002",
      zeroForOne: true,
      amountIn: 2_000_000_000_000_000_000n,
      priceLimitX64: sdk.priceToQ64(0.99),
      minAmountOut: 1_900_000n,
      deadline: 123n,
    };

    const args: sdk.SwapExactInputArgs = [
      inputParams.pool,
      inputParams.recipient,
      inputParams.zeroForOne,
      inputParams.amountIn,
      inputParams.priceLimitX64,
      inputParams.minAmountOut,
      inputParams.deadline,
    ];

    const calldataFromParams = sdk.prepareSwapExactInputCalldata(inputParams);
    const calldataFromArgs = sdk.prepareSwapExactInputCalldata(args);
    assert.equal(calldataFromParams.data, calldataFromArgs.data);
  });

  it("encodes exact-output calldata from tx params and args", () => {
    const outputParams: sdk.SwapExactOutputParams = {
      pool: "0x0000000000000000000000000000000000000001",
      recipient: "0x0000000000000000000000000000000000000002",
      zeroForOne: false,
      amountOut: 1_000_000n,
      priceLimitX64: sdk.priceToQ64(1.01),
      maxAmountIn: 2_100_000_000_000_000_000n,
      deadline: 123n,
    };

    const args: sdk.SwapExactOutputArgs = [
      outputParams.pool,
      outputParams.recipient,
      outputParams.zeroForOne,
      outputParams.amountOut,
      outputParams.priceLimitX64,
      outputParams.maxAmountIn,
      outputParams.deadline,
    ];

    const calldataFromParams = sdk.prepareSwapExactOutputCalldata(outputParams);
    const calldataFromArgs = sdk.prepareSwapExactOutputCalldata(args);
    assert.equal(calldataFromParams.data, calldataFromArgs.data);
  });

  it("encodes native exact-input calldata from params", () => {
    const nativeParams: sdk.SwapExactInputParams = {
      pool: "0x0000000000000000000000000000000000000001",
      recipient: "0x0000000000000000000000000000000000000002",
      zeroForOne: true,
      amountIn: 1_000_000_000_000_000_000n,
      priceLimitX64: sdk.priceToQ64(0.99),
      minAmountOut: 1_000_000n,
      deadline: 123n,
    };

    const prepared = sdk.prepareSwapExactInputNativeForTokensCalldata(nativeParams);
    assert.ok(prepared.data.startsWith("0x"));
    assert.equal(prepared.value, nativeParams.amountIn);
  });
});
