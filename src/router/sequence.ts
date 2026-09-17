import { encodeFunctionData, type Hex } from "viem";
import { SIMPLE_ROUTER_ABI } from "../constants.js";

export enum OnStepSuccess {
  CONTINUE,
  STOP,
}

export enum OnStepFailure {
  CONTINUE,
  STOP,
  REVERT,
}

export type SequenceCall = {
  data: Hex;
  onSuccess: OnStepSuccess;
  onFailure: OnStepFailure;
};

/** Delegatecalls router operations, preserving the transaction's caller and value. */
export function encodeSequenceCalldata(calls: readonly SequenceCall[]): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "sequence",
    args: [calls],
  });
}
