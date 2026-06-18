/**
 * MetricAMM SDK - SimpleRouter multihop swap helpers.
 */
import type { Address, Hex, PublicClient } from "viem";
import { encodeFunctionData } from "viem";
import { quoteLiveExactIn, quoteLiveExactOut } from "../quoter/quotePath.js";
import { resolveSwapPath } from "../swap/path.js";
import { SIMPLE_ROUTER_ABI } from "../constants.js";
import { ceilDiv, toSlippageBps } from "./swap.js";

const BPS_BASE = 10_000n;

export type ExactInputParams = {
  tokens: Address[];
  pools: Address[];
  extensionDatas: Hex[];
  zeroForOneBitMap: bigint;
  amountIn: bigint;
  amountOutMinimum: bigint;
  recipient: Address;
  deadline: bigint;
};

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

export interface BuildExactInputParams {
  publicClient: PublicClient;
  tokenIn: Address;
  tokenOut: Address;
  pools: readonly Address[];
  extensionDatas?: readonly Hex[];
  recipient: Address;
  amountIn: bigint;
  slippagePercent: number;
  deadline: bigint;
  quoterAddress?: Address;
}

export interface BuildExactOutputParams {
  publicClient: PublicClient;
  tokenIn: Address;
  tokenOut: Address;
  pools: readonly Address[];
  extensionDatas?: readonly Hex[];
  recipient: Address;
  amountOut: bigint;
  slippagePercent: number;
  deadline: bigint;
  quoterAddress?: Address;
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

export function encodeExactInputCalldata(params: ExactInputParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "exactInput",
    args: [toExactInputStruct(params)],
  });
}

export const prepareExactInputCalldata = encodeExactInputCalldata;

export function encodeExactOutputCalldata(params: ExactOutputParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "exactOutput",
    args: [toExactOutputStruct(params)],
  });
}

export const prepareExactOutputCalldata = encodeExactOutputCalldata;

export { encodeZeroForOneBitMap } from "../swap/path.js";
