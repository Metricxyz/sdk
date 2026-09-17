import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, type Address, type Hex, zeroAddress } from "viem";
import * as sdk from "../src/index.js";

const wrappedNative: Address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const ethereumWrappedNative: Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const otherToken: Address = "0x0000000000000000000000000000000000000001";
const router: Address = "0x0000000000000000000000000000000000000002";
const common = { recipient: router, deadline: 123n };
const single = { ...common, pool: router, zeroForOne: true, priceLimitX64: 0n };
const path = {
  ...common,
  pools: [router, router],
  extensionDatas: ["0x", "0x"] as Hex[],
  zeroForOneBitMap: 3n,
};
const input = { amountIn: 100n, amountOutMinimum: 80n };
const output = { amountInMaximum: 100n, amountOut: 80n };
const fallback = {
  executor: router,
  externalRouter: otherToken,
  externalRouterCalldata: "0x1234" as Hex,
};

const cases: {
  name: string;
  tokenName: "tokenIn" | "tokenOut";
  build: (token: Address, chainId: number | null, expected: Address | null) => Hex;
}[] = [
  {
    name: "prepareExactInputSupportingNativePaymentCalldata",
    tokenName: "tokenIn",
    build: (token, chainId, expected) =>
      sdk.prepareExactInputSupportingNativePaymentCalldata(
        { ...path, tokens: [token, wrappedNative, otherToken], ...input },
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactInputSupportingNativePaymentWithExternalSwapFallbackCalldata",
    tokenName: "tokenIn",
    build: (token, chainId, expected) =>
      sdk.prepareExactInputSupportingNativePaymentWithExternalSwapFallbackCalldata(
        { ...path, tokens: [token, wrappedNative, otherToken], ...input },
        fallback,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactInputAndUnwrapCalldata",
    tokenName: "tokenOut",
    build: (token, chainId, expected) =>
      sdk.prepareExactInputAndUnwrapCalldata(
        { ...path, tokens: [otherToken, wrappedNative, token], ...input },
        router,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactInputAndUnwrapWithExternalSwapFallbackCalldata",
    tokenName: "tokenOut",
    build: (token, chainId, expected) =>
      sdk.prepareExactInputAndUnwrapWithExternalSwapFallbackCalldata(
        { ...path, tokens: [otherToken, wrappedNative, token], ...input },
        fallback,
        router,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactInputSingleSupportingNativePaymentCalldata",
    tokenName: "tokenIn",
    build: (token, chainId, expected) =>
      sdk.prepareExactInputSingleSupportingNativePaymentCalldata(
        { ...single, tokenIn: token, tokenOut: otherToken, ...input },
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactInputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata",
    tokenName: "tokenIn",
    build: (token, chainId, expected) =>
      sdk.prepareExactInputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata(
        { ...single, tokenIn: token, tokenOut: otherToken, ...input },
        fallback,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactInputSingleAndUnwrapCalldata",
    tokenName: "tokenOut",
    build: (token, chainId, expected) =>
      sdk.prepareExactInputSingleAndUnwrapCalldata(
        { ...single, tokenIn: otherToken, tokenOut: token, ...input },
        router,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactInputSingleAndUnwrapWithExternalSwapFallbackCalldata",
    tokenName: "tokenOut",
    build: (token, chainId, expected) =>
      sdk.prepareExactInputSingleAndUnwrapWithExternalSwapFallbackCalldata(
        { ...single, tokenIn: otherToken, tokenOut: token, ...input },
        fallback,
        router,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactOutputSupportingNativePaymentCalldata",
    tokenName: "tokenIn",
    build: (token, chainId, expected) =>
      sdk.prepareExactOutputSupportingNativePaymentCalldata(
        { ...path, tokens: [token, wrappedNative, otherToken], ...output },
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactOutputSupportingNativePaymentWithExternalSwapFallbackCalldata",
    tokenName: "tokenIn",
    build: (token, chainId, expected) =>
      sdk.prepareExactOutputSupportingNativePaymentWithExternalSwapFallbackCalldata(
        { ...path, tokens: [token, wrappedNative, otherToken], ...output },
        fallback,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactOutputAndUnwrapCalldata",
    tokenName: "tokenOut",
    build: (token, chainId, expected) =>
      sdk.prepareExactOutputAndUnwrapCalldata(
        { ...path, tokens: [otherToken, wrappedNative, token], ...output },
        router,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactOutputAndUnwrapWithExternalSwapFallbackCalldata",
    tokenName: "tokenOut",
    build: (token, chainId, expected) =>
      sdk.prepareExactOutputAndUnwrapWithExternalSwapFallbackCalldata(
        { ...path, tokens: [otherToken, wrappedNative, token], ...output },
        fallback,
        router,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactOutputSingleSupportingNativePaymentCalldata",
    tokenName: "tokenIn",
    build: (token, chainId, expected) =>
      sdk.prepareExactOutputSingleSupportingNativePaymentCalldata(
        { ...single, tokenIn: token, tokenOut: otherToken, ...output },
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactOutputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata",
    tokenName: "tokenIn",
    build: (token, chainId, expected) =>
      sdk.prepareExactOutputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata(
        { ...single, tokenIn: token, tokenOut: otherToken, ...output },
        fallback,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactOutputSingleAndUnwrapCalldata",
    tokenName: "tokenOut",
    build: (token, chainId, expected) =>
      sdk.prepareExactOutputSingleAndUnwrapCalldata(
        { ...single, tokenIn: otherToken, tokenOut: token, ...output },
        router,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExactOutputSingleAndUnwrapWithExternalSwapFallbackCalldata",
    tokenName: "tokenOut",
    build: (token, chainId, expected) =>
      sdk.prepareExactOutputSingleAndUnwrapWithExternalSwapFallbackCalldata(
        { ...single, tokenIn: otherToken, tokenOut: token, ...output },
        fallback,
        router,
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExternalSwapSupportingNativePaymentCalldata",
    tokenName: "tokenIn",
    build: (token, chainId, expected) =>
      sdk.prepareExternalSwapSupportingNativePaymentCalldata(
        router,
        {
          ...common,
          ...fallback,
          tokenIn: token,
          tokenOut: otherToken,
          amountInMaximum: 100n,
          amountOutMinimum: 80n,
        },
        chainId,
        expected,
      ),
  },
  {
    name: "prepareExternalSwapAndUnwrapCalldata",
    tokenName: "tokenOut",
    build: (token, chainId, expected) =>
      sdk.prepareExternalSwapAndUnwrapCalldata(
        router,
        {
          ...common,
          ...fallback,
          tokenIn: otherToken,
          tokenOut: token,
          amountInMaximum: 100n,
          amountOutMinimum: 80n,
        },
        router,
        chainId,
        expected,
      ),
  },
];

describe("native swap token validation", () => {
  for (const { name, tokenName, build } of cases) {
    it(`${name} resolves wrapped native from chainId`, () => {
      assert.equal(
        build(ethereumWrappedNative, 1, null),
        build(ethereumWrappedNative, null, ethereumWrappedNative),
      );
      assert.throws(
        () => build(otherToken, 1, null),
        new RegExp(`${tokenName} must be wrappedNative`),
      );
    });

    it(`${name} requires chainId and wrappedNative to agree`, () => {
      assert.equal(
        build(ethereumWrappedNative, 1, ethereumWrappedNative.toLowerCase() as Address),
        build(ethereumWrappedNative, 1, null),
      );
      assert.throws(
        () => build(wrappedNative, 1, wrappedNative),
        /wrappedNative does not match chainId 1/,
      );
      assert.throws(
        () => build(otherToken, 1, ethereumWrappedNative),
        new RegExp(`${tokenName} must be wrappedNative`),
      );
    });

    it(`${name} skips token validation only when both arguments are null`, () => {
      assert.ok(build(otherToken, null, null).startsWith("0x"));
      assert.ok(build(zeroAddress, null, null).startsWith("0x"));
    });

    it(`${name} rejects unknown chains even with an explicit address`, () => {
      assert.throws(() => build(wrappedNative, 999999, null), /Chain 999999 has no v1 deployment/);
      assert.throws(
        () => build(wrappedNative, 999999, wrappedNative),
        /Chain 999999 has no v1 deployment/,
      );
    });

    it(`${name} rejects malformed ${tokenName} with the validation message`, () => {
      for (const token of ["0x0", "0xgggggggggggggggggggggggggggggggggggggggg"] as Address[]) {
        for (const [chainId, expected] of [
          [1, null],
          [null, wrappedNative],
        ] as const) {
          assert.throws(() => build(token, chainId, expected), {
            message: `${tokenName} must be wrappedNative`,
          });
        }
      }
    });

    it(`${name} validates ${tokenName}`, () => {
      assert.ok(build(wrappedNative, null, wrappedNative).startsWith("0x"));
      assert.throws(
        () => build(otherToken, null, wrappedNative),
        new RegExp(`${tokenName} must be wrappedNative`),
      );
      assert.throws(
        () => build(zeroAddress, null, wrappedNative),
        new RegExp(`${tokenName} must be wrappedNative`),
      );
      assert.throws(
        () => build(wrappedNative, null, zeroAddress),
        /wrappedNative must be a non-zero token address/,
      );
      assert.throws(
        () => build(wrappedNative, null, undefined as unknown as Address),
        /wrappedNative must be a non-zero token address/,
      );
      const checksummed = getAddress(wrappedNative);
      assert.equal(
        build(checksummed, null, wrappedNative),
        build(wrappedNative, null, checksummed),
      );
    });
  }

  it("rejects missing path endpoints before encoding", () => {
    assert.throws(
      () =>
        sdk.prepareExactInputAndUnwrapCalldata(
          { ...path, ...input, tokens: [] },
          router,
          null,
          wrappedNative,
        ),
      /tokenOut must be wrappedNative/,
    );
    assert.throws(
      () =>
        sdk.prepareExactOutputSupportingNativePaymentCalldata(
          { ...path, ...output, tokens: [] },
          null,
          wrappedNative,
        ),
      /tokenIn must be wrappedNative/,
    );
  });
});
