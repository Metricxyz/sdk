import type { Address, Hex } from "viem";
import { encodeMulticallCalldata } from "../peripheryPayments/index.js";
import { encodeSequenceCalldata, OnStepSuccess, OnStepFailure } from "./sequence.js";
import {
  encodeExternalSwapCalldata,
  prepareExternalSwapSupportingNativePaymentCalldata,
  prepareExternalSwapAndUnwrapCalldata,
  type ExternalSwapParams,
} from "./externalSwap.js";
import {
  encodeExactInputSingleCalldata,
  encodeExactOutputSingleCalldata,
  type ExactInputSingleParams,
  type ExactOutputSingleParams,
} from "./swap.js";
import {
  encodeExactInputCalldata,
  encodeExactOutputCalldata,
  type ExactInputParams,
  type ExactOutputParams,
} from "./swapPath.js";
import {
  prepareExactInputSupportingNativePaymentCalldata,
  prepareExactInputAndUnwrapCalldata,
  prepareExactInputSingleSupportingNativePaymentCalldata,
  prepareExactInputSingleAndUnwrapCalldata,
  prepareExactOutputSupportingNativePaymentCalldata,
  prepareExactOutputAndUnwrapCalldata,
  prepareExactOutputSingleSupportingNativePaymentCalldata,
  prepareExactOutputSingleAndUnwrapCalldata,
} from "./nativeSwap.js";

/** External quote calldata must use the primary swap's tokens and limits and pay the executor. */
export type ExternalSwapFallback = Pick<
  ExternalSwapParams,
  "externalRouter" | "externalRouterCalldata"
> & { executor: Address };

function encodeSwapFallback(primary: Hex, fallback: Hex): Hex {
  return encodeSequenceCalldata([
    { data: primary, onSuccess: OnStepSuccess.STOP, onFailure: OnStepFailure.CONTINUE },
    { data: fallback, onSuccess: OnStepSuccess.STOP, onFailure: OnStepFailure.REVERT },
  ]);
}

function externalSwapParams(
  params: ExactInputParams | ExactInputSingleParams | ExactOutputParams | ExactOutputSingleParams,
  fallback: ExternalSwapFallback,
): ExternalSwapParams {
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

export function prepareExactInputWithExternalSwapFallbackCalldata(
  params: ExactInputParams,
  fallback: ExternalSwapFallback,
): Hex {
  return encodeSwapFallback(
    encodeMulticallCalldata([encodeExactInputCalldata(params)]),
    encodeMulticallCalldata([
      encodeExternalSwapCalldata(fallback.executor, externalSwapParams(params, fallback)),
    ]),
  );
}

export function prepareExactInputSupportingNativePaymentWithExternalSwapFallbackCalldata(
  params: ExactInputParams,
  fallback: ExternalSwapFallback,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  return encodeSwapFallback(
    prepareExactInputSupportingNativePaymentCalldata(params, chainId, wrappedNative),
    prepareExternalSwapSupportingNativePaymentCalldata(
      fallback.executor,
      externalSwapParams(params, fallback),
      chainId,
      wrappedNative,
    ),
  );
}

export function prepareExactInputAndUnwrapWithExternalSwapFallbackCalldata(
  params: ExactInputParams,
  fallback: ExternalSwapFallback,
  simpleRouter: Address,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  return encodeSwapFallback(
    prepareExactInputAndUnwrapCalldata(params, simpleRouter, chainId, wrappedNative),
    prepareExternalSwapAndUnwrapCalldata(
      fallback.executor,
      externalSwapParams(params, fallback),
      simpleRouter,
      chainId,
      wrappedNative,
    ),
  );
}

export function prepareExactInputSingleWithExternalSwapFallbackCalldata(
  params: ExactInputSingleParams,
  fallback: ExternalSwapFallback,
): Hex {
  return encodeSwapFallback(
    encodeMulticallCalldata([encodeExactInputSingleCalldata(params)]),
    encodeMulticallCalldata([
      encodeExternalSwapCalldata(fallback.executor, externalSwapParams(params, fallback)),
    ]),
  );
}

export function prepareExactInputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata(
  params: ExactInputSingleParams,
  fallback: ExternalSwapFallback,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  return encodeSwapFallback(
    prepareExactInputSingleSupportingNativePaymentCalldata(params, chainId, wrappedNative),
    prepareExternalSwapSupportingNativePaymentCalldata(
      fallback.executor,
      externalSwapParams(params, fallback),
      chainId,
      wrappedNative,
    ),
  );
}

export function prepareExactInputSingleAndUnwrapWithExternalSwapFallbackCalldata(
  params: ExactInputSingleParams,
  fallback: ExternalSwapFallback,
  simpleRouter: Address,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  return encodeSwapFallback(
    prepareExactInputSingleAndUnwrapCalldata(params, simpleRouter, chainId, wrappedNative),
    prepareExternalSwapAndUnwrapCalldata(
      fallback.executor,
      externalSwapParams(params, fallback),
      simpleRouter,
      chainId,
      wrappedNative,
    ),
  );
}

export function prepareExactOutputWithExternalSwapFallbackCalldata(
  params: ExactOutputParams,
  fallback: ExternalSwapFallback,
): Hex {
  return encodeSwapFallback(
    encodeMulticallCalldata([encodeExactOutputCalldata(params)]),
    encodeMulticallCalldata([
      encodeExternalSwapCalldata(fallback.executor, externalSwapParams(params, fallback)),
    ]),
  );
}

export function prepareExactOutputSupportingNativePaymentWithExternalSwapFallbackCalldata(
  params: ExactOutputParams,
  fallback: ExternalSwapFallback,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  return encodeSwapFallback(
    prepareExactOutputSupportingNativePaymentCalldata(params, chainId, wrappedNative),
    prepareExternalSwapSupportingNativePaymentCalldata(
      fallback.executor,
      externalSwapParams(params, fallback),
      chainId,
      wrappedNative,
    ),
  );
}

export function prepareExactOutputAndUnwrapWithExternalSwapFallbackCalldata(
  params: ExactOutputParams,
  fallback: ExternalSwapFallback,
  simpleRouter: Address,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  return encodeSwapFallback(
    prepareExactOutputAndUnwrapCalldata(params, simpleRouter, chainId, wrappedNative),
    prepareExternalSwapAndUnwrapCalldata(
      fallback.executor,
      externalSwapParams(params, fallback),
      simpleRouter,
      chainId,
      wrappedNative,
    ),
  );
}

export function prepareExactOutputSingleWithExternalSwapFallbackCalldata(
  params: ExactOutputSingleParams,
  fallback: ExternalSwapFallback,
): Hex {
  return encodeSwapFallback(
    encodeMulticallCalldata([encodeExactOutputSingleCalldata(params)]),
    encodeMulticallCalldata([
      encodeExternalSwapCalldata(fallback.executor, externalSwapParams(params, fallback)),
    ]),
  );
}

export function prepareExactOutputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata(
  params: ExactOutputSingleParams,
  fallback: ExternalSwapFallback,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  return encodeSwapFallback(
    prepareExactOutputSingleSupportingNativePaymentCalldata(params, chainId, wrappedNative),
    prepareExternalSwapSupportingNativePaymentCalldata(
      fallback.executor,
      externalSwapParams(params, fallback),
      chainId,
      wrappedNative,
    ),
  );
}

export function prepareExactOutputSingleAndUnwrapWithExternalSwapFallbackCalldata(
  params: ExactOutputSingleParams,
  fallback: ExternalSwapFallback,
  simpleRouter: Address,
  chainId: number | null,
  wrappedNative: Address | null,
): Hex {
  return encodeSwapFallback(
    prepareExactOutputSingleAndUnwrapCalldata(params, simpleRouter, chainId, wrappedNative),
    prepareExternalSwapAndUnwrapCalldata(
      fallback.executor,
      externalSwapParams(params, fallback),
      simpleRouter,
      chainId,
      wrappedNative,
    ),
  );
}
