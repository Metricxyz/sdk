import {
  OnStepSuccess,
  OnStepFailure,
  type ExactInputParams,
  type ExactOutputParams,
  type ExactInputSingleParams,
  type ExactOutputSingleParams,
  type ExternalSwapFallback,
} from "./types.js";
import { toExternalSwapParams } from "./paramTransforms.js";
import type { Address, Hex } from "viem";
import { encodeMulticallCalldata } from "../peripheryPayments/index.js";
import { encodeSequenceCalldata } from "./sequence.js";
import {
  encodeExternalSwapCalldata,
  prepareExternalSwapSupportingNativePaymentCalldata,
  prepareExternalSwapAndUnwrapCalldata,
} from "./externalSwap.js";
import { encodeExactInputSingleCalldata, encodeExactOutputSingleCalldata } from "./swap.js";
import { encodeExactInputCalldata, encodeExactOutputCalldata } from "./swapPath.js";
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

function encodeSwapFallback(primary: Hex, fallback: Hex): Hex {
  return encodeSequenceCalldata([
    { data: primary, onSuccess: OnStepSuccess.STOP, onFailure: OnStepFailure.CONTINUE },
    { data: fallback, onSuccess: OnStepSuccess.STOP, onFailure: OnStepFailure.REVERT },
  ]);
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
export function prepareExactInputWithExternalSwapFallbackCalldata(
  params: ExactInputParams,
  fallback: ExternalSwapFallback,
): Hex {
  return encodeSwapFallback(
    encodeMulticallCalldata([encodeExactInputCalldata(params)]),
    encodeMulticallCalldata([
      encodeExternalSwapCalldata(fallback.executor, toExternalSwapParams(params, fallback)),
    ]),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
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
      toExternalSwapParams(params, fallback),
      chainId,
      wrappedNative,
    ),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
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
      toExternalSwapParams(params, fallback),
      simpleRouter,
      chainId,
      wrappedNative,
    ),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
export function prepareExactInputSingleWithExternalSwapFallbackCalldata(
  params: ExactInputSingleParams,
  fallback: ExternalSwapFallback,
): Hex {
  return encodeSwapFallback(
    encodeMulticallCalldata([encodeExactInputSingleCalldata(params)]),
    encodeMulticallCalldata([
      encodeExternalSwapCalldata(fallback.executor, toExternalSwapParams(params, fallback)),
    ]),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
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
      toExternalSwapParams(params, fallback),
      chainId,
      wrappedNative,
    ),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
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
      toExternalSwapParams(params, fallback),
      simpleRouter,
      chainId,
      wrappedNative,
    ),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
export function prepareExactOutputWithExternalSwapFallbackCalldata(
  params: ExactOutputParams,
  fallback: ExternalSwapFallback,
): Hex {
  return encodeSwapFallback(
    encodeMulticallCalldata([encodeExactOutputCalldata(params)]),
    encodeMulticallCalldata([
      encodeExternalSwapCalldata(fallback.executor, toExternalSwapParams(params, fallback)),
    ]),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
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
      toExternalSwapParams(params, fallback),
      chainId,
      wrappedNative,
    ),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
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
      toExternalSwapParams(params, fallback),
      simpleRouter,
      chainId,
      wrappedNative,
    ),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
export function prepareExactOutputSingleWithExternalSwapFallbackCalldata(
  params: ExactOutputSingleParams,
  fallback: ExternalSwapFallback,
): Hex {
  return encodeSwapFallback(
    encodeMulticallCalldata([encodeExactOutputSingleCalldata(params)]),
    encodeMulticallCalldata([
      encodeExternalSwapCalldata(fallback.executor, toExternalSwapParams(params, fallback)),
    ]),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
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
      toExternalSwapParams(params, fallback),
      chainId,
      wrappedNative,
    ),
  );
}

/** See {@link ExternalSwapFallback} for external swap requirements. */
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
      toExternalSwapParams(params, fallback),
      simpleRouter,
      chainId,
      wrappedNative,
    ),
  );
}

export type { ExternalSwapFallback } from "./types.js";
