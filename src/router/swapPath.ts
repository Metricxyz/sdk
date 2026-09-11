/**
 * SimpleRouter multihop swap helpers.
 *
 * Multihop swaps walk `pools` in order; intermediate tokens remain on the router between hops.
 * For ERC-20 paths, approve the router for `tokenIn` once before sending the transaction.
 */

import type { Address, Hex, PublicClient } from "viem";
import { encodeFunctionData } from "viem";
import { quoteLiveExactIn, quoteLiveExactOut } from "../quoter/quotePath.js";
import { resolveSwapPath } from "../swap/path.js";
import { SIMPLE_ROUTER_ABI } from "../constants.js";
import { ceilDiv, toSlippageBps } from "./swap.js";

const BPS_BASE = 10_000n;

/**
 * Arguments for `MetricOmmSimpleRouter.exactInput` (multihop exact input).
 * `tokens` and `zeroForOneBitMap` are usually produced by {@link buildExactInputParams}.
 */
export type ExactInputParams = {
  /** Path tokens, length `pools.length + 1`. */
  tokens: Address[];
  /** One pool per hop, in swap order. */
  pools: Address[];
  /** Extension calldata per hop; use `0x` when a pool has no extension. */
  extensionDatas: Hex[];
  /** Bit `i` set when hop `i` is token0 → token1. */
  zeroForOneBitMap: bigint;
  amountIn: bigint;
  amountOutMinimum: bigint;
  recipient: Address;
  deadline: bigint;
};

/** Arguments for `MetricOmmSimpleRouter.exactOutput` (multihop exact output). */
export type ExactOutputParams = {
  tokens: Address[];
  pools: Address[];
  extensionDatas: Hex[];
  zeroForOneBitMap: bigint;
  amountOut: bigint;
  amountInMaximum: bigint;
  recipient: Address;
  deadline: bigint;
};

/** Inputs for {@link buildExactInputParams}. */
export interface BuildExactInputParams {
  publicClient: PublicClient;
  tokenIn: Address;
  tokenOut: Address;
  /** Ordered pool addresses connecting `tokenIn` → `tokenOut`. */
  pools: readonly Address[];
  extensionDatas?: readonly Hex[];
  recipient: Address;
  /** Address the quoter should forward to swap extensions; defaults to recipient. */
  sender?: Address;
  amountIn: bigint;
  slippagePercent: number;
  deadline: bigint;
  quoterAddress?: Address;
  wrappedNative?: Address;
}

/** Inputs for {@link buildExactOutputParams}. */
export interface BuildExactOutputParams {
  publicClient: PublicClient;
  tokenIn: Address;
  tokenOut: Address;
  pools: readonly Address[];
  extensionDatas?: readonly Hex[];
  recipient: Address;
  sender?: Address;
  amountOut: bigint;
  slippagePercent: number;
  deadline: bigint;
  quoterAddress?: Address;
  wrappedNative?: Address;
}

function toExactInputStruct(params: ExactInputParams) {
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

function toExactOutputStruct(params: ExactOutputParams) {
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

/**
 * Build multihop exact-input params: resolves path, quotes output, applies slippage.
 *
 * @example
 * ```ts
 * const pathParams = await buildExactInputParams({
 *   publicClient,
 *   tokenIn: tokenA,
 *   tokenOut: tokenC,
 *   pools: [poolAB, poolBC],
 *   recipient: account,
 *   amountIn: parseUnits("1", 18),
 *   slippagePercent: 0.5,
 *   deadline,
 *   quoterAddress: addresses.quoter,
 * });
 * await walletClient.sendTransaction({
 *   to: addresses.simpleRouter,
 *   data: encodeExactInputCalldata(pathParams),
 *   account,
 * });
 * ```
 */
export async function buildExactInputParams(
  params: BuildExactInputParams,
): Promise<ExactInputParams> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const { tokens, extensionDatas, zeroForOneBitMap } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    params.pools,
    params.extensionDatas,
  );

  const { amountOut } = await quoteLiveExactIn({
    publicClient: params.publicClient,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    pools: params.pools,
    extensionDatas: params.extensionDatas,
    recipient: params.recipient,
    sender: params.sender,
    amountIn: params.amountIn,
    quoterAddress: params.quoterAddress,
  });

  const amountOutMinimum = (amountOut * (BPS_BASE - slippageBps)) / BPS_BASE;

  return {
    tokens,
    pools: [...params.pools],
    extensionDatas,
    zeroForOneBitMap,
    amountIn: params.amountIn,
    amountOutMinimum,
    recipient: params.recipient,
    deadline: params.deadline,
  };
}

/** Build multihop exact-output params with live quote and slippage on `amountInMaximum`. */
export async function buildExactOutputParams(
  params: BuildExactOutputParams,
): Promise<ExactOutputParams> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const { tokens, extensionDatas, zeroForOneBitMap } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    params.pools,
    params.extensionDatas,
  );

  const { amountIn } = await quoteLiveExactOut({
    publicClient: params.publicClient,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    pools: params.pools,
    extensionDatas: params.extensionDatas,
    recipient: params.recipient,
    sender: params.sender,
    amountOut: params.amountOut,
    quoterAddress: params.quoterAddress,
  });

  const amountInMaximum = ceilDiv(amountIn * (BPS_BASE + slippageBps), BPS_BASE);

  return {
    tokens,
    pools: [...params.pools],
    extensionDatas,
    zeroForOneBitMap,
    amountOut: params.amountOut,
    amountInMaximum,
    recipient: params.recipient,
    deadline: params.deadline,
  };
}

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
