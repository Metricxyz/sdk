/**
 * MetricAMM SDK - SimpleRouter single-hop swap helpers.
 */

import type { Address, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { defaultPriceLimitX64 } from "../quoter/quotePath.js";
import { quoteLiveExactInSingle, quoteLiveExactOutSingle } from "../quoter/quote.js";
import { resolveSwapPath } from "../swap/path.js";
import { SIMPLE_ROUTER_ABI } from "../constants.js";
import { EMPTY_EXTENSION_DATA } from "../extensions/types.js";
import type { PublicClient } from "viem";

const BPS_BASE = 10_000n;

export type ExactInputSingleParams = {
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  recipient: Address;
  deadline: bigint;
  priceLimitX64: bigint;
  extensionData?: Hex;
};

export type ExactOutputSingleParams = {
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  zeroForOne: boolean;
  amountOut: bigint;
  amountInMaximum: bigint;
  recipient: Address;
  deadline: bigint;
  priceLimitX64: bigint;
  extensionData?: Hex;
};

export interface BuildExactInputSingleParams {
  publicClient: PublicClient;
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  recipient: Address;
  amountIn: bigint;
  slippagePercent: number;
  priceLimitX64?: bigint;
  deadline: bigint;
  extensionData?: Hex;
  quoterAddress?: Address;
}

export interface BuildExactOutputSingleParams {
  publicClient: PublicClient;
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  recipient: Address;
  amountOut: bigint;
  slippagePercent: number;
  priceLimitX64?: bigint;
  deadline: bigint;
  extensionData?: Hex;
  quoterAddress?: Address;
}

export function toSlippageBps(slippagePercent: number): bigint {
  if (!Number.isFinite(slippagePercent) || slippagePercent < 0 || slippagePercent > 100) {
    throw new Error("slippagePercent must be a finite number between 0 and 100");
  }
  return BigInt(Math.round(slippagePercent * 100));
}

export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error("denominator must be > 0");
  }
  return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}

function withExtensionData(extensionData?: Hex): Hex {
  return extensionData ?? EMPTY_EXTENSION_DATA;
}

function toExactInputSingleStruct(params: ExactInputSingleParams) {
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

function toExactOutputSingleStruct(params: ExactOutputSingleParams) {
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

export async function buildExactInputSingleParams(
  params: BuildExactInputSingleParams,
): Promise<ExactInputSingleParams> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const { zeroForOnes } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    [params.pool],
    params.extensionData ? [params.extensionData] : undefined,
  );
  const zeroForOne = zeroForOnes[0]!;
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(zeroForOne);

  const { amountOut } = await quoteLiveExactInSingle({
    publicClient: params.publicClient,
    pool: params.pool,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    recipient: params.recipient,
    amountIn: params.amountIn,
    priceLimitX64,
    extensionData: params.extensionData,
    quoterAddress: params.quoterAddress,
  });

  const amountOutMinimum = (amountOut * (BPS_BASE - slippageBps)) / BPS_BASE;

  return {
    pool: params.pool,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    zeroForOne,
    amountIn: params.amountIn,
    amountOutMinimum,
    recipient: params.recipient,
    deadline: params.deadline,
    priceLimitX64,
    extensionData: params.extensionData,
  };
}

export async function buildExactOutputSingleParams(
  params: BuildExactOutputSingleParams,
): Promise<ExactOutputSingleParams> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const { zeroForOnes } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    [params.pool],
    params.extensionData ? [params.extensionData] : undefined,
  );
  const zeroForOne = zeroForOnes[0]!;
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(zeroForOne);

  const { amountIn } = await quoteLiveExactOutSingle({
    publicClient: params.publicClient,
    pool: params.pool,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    recipient: params.recipient,
    amountOut: params.amountOut,
    priceLimitX64,
    extensionData: params.extensionData,
    quoterAddress: params.quoterAddress,
  });

  const amountInMaximum = ceilDiv(amountIn * (BPS_BASE + slippageBps), BPS_BASE);

  return {
    pool: params.pool,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    zeroForOne,
    amountOut: params.amountOut,
    amountInMaximum,
    recipient: params.recipient,
    deadline: params.deadline,
    priceLimitX64,
    extensionData: params.extensionData,
  };
}

export function encodeExactInputSingleCalldata(params: ExactInputSingleParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [toExactInputSingleStruct(params)],
  });
}

export const prepareExactInputSingleCalldata = encodeExactInputSingleCalldata;

export function encodeExactOutputSingleCalldata(params: ExactOutputSingleParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "exactOutputSingle",
    args: [toExactOutputSingleStruct(params)],
  });
}

export const prepareExactOutputSingleCalldata = encodeExactOutputSingleCalldata;
