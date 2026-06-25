/** SimpleRouter multicall and PeripheryPayments calldata encoders. */

import type { Address, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { SIMPLE_ROUTER_ABI } from "../constants.js";

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
