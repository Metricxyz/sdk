import { assertWrappedNativeToken } from "./wrappedNative.js";
import type { Address, Hex } from "viem";
import type { ExactInputParams, ExactOutputParams } from "./swapPath.js";
import type { ExactInputSingleParams, ExactOutputSingleParams } from "./swap.js";
import { encodeExactInputSingleCalldata, encodeExactOutputSingleCalldata } from "./swap.js";
import { encodeExactInputCalldata, encodeExactOutputCalldata } from "./swapPath.js";
import {
  encodeMulticallCalldata,
  encodeRefundETHCalldata,
  encodeUnwrapWETH9Calldata,
} from "../peripheryPayments/index.js";

function withRouterRecipient<T extends { recipient: Address }>(
  params: T,
  simpleRouter: Address,
): T {
  return { ...params, recipient: simpleRouter };
}

/** Single-hop exact input when `tokenIn` is wrappedNative - `tokenIn` MUST be wrappedNative.
 * Set `msg.value` to a value that you want to pay with native ETH on the transaction.
 * The remaining amount will be paid with wrappedNative (if it is approved, otherwise it will revert).
 * Any unused native ETH will be refunded to the caller.
 */
export function prepareExactInputSingleSupportingNativePaymentCalldata(
  params: ExactInputSingleParams,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(params.tokenIn, chainId, wrappedNative, "tokenIn");
  return encodeMulticallCalldata([
    encodeExactInputSingleCalldata(params),
    // Refund is needed because it is possible (vary rare) that the router will not consume whole amountIn while still output the required amountOutMinimum.
    encodeRefundETHCalldata(),
  ]);
}

/** Multihop exact input when the first token is wrappedNative - `tokenIn` MUST be wrappedNative.
 * Set `msg.value` to a value that you want to pay with native ETH on the transaction.
 * The remaining amount will be paid with wrappedNative (if it is approved, otherwise it will revert).
 * Any unused native ETH will be refunded to the caller.
 */
export function prepareExactInputSupportingNativePaymentCalldata(
  params: ExactInputParams,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(params.tokens[0], chainId, wrappedNative, "tokenIn");
  return encodeMulticallCalldata([
    encodeExactInputCalldata(params),
    // Refund is needed because it is possible (vary rare) that the router will not consume whole amountIn while still output the required amountOutMinimum.
    encodeRefundETHCalldata(),
  ]);
}

/** Single-hop exact output when `tokenIn` is wrappedNative - `tokenIn` MUST be wrappedNative.
 * Set `msg.value` to a value that you want to pay with native ETH on the transaction.
 * The remaining amount will be paid with wrappedNative (if it is approved, otherwise it will revert)
 * Any unused native ETH will be refunded to the caller.
 *  */
export function prepareExactOutputSingleSupportingNativePaymentCalldata(
  params: ExactOutputSingleParams,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(params.tokenIn, chainId, wrappedNative, "tokenIn");
  return encodeMulticallCalldata([
    encodeExactOutputSingleCalldata(params),
    encodeRefundETHCalldata(),
  ]);
}

/** Multihop exact output when the first token is wrappedNative - `tokenIn` MUST be wrappedNative.
 * Set `msg.value` to a value that you want to pay with native ETH on the transaction.
 * The remaining amount will be paid with wrappedNative (if it is approved, otherwise it will revert)
 * Any unused native ETH will be refunded to the caller.
 *  */
export function prepareExactOutputSupportingNativePaymentCalldata(
  params: ExactOutputParams,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(params.tokens[0], chainId, wrappedNative, "tokenIn");
  return encodeMulticallCalldata([encodeExactOutputCalldata(params), encodeRefundETHCalldata()]);
}

/**
 * Single-hop exact input with ETH output — `tokenOut` MUST be wrappedNative.
 * Unwraps the whole amount of wrappedNative to native ETH and sends it to the recipient.
 */
export function prepareExactInputSingleAndUnwrapCalldata(
  params: ExactInputSingleParams,
  simpleRouter: Address,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(params.tokenOut, chainId, wrappedNative, "tokenOut");
  return encodeMulticallCalldata([
    encodeExactInputSingleCalldata(withRouterRecipient(params, simpleRouter)),
    encodeUnwrapWETH9Calldata(params.amountOutMinimum, params.recipient),
  ]);
}

/** Multihop exact input with ETH output - `tokenOut` MUST be wrappedNative.
 * Unwraps the whole amount of wrappedNative to native ETH and sends it to the recipient.
 *  */
export function prepareExactInputAndUnwrapCalldata(
  params: ExactInputParams,
  simpleRouter: Address,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(
    params.tokens[params.tokens.length - 1],
    chainId,
    wrappedNative,
    "tokenOut",
  );
  return encodeMulticallCalldata([
    encodeExactInputCalldata(withRouterRecipient(params, simpleRouter)),
    encodeUnwrapWETH9Calldata(params.amountOutMinimum, params.recipient),
  ]);
}

/**
 * Single-hop exact output with ETH output — `tokenOut` MUST be wrappedNative.
 * Unwraps the whole amount of wrappedNative to native ETH and sends it to the recipient.
 */
export function prepareExactOutputSingleAndUnwrapCalldata(
  params: ExactOutputSingleParams,
  simpleRouter: Address,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(params.tokenOut, chainId, wrappedNative, "tokenOut");
  return encodeMulticallCalldata([
    encodeExactOutputSingleCalldata(withRouterRecipient(params, simpleRouter)),
    encodeUnwrapWETH9Calldata(params.amountOut, params.recipient),
  ]);
}

/**
 * Multihop exact output with ETH output — `tokenOut` MUST be wrappedNative.
 * Unwraps the whole amount of wrappedNative to native ETH and sends it to the recipient.
 */
export function prepareExactOutputAndUnwrapCalldata(
  params: ExactOutputParams,
  simpleRouter: Address,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(
    params.tokens[params.tokens.length - 1],
    chainId,
    wrappedNative,
    "tokenOut",
  );
  return encodeMulticallCalldata([
    encodeExactOutputCalldata(withRouterRecipient(params, simpleRouter)),
    encodeUnwrapWETH9Calldata(params.amountOut, params.recipient),
  ]);
}
