import type { Hex } from "viem";
import { encodeFunctionData } from "viem";
import { SIMPLE_ROUTER_ABI } from "../constants.js";
import type {
  ExactInputParams,
  ExactOutputParams,
  ExactInputSingleParams,
  ExactOutputSingleParams,
} from "./types.js";
import {
  toExactInputStruct,
  toExactOutputStruct,
  toExactInputSingleStruct,
  toExactOutputSingleStruct,
} from "./paramTransforms.js";

export type {
  ExactInputParams,
  ExactOutputParams,
  BuildExactInputParams,
  BuildExactOutputParams,
  ExactInputSingleParams,
  ExactOutputSingleParams,
  BuildExactInputSingleParams,
  BuildExactOutputSingleParams,
} from "./types.js";
export {
  buildExactInputParams,
  buildExactOutputParams,
  buildExactInputSingleParams,
  buildExactOutputSingleParams,
} from "./buildParams.js";
export { ceilDiv, toSlippageBps } from "./slippage.js";

/**
 * Encode `exactInputSingle` calldata for `addresses.simpleRouter`.
 * Approve `tokenIn` on the router before sending (unless using native ETH prepare helpers).
 */
export function encodeExactInputSingleCalldata(params: ExactInputSingleParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [toExactInputSingleStruct(params)],
  });
}

/** Alias for {@link encodeExactInputSingleCalldata}. */
export const prepareExactInputSingleCalldata = encodeExactInputSingleCalldata;

/** Encode `exactOutputSingle` calldata for `addresses.simpleRouter`. */
export function encodeExactOutputSingleCalldata(params: ExactOutputSingleParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "exactOutputSingle",
    args: [toExactOutputSingleStruct(params)],
  });
}

/** Alias for {@link encodeExactOutputSingleCalldata}. */
export const prepareExactOutputSingleCalldata = encodeExactOutputSingleCalldata;

/** Encode `exactInput` multihop calldata. */
export function encodeExactInputCalldata(params: ExactInputParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "exactInput",
    args: [toExactInputStruct(params)],
  });
}

/** Alias for {@link encodeExactInputCalldata}. */
export const prepareExactInputCalldata = encodeExactInputCalldata;

/** Encode `exactOutput` multihop calldata. */
export function encodeExactOutputCalldata(params: ExactOutputParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "exactOutput",
    args: [toExactOutputStruct(params)],
  });
}

/** Alias for {@link encodeExactOutputCalldata}. */
export const prepareExactOutputCalldata = encodeExactOutputCalldata;

export { encodeZeroForOneBitMap } from "../swap/path.js";
