import { assertWrappedNativeToken } from "./wrappedNative.js";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { SIMPLE_ROUTER_ABI } from "../constants.js";
import {
  encodeMulticallCalldata,
  encodeRefundETHCalldata,
  encodeUnwrapWETH9Calldata,
} from "../peripheryPayments/index.js";

export type ExternalSwapParams = {
  tokenIn: Address;
  tokenOut: Address;
  amountInMaximum: bigint;
  amountOutMinimum: bigint;
  externalRouter: Address;
  /** Must deliver output to the executor, which is the external router's caller. */
  externalRouterCalldata: Hex;
  recipient: Address;
  deadline: bigint;
};

/** Approve the SimpleRouter, not the executor. The executor must be bound to that router. */
export function encodeExternalSwapCalldata(executor: Address, params: ExternalSwapParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "externalSwap",
    args: [executor, params],
  });
}

export const prepareExternalSwapCalldata = encodeExternalSwapCalldata;

/**
 * tokenIn must be wrappedNative. Set transaction value to the native contribution;
 * approve the router for any remaining wrappedNative needed to fund amountInMaximum.
 * Executor refunds arrive as wrappedNative; only unused router ETH is refunded as ETH.
 */
export function prepareExternalSwapSupportingNativePaymentCalldata(
  executor: Address,
  params: ExternalSwapParams,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(params.tokenIn, chainId, wrappedNative, "tokenIn");
  return encodeMulticallCalldata([
    encodeExternalSwapCalldata(executor, params),
    encodeRefundETHCalldata(),
  ]);
}

/** tokenOut must be wrappedNative. Unwraps the router's entire wrappedNative balance. */
export function prepareExternalSwapAndUnwrapCalldata(
  executor: Address,
  params: ExternalSwapParams,
  simpleRouter: Address,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(params.tokenOut, chainId, wrappedNative, "tokenOut");
  return encodeMulticallCalldata([
    encodeExternalSwapCalldata(executor, { ...params, recipient: simpleRouter }),
    encodeUnwrapWETH9Calldata(params.amountOutMinimum, params.recipient),
  ]);
}
