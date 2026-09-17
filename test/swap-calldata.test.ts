import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as sdk from "../src/index.js";

describe("SimpleRouter calldata builders (v1)", () => {
  it("encodes exactInputSingle calldata", () => {
    const params: sdk.ExactInputSingleParams = {
      pool: "0x0000000000000000000000000000000000000001",
      tokenIn: "0x0000000000000000000000000000000000000002",
      tokenOut: "0x0000000000000000000000000000000000000003",
      zeroForOne: true,
      amountIn: 2_000_000_000_000_000_000n,
      amountOutMinimum: 1_900_000n,
      recipient: "0x0000000000000000000000000000000000000004",
      deadline: 123n,
      priceLimitX64: sdk.priceToQ64(0.99),
    };

    const calldata = sdk.prepareExactInputSingleCalldata(params);
    assert.ok(calldata.startsWith("0x"));
  });

  it("encodes exactOutputSingle calldata", () => {
    const params: sdk.ExactOutputSingleParams = {
      pool: "0x0000000000000000000000000000000000000001",
      tokenIn: "0x0000000000000000000000000000000000000002",
      tokenOut: "0x0000000000000000000000000000000000000003",
      zeroForOne: false,
      amountOut: 1_000_000n,
      amountInMaximum: 2_100_000_000_000_000_000n,
      recipient: "0x0000000000000000000000000000000000000004",
      deadline: 123n,
      priceLimitX64: sdk.priceToQ64(1.01),
    };

    const calldata = sdk.prepareExactOutputSingleCalldata(params);
    assert.ok(calldata.startsWith("0x"));
  });

  it("encodes exactInput calldata", () => {
    const params: sdk.ExactInputParams = {
      tokens: [
        "0x0000000000000000000000000000000000000002",
        "0x0000000000000000000000000000000000000003",
        "0x0000000000000000000000000000000000000004",
      ],
      pools: [
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000005",
      ],
      extensionDatas: ["0x", "0x"],
      zeroForOneBitMap: sdk.encodeZeroForOneBitMap([true, false]),
      amountIn: 2_000_000_000_000_000_000n,
      amountOutMinimum: 1_900_000n,
      recipient: "0xcccccccccccccccccccccccccccccccccccccccc",
      deadline: 123n,
    };

    const calldata = sdk.prepareExactInputCalldata(params);
    assert.ok(calldata.startsWith("0x"));
  });

  it("encodes exactOutput calldata", () => {
    const params: sdk.ExactOutputParams = {
      tokens: [
        "0x0000000000000000000000000000000000000002",
        "0x0000000000000000000000000000000000000003",
        "0x0000000000000000000000000000000000000004",
      ],
      pools: [
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000005",
      ],
      extensionDatas: ["0x", "0x"],
      zeroForOneBitMap: sdk.encodeZeroForOneBitMap([true, false]),
      amountOut: 1_000_000n,
      amountInMaximum: 2_100_000_000_000_000_000n,
      recipient: "0xcccccccccccccccccccccccccccccccccccccccc",
      deadline: 123n,
    };

    const calldata = sdk.prepareExactOutputCalldata(params);
    assert.ok(calldata.startsWith("0x"));
  });

  it("encodes native exact-input single supporting native payment", () => {
    const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const params: sdk.ExactInputSingleParams = {
      pool: "0x0000000000000000000000000000000000000001",
      tokenIn: weth,
      tokenOut: "0x0000000000000000000000000000000000000003",
      zeroForOne: true,
      amountIn: 1_000_000_000_000_000_000n,
      amountOutMinimum: 1_900_000n,
      recipient: "0x0000000000000000000000000000000000000004",
      deadline: 123n,
      priceLimitX64: sdk.priceToQ64(0.99),
    };

    const data = sdk.prepareExactInputSingleSupportingNativePaymentCalldata(params, null, weth);
    assert.ok(data.startsWith("0x"));
    assert.notEqual(data, sdk.encodeExactInputSingleCalldata(params));
  });

  it("encodes token-to-native exact-input single and unwrap", () => {
    const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const router = "0x00000000000000000000000000000000000000aa";
    const params: sdk.ExactInputSingleParams = {
      pool: "0x0000000000000000000000000000000000000001",
      tokenIn: "0x0000000000000000000000000000000000000003",
      tokenOut: weth,
      zeroForOne: false,
      amountIn: 3_000n,
      amountOutMinimum: 0n,
      recipient: "0x0000000000000000000000000000000000000004",
      deadline: 123n,
      priceLimitX64: sdk.MAX_UINT128,
    };

    const data = sdk.prepareExactInputSingleAndUnwrapCalldata(params, router, null, weth);
    assert.ok(data.startsWith("0x"));
  });

  it("encodes multihop token-to-native exact-input and unwrap", () => {
    const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const router = "0x00000000000000000000000000000000000000aa";
    const params: sdk.ExactInputParams = {
      tokens: [
        "0x0000000000000000000000000000000000000004",
        "0x0000000000000000000000000000000000000003",
        weth,
      ],
      pools: [
        "0x0000000000000000000000000000000000000005",
        "0x0000000000000000000000000000000000000001",
      ],
      extensionDatas: ["0x", "0x"],
      zeroForOneBitMap: sdk.encodeZeroForOneBitMap([false, true]),
      amountIn: 4_000n,
      amountOutMinimum: 0n,
      recipient: "0xcccccccccccccccccccccccccccccccccccccccc",
      deadline: 123n,
    };

    const data = sdk.prepareExactInputAndUnwrapCalldata(params, router, null, weth);
    assert.ok(data.startsWith("0x"));
  });
});
