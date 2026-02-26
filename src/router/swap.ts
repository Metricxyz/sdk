/**
 * MetricAMM SDK - Swap Router Functions
 * Functions for building, encoding and sending swaps.
 */

import type { Address, PublicClient, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { MAX_UINT128, POOL_ABI, SWAP_ROUTER_ABI } from "../constants.js";
import { PriceProviderAbi } from "../abis/PriceProvider.js";

const BPS_BASE = 10_000n;
export interface PreparedSwapTransaction {
  data: Hex;
  value?: bigint;
}

export type SwapExactInputArgs = readonly [
  Address,
  Address,
  boolean,
  bigint,
  bigint,
  bigint,
  bigint,
];

export type SwapExactInputParams = {
  pool: Address;
  recipient: Address;
  zeroForOne: boolean;
  amountIn: bigint;
  priceLimitX64: bigint;
  minAmountOut: bigint;
  deadline: bigint;
};

export type SwapExactOutputArgs = readonly [
  Address,
  Address,
  boolean,
  bigint,
  bigint,
  bigint,
  bigint,
];

export type SwapExactOutputParams = {
  pool: Address;
  recipient: Address;
  zeroForOne: boolean;
  amountOut: bigint;
  priceLimitX64: bigint;
  maxAmountIn: bigint;
  deadline: bigint;
};

export interface BuildSwapExactInputParams {
  publicClient: PublicClient;
  routerAddress: Address;
  pool: Address;
  recipient: Address;
  zeroForOne: boolean;
  amountIn: bigint;
  slippagePercent: number;
  priceLimitX64?: bigint;
  deadline: bigint;
}

export interface BuildSwapExactOutputParams {
  publicClient: PublicClient;
  routerAddress: Address;
  pool: Address;
  recipient: Address;
  zeroForOne: boolean;
  amountOut: bigint;
  slippagePercent: number;
  priceLimitX64?: bigint;
  deadline: bigint;
}

function toSlippageBps(slippagePercent: number): bigint {
  if (!Number.isFinite(slippagePercent) || slippagePercent < 0) {
    throw new Error("slippagePercent must be a non-negative finite number");
  }
  return BigInt(Math.round(slippagePercent * 100));
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error("denominator must be > 0");
  }
  return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}

function defaultPriceLimitX64(zeroForOne: boolean): bigint {
  return zeroForOne ? 0n : MAX_UINT128;
}

async function readBidAskFromPoolPriceProvider(
  publicClient: PublicClient,
  poolAddress: Address,
): Promise<{ bidPriceX64: bigint; askPriceX64: bigint }> {
  const immutables = (await publicClient.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "getImmutables",
  })) as readonly unknown[];

  const priceProviderAddress = immutables[1] as Address;

  const [bidPriceX64, askPriceX64] = (await publicClient.readContract({
    address: priceProviderAddress,
    abi: PriceProviderAbi,
    functionName: "getBidAndAskPrice",
  })) as [bigint, bigint];

  return { bidPriceX64, askPriceX64 };
}

export async function buildArgsForSwapExactInput(
  params: BuildSwapExactInputParams,
): Promise<SwapExactInputArgs> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const priceLimitX64 =
    params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);

  const { bidPriceX64, askPriceX64 } = await readBidAskFromPoolPriceProvider(
    params.publicClient,
    params.pool,
  );

  const [amount0Delta, amount1Delta] =
    (await params.publicClient.simulateContract({
      address: params.routerAddress,
      abi: SWAP_ROUTER_ABI,
      functionName: "quoteSwap",
      args: [
        params.pool,
        params.zeroForOne,
        params.amountIn,
        priceLimitX64,
        bidPriceX64,
        askPriceX64,
      ],
      account: params.recipient,
    })) as unknown as [bigint, bigint];

  const amountSwapWillResultIn = params.zeroForOne
    ? absBigInt(amount1Delta)
    : absBigInt(amount0Delta);

  const minAmountOut =
    amountSwapWillResultIn * BPS_BASE * (BPS_BASE - slippageBps);

  return [
    params.pool,
    params.recipient,
    params.zeroForOne,
    params.amountIn,
    priceLimitX64,
    minAmountOut,
    params.deadline,
  ];
}

export async function buildArgsAndExpectedAmountsForSwapExactInput(
  params: BuildSwapExactInputParams,
): Promise<{
  args: SwapExactInputArgs;
  expectedInput: bigint;
  expectedOutput: bigint;
}> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const priceLimitX64 =
    params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);

  const { bidPriceX64, askPriceX64 } = await readBidAskFromPoolPriceProvider(
    params.publicClient,
    params.pool,
  );

  const [amount0Delta, amount1Delta] =
    (await params.publicClient.simulateContract({
      address: params.routerAddress,
      abi: SWAP_ROUTER_ABI,
      functionName: "quoteSwap",
      args: [
        params.pool,
        params.zeroForOne,
        params.amountIn,
        priceLimitX64,
        bidPriceX64,
        askPriceX64,
      ],
      account: params.recipient,
    })) as unknown as [bigint, bigint];

  const expectedOutput = params.zeroForOne
    ? absBigInt(amount1Delta)
    : absBigInt(amount0Delta);

  const expectedInput = params.zeroForOne
    ? absBigInt(amount0Delta)
    : absBigInt(amount1Delta);

  const minAmountOut = expectedOutput * BPS_BASE * (BPS_BASE - slippageBps);

  const args: SwapExactInputArgs = [
    params.pool,
    params.recipient,
    params.zeroForOne,
    params.amountIn,
    priceLimitX64,
    minAmountOut,
    params.deadline,
  ];

  return {
    args,
    expectedInput,
    expectedOutput,
  };
}

export async function buildArgsForSwapExactOutput(
  params: BuildSwapExactOutputParams,
): Promise<SwapExactOutputArgs> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const priceLimitX64 =
    params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);

  const { bidPriceX64, askPriceX64 } = await readBidAskFromPoolPriceProvider(
    params.publicClient,
    params.pool,
  );

  const [amount0Delta, amount1Delta] =
    (await params.publicClient.simulateContract({
      address: params.routerAddress,
      abi: SWAP_ROUTER_ABI,
      functionName: "quoteSwap",
      args: [
        params.pool,
        params.zeroForOne,
        -params.amountOut,
        priceLimitX64,
        bidPriceX64,
        askPriceX64,
      ],
      account: params.recipient,
    })) as unknown as [bigint, bigint];

  const quotedAmountIn = params.zeroForOne
    ? absBigInt(amount0Delta)
    : absBigInt(amount1Delta);

  const maxAmountIn = ceilDiv(
    quotedAmountIn * (BPS_BASE + slippageBps),
    BPS_BASE,
  );

  return [
    params.pool,
    params.recipient,
    params.zeroForOne,
    params.amountOut,
    priceLimitX64,
    maxAmountIn,
    params.deadline,
  ];
}

export async function buildArgsExpectedAmountsForSwapExactOutput(
  params: BuildSwapExactOutputParams,
): Promise<{
  args: SwapExactOutputArgs;
  expectedInput: bigint;
  expectedOutput: bigint;
}> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const priceLimitX64 =
    params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);

  const { bidPriceX64, askPriceX64 } = await readBidAskFromPoolPriceProvider(
    params.publicClient,
    params.pool,
  );

  const [amount0Delta, amount1Delta] =
    (await params.publicClient.simulateContract({
      address: params.routerAddress,
      abi: SWAP_ROUTER_ABI,
      functionName: "quoteSwap",
      args: [
        params.pool,
        params.zeroForOne,
        -params.amountOut,
        priceLimitX64,
        bidPriceX64,
        askPriceX64,
      ],
      account: params.recipient,
    })) as unknown as [bigint, bigint];

  const expectedInput = params.zeroForOne
    ? absBigInt(amount0Delta)
    : absBigInt(amount1Delta);

  const expectedOutput = params.zeroForOne
    ? absBigInt(amount1Delta)
    : absBigInt(amount0Delta);

  const maxAmountIn = ceilDiv(
    expectedInput * (BPS_BASE + slippageBps),
    BPS_BASE,
  );

  const args: SwapExactOutputArgs = [
    params.pool,
    params.recipient,
    params.zeroForOne,
    params.amountOut,
    priceLimitX64,
    maxAmountIn,
    params.deadline,
  ];

  return {
    args,
    expectedInput,
    expectedOutput,
  };
}

export function encodeSwapExactInputCalldata(
  argsOrParams: SwapExactInputArgs | SwapExactInputParams,
): `0x${string}` {
  const args = Array.isArray(argsOrParams)
    ? argsOrParams
    : ([
        (argsOrParams as SwapExactInputParams).pool,
        (argsOrParams as SwapExactInputParams).recipient,
        (argsOrParams as SwapExactInputParams).zeroForOne,
        (argsOrParams as SwapExactInputParams).amountIn,
        (argsOrParams as SwapExactInputParams).priceLimitX64,
        (argsOrParams as SwapExactInputParams).minAmountOut,
        (argsOrParams as SwapExactInputParams).deadline,
      ] as const);

  return encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "swapExactInput",
    args,
  });
}

export const prepareSwapExactInputCalldata = encodeSwapExactInputCalldata;

export function encodeSwapExactOutputCalldata(
  argsOrParams: SwapExactOutputArgs | SwapExactOutputParams,
): `0x${string}` {
  const args = Array.isArray(argsOrParams)
    ? argsOrParams
    : ([
        (argsOrParams as SwapExactOutputParams).pool,
        (argsOrParams as SwapExactOutputParams).recipient,
        (argsOrParams as SwapExactOutputParams).zeroForOne,
        (argsOrParams as SwapExactOutputParams).amountOut,
        (argsOrParams as SwapExactOutputParams).priceLimitX64,
        (argsOrParams as SwapExactOutputParams).maxAmountIn,
        (argsOrParams as SwapExactOutputParams).deadline,
      ] as const);

  return encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "swapExactOutput",
    args,
  });
}

export const prepareSwapExactOutputCalldata = encodeSwapExactOutputCalldata;

export function encodeSwapExactInputNativeForTokensCalldata(
  params: SwapExactInputParams,
): PreparedSwapTransaction {
  const data = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "swapExactInputNativeForTokens",
    args: [
      params.pool,
      params.recipient,
      params.zeroForOne,
      params.amountIn,
      params.priceLimitX64,
      params.minAmountOut,
      params.deadline,
    ],
  });

  return {
    data,
    value: params.amountIn,
  };
}

export const prepareSwapExactInputNativeForTokensCalldata =
  encodeSwapExactInputNativeForTokensCalldata;
