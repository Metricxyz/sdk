import type { ExternalSwapParams } from "./types.js";
import { assertWrappedNativeToken } from "./wrappedNative.js";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { SIMPLE_ROUTER_ABI } from "../constants.js";
import {
  encodeMulticallCalldata,
  encodeRefundETHCalldata,
  encodeUnwrapWETH9Calldata,
} from "../peripheryPayments/index.js";

/**
 * Caller-funded by default; unused input is refunded automatically.
 * Router-funded calls retain leftovers: fund and clean up atomically in a multicall.
 * refundAsNative requires wrapped-native input. Approve the SimpleRouter.
 */
export function encodeExternalSwapCalldata(
  executor: Address,
  params: ExternalSwapParams,
  payerIsRouter = false,
  refundAsNative = false,
): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "externalSwap",
    args: [executor, payerIsRouter, refundAsNative, params],
  });
}

export const prepareExternalSwapCalldata = encodeExternalSwapCalldata;

/**
 * tokenIn must be wrappedNative. Set transaction value to the native contribution;
 * approve the router for any remaining wrappedNative needed to fund amountInMaximum.
 * Unused input is refunded as ETH; refundETH returns any ETH never wrapped.
 */
export function prepareExternalSwapSupportingNativePaymentCalldata(
  executor: Address,
  params: ExternalSwapParams,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  assertWrappedNativeToken(params.tokenIn, chainId, wrappedNative, "tokenIn");
  return encodeMulticallCalldata([
    encodeExternalSwapCalldata(executor, params, false, true),
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

export type { ExternalSwapParams } from "./types.js";
