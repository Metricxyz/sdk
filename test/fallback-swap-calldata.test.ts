import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeFunctionData, type Address, type Hex } from "viem";
import * as sdk from "../src/index.js";

const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const common = { recipient: address(4), deadline: 123n };
const single = {
  pool: address(1),
  tokenIn: address(2),
  tokenOut: address(3),
  zeroForOne: true,
  priceLimitX64: 0n,
};
const path = {
  tokens: [address(2), address(5), address(3)],
  pools: [address(1), address(6)],
  extensionDatas: ["0x", "0x"] as Hex[],
  zeroForOneBitMap: 3n,
};
const input = { amountIn: 100n, amountOutMinimum: 80n };
const output = { amountOut: 80n, amountInMaximum: 100n };
const fallback = {
  executor: address(7),
  externalRouter: address(8),
  externalRouterCalldata: "0x1234" as Hex,
};
const router = address(9);
function decode(data: Hex) {
  return decodeFunctionData({ abi: sdk.MetricOmmSimpleRouterAbi, data });
}
function multicall(data: Hex) {
  const decoded = decode(data);
  assert.equal(decoded.functionName, "multicall");
  if (decoded.functionName !== "multicall") throw new Error("Expected multicall");
  return decoded.args[0];
}

const cases = [
  {
    name: "prepareExactInputWithExternalSwapFallbackCalldata",
    primaryFunction: "exactInput",
    suffix: "",
    build: (extraParams: object = {}) =>
      sdk.prepareExactInputWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...path, ...input },
        fallback,
      ),
  },
  {
    name: "prepareExactInputSupportingNativePaymentWithExternalSwapFallbackCalldata",
    primaryFunction: "exactInput",
    suffix: "SupportingNativePayment",
    build: (extraParams: object = {}) =>
      sdk.prepareExactInputSupportingNativePaymentWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...path, ...input },
        fallback,
        null,
        address(2),
      ),
  },
  {
    name: "prepareExactInputAndUnwrapWithExternalSwapFallbackCalldata",
    primaryFunction: "exactInput",
    suffix: "AndUnwrap",
    build: (extraParams: object = {}) =>
      sdk.prepareExactInputAndUnwrapWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...path, ...input },
        fallback,
        router,
        null,
        address(3),
      ),
  },
  {
    name: "prepareExactInputSingleWithExternalSwapFallbackCalldata",
    primaryFunction: "exactInputSingle",
    suffix: "",
    build: (extraParams: object = {}) =>
      sdk.prepareExactInputSingleWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...single, ...input },
        fallback,
      ),
  },
  {
    name: "prepareExactInputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata",
    primaryFunction: "exactInputSingle",
    suffix: "SupportingNativePayment",
    build: (extraParams: object = {}) =>
      sdk.prepareExactInputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...single, ...input },
        fallback,
        null,
        address(2),
      ),
  },
  {
    name: "prepareExactInputSingleAndUnwrapWithExternalSwapFallbackCalldata",
    primaryFunction: "exactInputSingle",
    suffix: "AndUnwrap",
    build: (extraParams: object = {}) =>
      sdk.prepareExactInputSingleAndUnwrapWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...single, ...input },
        fallback,
        router,
        null,
        address(3),
      ),
  },
  {
    name: "prepareExactOutputWithExternalSwapFallbackCalldata",
    primaryFunction: "exactOutput",
    suffix: "",
    build: (extraParams: object = {}) =>
      sdk.prepareExactOutputWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...path, ...output },
        fallback,
      ),
  },
  {
    name: "prepareExactOutputSupportingNativePaymentWithExternalSwapFallbackCalldata",
    primaryFunction: "exactOutput",
    suffix: "SupportingNativePayment",
    build: (extraParams: object = {}) =>
      sdk.prepareExactOutputSupportingNativePaymentWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...path, ...output },
        fallback,
        null,
        address(2),
      ),
  },
  {
    name: "prepareExactOutputAndUnwrapWithExternalSwapFallbackCalldata",
    primaryFunction: "exactOutput",
    suffix: "AndUnwrap",
    build: (extraParams: object = {}) =>
      sdk.prepareExactOutputAndUnwrapWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...path, ...output },
        fallback,
        router,
        null,
        address(3),
      ),
  },
  {
    name: "prepareExactOutputSingleWithExternalSwapFallbackCalldata",
    primaryFunction: "exactOutputSingle",
    suffix: "",
    build: (extraParams: object = {}) =>
      sdk.prepareExactOutputSingleWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...single, ...output },
        fallback,
      ),
  },
  {
    name: "prepareExactOutputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata",
    primaryFunction: "exactOutputSingle",
    suffix: "SupportingNativePayment",
    build: (extraParams: object = {}) =>
      sdk.prepareExactOutputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...single, ...output },
        fallback,
        null,
        address(2),
      ),
  },
  {
    name: "prepareExactOutputSingleAndUnwrapWithExternalSwapFallbackCalldata",
    primaryFunction: "exactOutputSingle",
    suffix: "AndUnwrap",
    build: (extraParams: object = {}) =>
      sdk.prepareExactOutputSingleAndUnwrapWithExternalSwapFallbackCalldata(
        { ...extraParams, ...common, ...single, ...output },
        fallback,
        router,
        null,
        address(3),
      ),
  },
];

describe("external swap fallback calldata", () => {
  for (const field of ["amountIn", "amountOutMinimum", "tokenIn", "tokenOut"]) {
    it(`rejects incomplete exact-input single params missing ${field}`, () => {
      const params = { ...common, ...single, ...input };
      Reflect.deleteProperty(params, field);
      assert.throws(
        () => sdk.prepareExactInputSingleWithExternalSwapFallbackCalldata(params, fallback),
        /Swap params must contain/,
      );
    });
  }
  for (const field of ["amountOut", "amountInMaximum", "tokens"]) {
    it(`rejects incomplete exact-output path params missing ${field}`, () => {
      const params = { ...common, ...path, ...output };
      Reflect.deleteProperty(params, field);
      assert.throws(
        () => sdk.prepareExactOutputWithExternalSwapFallbackCalldata(params, fallback),
        /Swap params must contain/,
      );
    });
  }
  for (const { name, primaryFunction, suffix, build } of cases) {
    for (const extraParams of [
      { amountIn: 150n, amountInMaximum: 200n, amountOut: 120n, amountOutMinimum: 60n },
      ...(primaryFunction.startsWith("exactInput")
        ? [{ amountOut: 80n }, { amountInMaximum: undefined }]
        : [{ amountIn: 100n }, { amountOutMinimum: undefined }]),
    ]) {
      it(`${name}: rejects mixed amount fields ${Object.keys(extraParams).join(", ")}`, () => {
        assert.throws(
          () => build(extraParams),
          /exactly one complete exact-input or exact-output amount pair/,
        );
      });
    }
    for (const extraParams of primaryFunction.endsWith("Single")
      ? [{ tokens: [address(12), address(13)] }, { tokens: undefined }]
      : [{ tokenIn: address(10) }, { tokenOut: undefined }]) {
      it(`${name}: rejects mixed token fields ${Object.keys(extraParams).join(", ")}`, () => {
        assert.throws(() => build(extraParams), /either tokens or both tokenIn and tokenOut/);
      });
    }
    for (const { label, extraParams } of [
      { label: "declared fields", extraParams: {} },
      { label: "unrelated quote metadata", extraParams: { quoteId: "quote-1" } },
    ]) {
      it(`${name}: ${label}`, () => {
        const decoded = decode(build(extraParams));
        if (decoded.functionName !== "sequence") assert.fail("Expected sequence");
        const [primary, secondary] = decoded.args[0];
        assert.equal(decoded.args[0].length, 2);
        assert.equal(primary.onSuccess, 1);
        assert.equal(primary.onFailure, 0);
        assert.equal(secondary.onSuccess, 1);
        assert.equal(secondary.onFailure, 2);
        const primaryCalls = multicall(primary.data);
        const fallbackCalls = multicall(secondary.data);
        assert.equal(primaryCalls.length, suffix ? 2 : 1);
        assert.equal(fallbackCalls.length, suffix ? 2 : 1);
        const swap = decode(primaryCalls[0]);
        assert.equal(swap.functionName, primaryFunction);
        const external = decode(fallbackCalls[0]);
        if (external.functionName !== "externalSwap") assert.fail("Expected external swap");
        assert.deepEqual(external.args, [
          fallback.executor,
          false,
          suffix === "SupportingNativePayment",
          {
            tokenIn: address(2),
            tokenOut: address(3),
            amountInMaximum: 100n,
            amountOutMinimum: 80n,
            recipient: suffix === "AndUnwrap" ? router : common.recipient,
            deadline: 123n,
            externalRouter: fallback.externalRouter,
            externalRouterCalldata: "0x1234",
          },
        ]);
        if (suffix) {
          for (const calls of [primaryCalls, fallbackCalls]) {
            assert.deepEqual(
              decode(calls[1]),
              suffix === "AndUnwrap"
                ? { functionName: "unwrapWETH9", args: [80n, common.recipient] }
                : { functionName: "refundETH", args: undefined },
            );
          }
        }
      });
    }
  }
});
