import type { SequenceCall } from "./types.js";
import { encodeFunctionData, type Hex } from "viem";
import { SIMPLE_ROUTER_ABI } from "../constants.js";

/** Delegatecalls router operations, preserving the transaction's caller and value. */
export function encodeSequenceCalldata(calls: readonly SequenceCall[]): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "sequence",
    args: [calls],
  });
}

export type { SequenceCall } from "./types.js";
export { OnStepSuccess, OnStepFailure } from "./types.js";
