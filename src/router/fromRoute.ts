/**
 * Map route API POST /public/v1/evm/:chain_id/route responses to SimpleRouter swap params.
 */

import type {
  TradeType,
  RouteLegResponse,
  RouteOptionResponse,
  RouteResponse,
  PrepareExactInputFromRouteParams,
  PrepareExactOutputFromRouteParams,
  PreparedExactInputFromRoute,
  PreparedExactOutputFromRoute,
} from "./types.js";

import type { Address } from "viem";
import { getAddress } from "viem";
import { resolveSwapPath } from "../swap/path.js";
import { ceilDiv, toSlippageBps } from "./slippage.js";

const BPS_BASE = 10_000n;

function parseAddress(value: string, field: string): Address {
  try {
    return getAddress(value);
  } catch {
    throw new Error(`invalid ${field}: ${value}`);
  }
}

function parseAmount(value: string, field: string): bigint {
  try {
    const amount = BigInt(value);
    if (amount < 0n) {
      throw new Error(`${field} must be non-negative`);
    }
    return amount;
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be non-negative")) {
      throw error;
    }
    throw new Error(`invalid ${field}: ${value}`, { cause: error });
  }
}

function selectRouteOption(route: RouteResponse): RouteOptionResponse {
  if (route.routes.length === 0) {
    throw new Error("route.routes must not be empty");
  }
  if (route.routes.length > 1) {
    throw new Error("route was split across multiple routes; re-request with maxRoutes=1");
  }
  return route.routes[0]!;
}

function assertTradeType(
  route: RouteResponse,
  option: RouteOptionResponse,
  tradeType: TradeType,
): void {
  if (route.tradeType !== tradeType) {
    throw new Error(
      `route tradeType must be ${tradeType}; use ${
        tradeType === "exact_in" ? "prepareExactOutputFromRoute" : "prepareExactInputFromRoute"
      } for ${tradeType === "exact_in" ? "exact_out" : "exact_in"}`,
    );
  }
  if (option.tradeType !== tradeType) {
    throw new Error(`routes[0].tradeType must be ${tradeType}`);
  }
}

function validateRouteLegs(
  legs: RouteLegResponse[],
  tokenIn: Address,
  tokenOut: Address,
): Address[] {
  if (legs.length === 0) {
    throw new Error("routes[0].legs must not be empty");
  }

  const pools: Address[] = [];
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    const legTokenIn = parseAddress(leg.tokenIn, `legs[${i}].tokenIn`);
    const legTokenOut = parseAddress(leg.tokenOut, `legs[${i}].tokenOut`);
    pools.push(parseAddress(leg.poolAddress, `legs[${i}].poolAddress`));

    if (i === 0 && legTokenIn !== tokenIn) {
      throw new Error(`legs[0].tokenIn (${legTokenIn}) does not match route.tokenIn (${tokenIn})`);
    }
    if (i === legs.length - 1 && legTokenOut !== tokenOut) {
      throw new Error(
        `legs[${i}].tokenOut (${legTokenOut}) does not match route.tokenOut (${tokenOut})`,
      );
    }
    if (i > 0) {
      const prevLegTokenOut = parseAddress(legs[i - 1]!.tokenOut, `legs[${i - 1}].tokenOut`);
      if (legTokenIn !== prevLegTokenOut) {
        throw new Error(
          `legs[${i}].tokenIn (${legTokenIn}) does not connect to legs[${i - 1}].tokenOut (${prevLegTokenOut})`,
        );
      }
    }
  }

  return pools;
}

function amountOutMinimumFromRoute(amountOut: bigint, slippagePercent: number): bigint {
  const slippageBps = toSlippageBps(slippagePercent);
  return (amountOut * (BPS_BASE - slippageBps)) / BPS_BASE;
}

function amountInMaximumFromRoute(amountIn: bigint, slippagePercent: number): bigint {
  const slippageBps = toSlippageBps(slippagePercent);
  return ceilDiv(amountIn * (BPS_BASE + slippageBps), BPS_BASE);
}

/**
 * Convert a route API exact-in response into SimpleRouter exact-input swap params.
 *
 * Resolves swap direction on-chain, applies slippage to the quoted `amountOut`, and
 * returns params ready for `encodeExactInputSingleCalldata` or `encodeExactInputCalldata`.
 */
export async function routeToExactInputParams(
  params: PrepareExactInputFromRouteParams,
): Promise<PreparedExactInputFromRoute> {
  const { route, publicClient, recipient, deadline, slippagePercent, extensionDatas } = params;

  const tokenIn = parseAddress(route.tokenIn, "tokenIn");
  const tokenOut = parseAddress(route.tokenOut, "tokenOut");
  const option = selectRouteOption(route);
  assertTradeType(route, option, "exact_in");

  const requestedAmountIn = parseAmount(route.amountIn, "amountIn");
  const amountIn = parseAmount(option.amountIn, "routes[0].amountIn");
  if (amountIn !== requestedAmountIn) {
    throw new Error(
      "routes[0].amountIn does not match request amountIn; partial fill is not supported",
    );
  }
  const quotedAmountOut = parseAmount(option.amountOut, "routes[0].amountOut");
  const amountOutMinimum = amountOutMinimumFromRoute(quotedAmountOut, slippagePercent);

  const pools = validateRouteLegs(option.legs, tokenIn, tokenOut);
  const {
    tokens,
    zeroForOnes,
    extensionDatas: resolvedExtensionDatas,
    zeroForOneBitMap,
  } = await resolveSwapPath(publicClient, tokenIn, tokenOut, pools, extensionDatas);

  if (pools.length === 1) {
    const leg = option.legs[0]!;
    return {
      kind: "single",
      params: {
        pool: pools[0]!,
        tokenIn,
        tokenOut,
        zeroForOne: zeroForOnes[0]!,
        amountIn,
        amountOutMinimum,
        recipient,
        deadline,
        priceLimitX64: parseAmount(leg.priceLimitX64, "legs[0].priceLimitX64"),
        extensionData: resolvedExtensionDatas[0],
      },
    };
  }

  return {
    kind: "multihop",
    params: {
      tokens,
      pools,
      extensionDatas: resolvedExtensionDatas,
      zeroForOneBitMap,
      amountIn,
      amountOutMinimum,
      recipient,
      deadline,
    },
  };
}

/**
 * Convert a route API exact-out response into SimpleRouter exact-output swap params.
 *
 * Resolves swap direction on-chain, applies slippage to the quoted `amountIn`, and
 * returns params ready for `encodeExactOutputSingleCalldata` or `encodeExactOutputCalldata`.
 */
export async function routeToExactOutputParams(
  params: PrepareExactOutputFromRouteParams,
): Promise<PreparedExactOutputFromRoute> {
  const { route, publicClient, recipient, deadline, slippagePercent, extensionDatas } = params;

  const tokenIn = parseAddress(route.tokenIn, "tokenIn");
  const tokenOut = parseAddress(route.tokenOut, "tokenOut");
  const option = selectRouteOption(route);
  assertTradeType(route, option, "exact_out");

  const requestedAmountOut = parseAmount(route.amountOut, "amountOut");
  const amountOut = parseAmount(option.amountOut, "routes[0].amountOut");
  if (amountOut !== requestedAmountOut) {
    throw new Error(
      "routes[0].amountOut does not match request amountOut; partial fill is not supported",
    );
  }
  const quotedAmountIn = parseAmount(option.amountIn, "routes[0].amountIn");
  const amountInMaximum = amountInMaximumFromRoute(quotedAmountIn, slippagePercent);

  const pools = validateRouteLegs(option.legs, tokenIn, tokenOut);
  const {
    tokens,
    zeroForOnes,
    extensionDatas: resolvedExtensionDatas,
    zeroForOneBitMap,
  } = await resolveSwapPath(publicClient, tokenIn, tokenOut, pools, extensionDatas);

  if (pools.length === 1) {
    const leg = option.legs[0]!;
    return {
      kind: "single",
      params: {
        pool: pools[0]!,
        tokenIn,
        tokenOut,
        zeroForOne: zeroForOnes[0]!,
        amountOut,
        amountInMaximum,
        recipient,
        deadline,
        priceLimitX64: parseAmount(leg.priceLimitX64, "legs[0].priceLimitX64"),
        extensionData: resolvedExtensionDatas[0],
      },
    };
  }

  return {
    kind: "multihop",
    params: {
      tokens,
      pools,
      extensionDatas: resolvedExtensionDatas,
      zeroForOneBitMap,
      amountOut,
      amountInMaximum,
      recipient,
      deadline,
    },
  };
}

export type {
  TradeType,
  RouteType,
  RouteLegResponse,
  RouteOptionResponse,
  RouteResponse,
  PrepareExactInputFromRouteParams,
  PrepareExactOutputFromRouteParams,
  PreparedExactInputFromRoute,
  PreparedExactOutputFromRoute,
} from "./types.js";
