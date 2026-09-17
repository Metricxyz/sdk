/**
 * SimpleRouter swap API — quotes, calldata encoding, and native ETH multicall helpers.
 *
 * **ERC-20 swap:** `buildExactInputSingleParams` → `encodeExactInputSingleCalldata` → send to `simpleRouter`.

 * Approve `tokenIn` on the router for ERC-20 input (not required for ETH input).
 */

export {
  encodeExactInputCalldata,
  encodeExactOutputCalldata,
  encodeZeroForOneBitMap,
  prepareExactInputCalldata,
  prepareExactOutputCalldata,
  encodeExactInputSingleCalldata,
  encodeExactOutputSingleCalldata,
  prepareExactInputSingleCalldata,
  prepareExactOutputSingleCalldata,
} from "./swap.js";

export {
  routeToExactInputParams as prepareExactInputFromRoute,
  routeToExactOutputParams as prepareExactOutputFromRoute,
} from "./fromRoute.js";

export {
  encodeMulticallCalldata,
  encodeRefundETHCalldata,
  encodeUnwrapWETH9Calldata,
} from "../peripheryPayments/index.js";

export {
  prepareExactInputSingleAndUnwrapCalldata,
  prepareExactInputAndUnwrapCalldata,
  prepareExactInputSingleSupportingNativePaymentCalldata,
  prepareExactInputSupportingNativePaymentCalldata,
  prepareExactOutputSupportingNativePaymentCalldata,
  prepareExactOutputSingleSupportingNativePaymentCalldata,
  prepareExactOutputSingleAndUnwrapCalldata,
  prepareExactOutputAndUnwrapCalldata,
} from "./nativeSwap.js";

export { encodeSequenceCalldata } from "./sequence.js";
export {
  encodeExternalSwapCalldata,
  prepareExternalSwapCalldata,
  prepareExternalSwapSupportingNativePaymentCalldata,
  prepareExternalSwapAndUnwrapCalldata,
} from "./externalSwap.js";
export {
  prepareExactInputWithExternalSwapFallbackCalldata,
  prepareExactInputSupportingNativePaymentWithExternalSwapFallbackCalldata,
  prepareExactInputAndUnwrapWithExternalSwapFallbackCalldata,
  prepareExactInputSingleWithExternalSwapFallbackCalldata,
  prepareExactInputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata,
  prepareExactInputSingleAndUnwrapWithExternalSwapFallbackCalldata,
  prepareExactOutputWithExternalSwapFallbackCalldata,
  prepareExactOutputSupportingNativePaymentWithExternalSwapFallbackCalldata,
  prepareExactOutputAndUnwrapWithExternalSwapFallbackCalldata,
  prepareExactOutputSingleWithExternalSwapFallbackCalldata,
  prepareExactOutputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata,
  prepareExactOutputSingleAndUnwrapWithExternalSwapFallbackCalldata,
} from "./fallbackSwap.js";

export type {
  ExactInputSingleParams,
  ExactOutputSingleParams,
  BuildExactInputSingleParams,
  BuildExactOutputSingleParams,
  ExactInputParams,
  ExactOutputParams,
  BuildExactInputParams,
  BuildExactOutputParams,
  TradeType,
  RouteType,
  RouteLegResponse,
  RouteOptionResponse,
  RouteResponse,
  PrepareExactInputFromRouteParams,
  PrepareExactOutputFromRouteParams,
  PreparedExactInputFromRoute,
  PreparedExactOutputFromRoute,
  ExternalSwapParams,
  ExternalSwapFallback,
  SequenceCall,
} from "./types.js";
export { OnStepSuccess, OnStepFailure } from "./types.js";
export {
  buildExactInputSingleParams,
  buildExactOutputSingleParams,
  buildExactInputParams,
  buildExactOutputParams,
} from "./buildParams.js";
