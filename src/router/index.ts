/**
 * SimpleRouter swap API — quotes, calldata encoding, and native ETH multicall helpers.
 *
 * **ERC-20 swap:** `buildExactInputSingleParams` → `encodeExactInputSingleCalldata` → send to `simpleRouter`.

 * Approve `tokenIn` on the router for ERC-20 input (not required for ETH input).
 */

export {
  buildExactInputParams,
  buildExactOutputParams,
  encodeExactInputCalldata,
  encodeExactOutputCalldata,
  encodeZeroForOneBitMap,
  prepareExactInputCalldata,
  prepareExactOutputCalldata,
  type ExactInputParams,
  type ExactOutputParams,
  type BuildExactInputParams,
  type BuildExactOutputParams,
} from "./swapPath.js";

export {
  buildExactInputSingleParams,
  buildExactOutputSingleParams,
  encodeExactInputSingleCalldata,
  encodeExactOutputSingleCalldata,
  prepareExactInputSingleCalldata,
  prepareExactOutputSingleCalldata,
  type ExactInputSingleParams,
  type ExactOutputSingleParams,
  type BuildExactInputSingleParams,
  type BuildExactOutputSingleParams,
} from "./swap.js";

export {
  routeToExactInputParams as prepareExactInputFromRoute,
  routeToExactOutputParams as prepareExactOutputFromRoute,
  type TradeType,
  type RouteType,
  type RouteLegResponse,
  type RouteOptionResponse,
  type RouteResponse,
  type PrepareExactInputFromRouteParams,
  type PrepareExactOutputFromRouteParams,
  type PreparedExactInputFromRoute,
  type PreparedExactOutputFromRoute,
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
