/** Multicall wrappers for SimpleRouter native ETH payment (PeripheryPayments). */

import type { Address, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { SIMPLE_ROUTER_ABI } from "../constants.js";
import type { ExactInputParams, ExactOutputParams } from "./swapPath.js";
import type { ExactInputSingleParams, ExactOutputSingleParams } from "./swap.js";
import {
  encodeExactInputSingleCalldata,
  encodeExactOutputSingleCalldata,
} from "./swap.js";
import { encodeExactInputCalldata, encodeExactOutputCalldata } from "./swapPath.js";



/** `data` = router multicall calldata; `value` = native ETH for `prepare*FromNative*`. */
export interface PreparedSwapTransaction {
  data: Hex;
  value?: bigint;
}

export interface NativeEthInputOptions {
  /** Native ETH for the tx. Default `amountIn`. Lower value = mixed with approved WETH. */
  msgValue?: bigint;
}

export interface NativeEthOutputInputOptions {
  /** Native ETH for the tx. Default `amountInMaximum`. Lower value = mixed with approved WETH. */
  msgValue?: bigint;
}

/** `multicall(bytes[])`. */
export function encodeMulticallCalldata(calls: readonly Hex[]): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "multicall",
    args: [calls],
  });
}

/** `refundETH()` — unused native balance on the router back to caller. */
export function encodeRefundETHCalldata(): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "refundETH",
  });
}

/** `unwrapWETH9(amountMinimum, recipient)`. */
export function encodeUnwrapWETH9Calldata(amountMinimum: bigint, recipient: Address): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "unwrapWETH9",
    args: [amountMinimum, recipient],
  });
}

function withRouterRecipient<T extends { recipient: Address }>(
  params: T,
  simpleRouter: Address,
): T {
  return { ...params, recipient: simpleRouter };
}

/**
 * Pay with native ETH — single-hop exact input.
 * `tokenIn` must be wrappedNative. Encodes `multicall{value}([exactInputSingle, refundETH])`.
 * Native-only: omit `msgValue`. Mixed: pass `msgValue` = amount of native ETH, approve router for at least `amountIn - msgValue` WETH.
 */
export function prepareExactInputSingleFromNativeCalldata(
  params: ExactInputSingleParams,
  options: NativeEthInputOptions = {},
): PreparedSwapTransaction {
  const msgValue = options.msgValue ?? params.amountIn;
  return {
    data: encodeMulticallCalldata([
      encodeExactInputSingleCalldata(params),
      encodeRefundETHCalldata(),
    ]),
    value: msgValue,
  };
}

/**
 * Receive native ETH — single-hop exact input.
 * `tokenOut` must be wrappedNative. Encodes `multicall([exactInputSingle → router, unwrapWETH9])`.
 * For WETH to the user instead, use `encodeExactInputSingleCalldata` (no unwrap).
 */
export function prepareExactInputSingleToNativeCalldata(
  params: ExactInputSingleParams,
  options: {
    simpleRouter: Address;
    ethRecipient?: Address;
    unwrapAmountMinimum?: bigint;
  },
): PreparedSwapTransaction {
  const ethRecipient = options.ethRecipient ?? params.recipient;
  const calls: Hex[] = [
    encodeExactInputSingleCalldata(withRouterRecipient(params, options.simpleRouter)),
    encodeUnwrapWETH9Calldata(options.unwrapAmountMinimum ?? 0n, ethRecipient),
  ];
  return { data: encodeMulticallCalldata(calls) };
}

/**
 * Pay with native ETH — multihop exact input.
 * First token must be wrappedNative. Same native-only / mixed rules as {@link prepareExactInputSingleFromNativeCalldata}.
 */
export function prepareExactInputFromNativeCalldata(
  params: ExactInputParams,
  options: NativeEthInputOptions = {},
): PreparedSwapTransaction {
  const msgValue = options.msgValue ?? params.amountIn;
  return {
    data: encodeMulticallCalldata([
      encodeExactInputCalldata(params),
      encodeRefundETHCalldata(),
    ]),
    value: msgValue,
  };
}

/**
 * Receive native ETH — multihop exact input.
 * Last token must be wrappedNative. For WETH output use `encodeExactInputCalldata`.
 */
export function prepareExactInputToNativeCalldata(
  params: ExactInputParams,
  options: {
    simpleRouter: Address;
    ethRecipient?: Address;
    unwrapAmountMinimum?: bigint;
  },
): PreparedSwapTransaction {
  const ethRecipient = options.ethRecipient ?? params.recipient;
  const calls: Hex[] = [
    encodeExactInputCalldata(withRouterRecipient(params, options.simpleRouter)),
    encodeUnwrapWETH9Calldata(options.unwrapAmountMinimum ?? 0n, ethRecipient),
  ];
  return { data: encodeMulticallCalldata(calls) };
}

/**
 * Pay with native ETH — single-hop exact output.
 * `tokenIn` must be wrappedNative. Encodes `multicall{value}([exactOutputSingle, refundETH])`.
 * Native-only / mixed: same `msgValue` rules as {@link prepareExactInputSingleFromNativeCalldata} (`amountInMaximum` default).
 */
export function prepareExactOutputSingleFromNativeCalldata(
  params: ExactOutputSingleParams,
  options: NativeEthOutputInputOptions = {},
): PreparedSwapTransaction {
  const msgValue = options.msgValue ?? params.amountInMaximum;
  return {
    data: encodeMulticallCalldata([
      encodeExactOutputSingleCalldata(params),
      encodeRefundETHCalldata(),
    ]),
    value: msgValue,
  };
}

/**
 * Receive native ETH — single-hop exact output.
 * `tokenOut` must be wrappedNative. Unwrap minimum defaults to `amountOut`.
 * For WETH output use `encodeExactOutputSingleCalldata`.
 */
export function prepareExactOutputSingleToNativeCalldata(
  params: ExactOutputSingleParams,
  options: {
    simpleRouter: Address;
    ethRecipient?: Address;
    unwrapAmountMinimum?: bigint;
  },
): PreparedSwapTransaction {
  const ethRecipient = options.ethRecipient ?? params.recipient;
  const unwrapMinimum = options.unwrapAmountMinimum ?? params.amountOut;
  const calls: Hex[] = [
    encodeExactOutputSingleCalldata(withRouterRecipient(params, options.simpleRouter)),
    encodeUnwrapWETH9Calldata(unwrapMinimum, ethRecipient),
  ];
  return { data: encodeMulticallCalldata(calls) };
}

/**
 * Pay with native ETH — multihop exact output.
 * Same native-only / mixed rules as {@link prepareExactOutputSingleFromNativeCalldata}.
 */
export function prepareExactOutputFromNativeCalldata(
  params: ExactOutputParams,
  options: NativeEthOutputInputOptions = {},
): PreparedSwapTransaction {
  const msgValue = options.msgValue ?? params.amountInMaximum;
  return {
    data: encodeMulticallCalldata([
      encodeExactOutputCalldata(params),
      encodeRefundETHCalldata(),
    ]),
    value: msgValue,
  };
}

/**
 * Receive native ETH — multihop exact output.
 * Unwrap minimum defaults to `amountOut`. For WETH output use `encodeExactOutputCalldata`.
 */
export function prepareExactOutputToNativeCalldata(
  params: ExactOutputParams,
  options: {
    simpleRouter: Address;
    ethRecipient?: Address;
    unwrapAmountMinimum?: bigint;
  },
): PreparedSwapTransaction {
  const ethRecipient = options.ethRecipient ?? params.recipient;
  const unwrapMinimum = options.unwrapAmountMinimum ?? params.amountOut;
  const calls: Hex[] = [
    encodeExactOutputCalldata(withRouterRecipient(params, options.simpleRouter)),
    encodeUnwrapWETH9Calldata(unwrapMinimum, ethRecipient),
  ];
  return { data: encodeMulticallCalldata(calls) };
}
