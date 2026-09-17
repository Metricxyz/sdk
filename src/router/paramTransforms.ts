import type { Hex } from "viem";
import type {
  ExactInputParams,
  ExactOutputParams,
  ExactInputSingleParams,
  ExactOutputSingleParams,
  ExternalSwapParams,
  ExternalSwapFallback,
} from "./types.js";
import { EMPTY_EXTENSION_DATA } from "../extensions/types.js";

function withExtensionData(extensionData?: Hex): Hex {
  return extensionData ?? EMPTY_EXTENSION_DATA;
}

export function toExactInputSingleStruct(
  params: ExactInputSingleParams,
): Required<ExactInputSingleParams> {
  return {
    pool: params.pool,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    zeroForOne: params.zeroForOne,
    amountIn: params.amountIn,
    amountOutMinimum: params.amountOutMinimum,
    recipient: params.recipient,
    deadline: params.deadline,
    priceLimitX64: params.priceLimitX64,
    extensionData: withExtensionData(params.extensionData),
  };
}

export function toExactOutputSingleStruct(
  params: ExactOutputSingleParams,
): Required<ExactOutputSingleParams> {
  return {
    pool: params.pool,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    zeroForOne: params.zeroForOne,
    amountOut: params.amountOut,
    amountInMaximum: params.amountInMaximum,
    recipient: params.recipient,
    deadline: params.deadline,
    priceLimitX64: params.priceLimitX64,
    extensionData: withExtensionData(params.extensionData),
  };
}

export function toExactInputStruct(params: ExactInputParams): ExactInputParams {
  return {
    tokens: params.tokens,
    pools: params.pools,
    extensionDatas: params.extensionDatas,
    zeroForOneBitMap: params.zeroForOneBitMap,
    amountIn: params.amountIn,
    amountOutMinimum: params.amountOutMinimum,
    recipient: params.recipient,
    deadline: params.deadline,
  };
}

export function toExactOutputStruct(params: ExactOutputParams): ExactOutputParams {
  return {
    tokens: params.tokens,
    pools: params.pools,
    extensionDatas: params.extensionDatas,
    zeroForOneBitMap: params.zeroForOneBitMap,
    amountOut: params.amountOut,
    amountInMaximum: params.amountInMaximum,
    recipient: params.recipient,
    deadline: params.deadline,
  };
}

export function toExternalSwapParams(
  params: ExactInputParams,
  fallback: ExternalSwapFallback,
): ExternalSwapParams;
export function toExternalSwapParams(
  params: ExactInputSingleParams,
  fallback: ExternalSwapFallback,
): ExternalSwapParams;
export function toExternalSwapParams(
  params: ExactOutputParams,
  fallback: ExternalSwapFallback,
): ExternalSwapParams;
export function toExternalSwapParams(
  params: ExactOutputSingleParams,
  fallback: ExternalSwapFallback,
): ExternalSwapParams;
export function toExternalSwapParams(
  params: ExactInputParams | ExactInputSingleParams | ExactOutputParams | ExactOutputSingleParams,
  fallback: ExternalSwapFallback,
): ExternalSwapParams {
  const hasInputAmounts = "amountIn" in params || "amountOutMinimum" in params;
  const hasOutputAmounts = "amountOut" in params || "amountInMaximum" in params;
  if (
    hasInputAmounts === hasOutputAmounts ||
    (hasInputAmounts && !("amountIn" in params && "amountOutMinimum" in params)) ||
    (hasOutputAmounts && !("amountOut" in params && "amountInMaximum" in params))
  ) {
    throw new Error(
      "Swap params must contain exactly one complete exact-input or exact-output amount pair",
    );
  }

  const hasPath = "tokens" in params;
  const hasSingleTokens = "tokenIn" in params || "tokenOut" in params;
  if (
    hasPath === hasSingleTokens ||
    (hasSingleTokens && !("tokenIn" in params && "tokenOut" in params))
  ) {
    throw new Error(
      "Swap params must contain either tokens or both tokenIn and tokenOut, not both shapes",
    );
  }

  return {
    tokenIn: "tokens" in params ? params.tokens[0]! : params.tokenIn,
    tokenOut: "tokens" in params ? params.tokens[params.tokens.length - 1]! : params.tokenOut,
    amountInMaximum: "amountIn" in params ? params.amountIn : params.amountInMaximum,
    amountOutMinimum: "amountOut" in params ? params.amountOut : params.amountOutMinimum,
    recipient: params.recipient,
    deadline: params.deadline,
    externalRouter: fallback.externalRouter,
    externalRouterCalldata: fallback.externalRouterCalldata,
  };
}
