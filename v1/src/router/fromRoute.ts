/**
 * Map Oracle API `/public/v1/evm/:chain_id/route` responses to SimpleRouter swap params.
 */

import type { Address, Hex, PublicClient } from "viem";
import { getAddress } from "viem";
import { resolveSwapPath } from "../swap/path.js";
import { toSlippageBps } from "./swap.js";
import type { ExactInputParams } from "./swapPath.js";
import type { ExactInputSingleParams } from "./swap.js";

const BPS_BASE = 10_000n;

/** Wire `routeType` from the Oracle route endpoint. */
export type RouteType = "direct" | "oneHop";

/** One hop in an Oracle route response (`RouteLegResponse`). */
export type RouteLegResponse = {
  poolAddress: string;
  pair: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  effectivePriceX64: string;
  priceImpactE6: string;
  priceLimitX64: string;
};

/** Oracle route response (`RouteResponse`). */
export type RouteResponse = {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  effectivePriceX64: string;
  priceImpactE6: string;
  routeType: RouteType;
  intermediaryToken?: string | null;
  legs: RouteLegResponse[];
  serverTs: number;
  candidatesConsidered: number;
};

export type PrepareExactInputFromRouteParams = {
  publicClient: PublicClient;
  route: RouteResponse;
  recipient: Address;
  deadline: bigint;
  /** Human-readable slippage tolerance applied to `route.amountOut`, e.g. `0.5` = 0.5%. */
  slippagePercent: number;
  extensionDatas?: readonly Hex[];
};

export type PreparedExactInputFromRoute =
  | { kind: "single"; params: ExactInputSingleParams }
  | { kind: "multihop"; params: ExactInputParams };

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
    throw new Error(`invalid ${field}: ${value}`);
  }
}

function validateRouteLegs(route: RouteResponse, tokenIn: Address, tokenOut: Address): Address[] {
  if (route.legs.length === 0) {
    throw new Error("route.legs must not be empty");
  }

  const pools: Address[] = [];
  for (let i = 0; i < route.legs.length; i++) {
    const leg = route.legs[i]!;
    const legTokenIn = parseAddress(leg.tokenIn, `legs[${i}].tokenIn`);
    const legTokenOut = parseAddress(leg.tokenOut, `legs[${i}].tokenOut`);
    pools.push(parseAddress(leg.poolAddress, `legs[${i}].poolAddress`));

    if (i === 0 && legTokenIn !== tokenIn) {
      throw new Error(`legs[0].tokenIn (${legTokenIn}) does not match route.tokenIn (${tokenIn})`);
    }
    if (i === route.legs.length - 1 && legTokenOut !== tokenOut) {
      throw new Error(
        `legs[${i}].tokenOut (${legTokenOut}) does not match route.tokenOut (${tokenOut})`,
      );
    }
    if (i > 0) {
      const prevLegTokenOut = parseAddress(route.legs[i - 1]!.tokenOut, `legs[${i - 1}].tokenOut`);
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

/**
 * Convert an Oracle `/route` response into SimpleRouter exact-input swap params.
 *
 * Resolves swap direction on-chain, applies slippage to the quoted `amountOut`, and
 * returns params ready for `encodeExactInputSingleCalldata` or `encodeExactInputCalldata`.
 *
 * @example
 * ```ts
 * const route = await fetchRouteFromOracle(...);
 * const prepared = await prepareExactInputFromRoute({
 *   publicClient,
 *   route,
 *   recipient: account,
 *   deadline,
 *   slippagePercent: 0.5,
 * });
 * const data =
 *   prepared.kind === "single"
 *     ? encodeExactInputSingleCalldata(prepared.params)
 *     : encodeExactInputCalldata(prepared.params);
 * ```
 */
export async function routeToExactInputParams(
  params: PrepareExactInputFromRouteParams,
): Promise<PreparedExactInputFromRoute> {
  const { route, publicClient, recipient, deadline, slippagePercent, extensionDatas } = params;

  const tokenIn = parseAddress(route.tokenIn, "tokenIn");
  const tokenOut = parseAddress(route.tokenOut, "tokenOut");
  const amountIn = parseAmount(route.amountIn, "amountIn");
  const quotedAmountOut = parseAmount(route.amountOut, "amountOut");
  const amountOutMinimum = amountOutMinimumFromRoute(quotedAmountOut, slippagePercent);

  const pools = validateRouteLegs(route, tokenIn, tokenOut);
  const {
    tokens,
    zeroForOnes,
    extensionDatas: resolvedExtensionDatas,
    zeroForOneBitMap,
  } = await resolveSwapPath(publicClient, tokenIn, tokenOut, pools, extensionDatas);

  if (pools.length === 1) {
    const leg = route.legs[0]!;
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
