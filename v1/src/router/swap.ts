/**
 * MetricAMM SDK - Swapper (v1 periphery) helpers for building and encoding swaps.
 */

import type { Address, PublicClient, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { MAX_UINT128, POOL_FACTORY_ABI, SWAPPER_ABI } from "../constants.js";
import { PriceProviderUiAbi } from "../abis/PriceProviderUi.js";

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

export interface BuildSwapPrices {
  bidPriceX64: bigint;
  askPriceX64: bigint;
}

/** Shared fields for swap builders that may auto-fetch bid/ask from the pool's price provider. */
export interface BuildSwapWithFactoryParams {
  publicClient: PublicClient;
  /** Factory that deployed the pool (required when `prices` is omitted). */
  factoryAddress?: Address;
  pool: Address;
  prices?: BuildSwapPrices;
}

export interface BuildSwapExactInputParams extends BuildSwapWithFactoryParams {
  swapperAddress: Address;
  recipient: Address;
  zeroForOne: boolean;
  amountIn: bigint;
  slippagePercent: number;
  priceLimitX64?: bigint;
  deadline: bigint;
}

export interface BuildSwapExactOutputParams extends BuildSwapWithFactoryParams {
  swapperAddress: Address;
  recipient: Address;
  zeroForOne: boolean;
  amountOut: bigint;
  slippagePercent: number;
  priceLimitX64?: bigint;
  deadline: bigint;
}

export type QuoteExpectedAmountsForSwapExactInputParams = Omit<
  BuildSwapExactInputParams,
  "recipient" | "deadline"
>;

export type QuoteExpectedAmountsForSwapExactOutputParams = Omit<
  BuildSwapExactOutputParams,
  "recipient" | "deadline"
>;

function toSlippageBps(slippagePercent: number): bigint {
  if (!Number.isFinite(slippagePercent) || slippagePercent < 0 || slippagePercent > 100) {
    throw new Error("slippagePercent must be a finite number between 0 and 100");
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

async function readBidAskFromFactoryPriceProvider(
  publicClient: PublicClient,
  factoryAddress: Address,
  poolAddress: Address,
): Promise<{ bidPriceX64: bigint; askPriceX64: bigint }> {
  const imm = (await publicClient.readContract({
    address: factoryAddress,
    abi: POOL_FACTORY_ABI,
    functionName: "poolImmutables",
    args: [poolAddress],
  })) as { immutablePriceProvider: Address };

  const priceProviderAddress = imm.immutablePriceProvider;
  if (
    !priceProviderAddress ||
    priceProviderAddress === "0x0000000000000000000000000000000000000000"
  ) {
    throw new Error(`pool ${poolAddress} has no immutable price provider (factory.poolImmutables)`);
  }

  const [bidPriceX64, askPriceX64] = (await publicClient.readContract({
    address: priceProviderAddress,
    abi: PriceProviderUiAbi,
    functionName: "getBidAndAskPriceUi",
  })) as [bigint, bigint];

  return { bidPriceX64, askPriceX64 };
}

async function resolveBidAskPrices(params: {
  publicClient: PublicClient;
  factoryAddress?: Address;
  pool: Address;
  prices?: BuildSwapPrices;
}): Promise<{ bidPriceX64: bigint; askPriceX64: bigint }> {
  if (params.prices) {
    return params.prices;
  }

  if (!params.factoryAddress) {
    throw new Error(
      "factoryAddress is required when prices are omitted (v1 reads poolImmutables from the factory, not the pool)",
    );
  }

  return readBidAskFromFactoryPriceProvider(
    params.publicClient,
    params.factoryAddress,
    params.pool,
  );
}

export async function buildArgsForSwapExactInput(
  params: BuildSwapExactInputParams,
): Promise<SwapExactInputArgs> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);

  const { bidPriceX64, askPriceX64 } = await resolveBidAskPrices(params);

  const {
    result: [amount0Delta, amount1Delta],
  } = (await params.publicClient.simulateContract({
    address: params.swapperAddress,
    abi: SWAPPER_ABI,
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
  })) as unknown as { result: [bigint, bigint] };

  const amountSwapWillResultIn = params.zeroForOne
    ? absBigInt(amount1Delta)
    : absBigInt(amount0Delta);

  const minAmountOut = (amountSwapWillResultIn * (BPS_BASE - slippageBps)) / BPS_BASE;

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
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);

  const { bidPriceX64, askPriceX64 } = await resolveBidAskPrices(params);

  const {
    result: [amount0Delta, amount1Delta],
  } = (await params.publicClient.simulateContract({
    address: params.swapperAddress,
    abi: SWAPPER_ABI,
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
  })) as unknown as { result: [bigint, bigint] };

  const expectedOutput = params.zeroForOne ? absBigInt(amount1Delta) : absBigInt(amount0Delta);

  const expectedInput = params.zeroForOne ? absBigInt(amount0Delta) : absBigInt(amount1Delta);

  const minAmountOut = (expectedOutput * (BPS_BASE - slippageBps)) / BPS_BASE;

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

export type QuoteSwapParams = BuildSwapWithFactoryParams & {
  swapperAddress: Address;
  zeroForOne: boolean;
  amountSpecified: bigint;
  priceLimitX64?: bigint;
};

export type QuoteSwapResult = {
  amount0Delta: bigint;
  amount1Delta: bigint;
  amountIn: bigint;
  amountOut: bigint;
};

export async function quoteSwap(params: QuoteSwapParams): Promise<QuoteSwapResult> {
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);
  const { bidPriceX64, askPriceX64 } = await resolveBidAskPrices(params);

  const [amount0Delta, amount1Delta] = (await params.publicClient.readContract({
    address: params.swapperAddress,
    abi: SWAPPER_ABI,
    functionName: "quoteSwap",
    args: [
      params.pool,
      params.zeroForOne,
      params.amountSpecified,
      priceLimitX64,
      bidPriceX64,
      askPriceX64,
    ],
  })) as [bigint, bigint];

  const amountIn = params.zeroForOne ? absBigInt(amount0Delta) : absBigInt(amount1Delta);
  const amountOut = params.zeroForOne ? absBigInt(amount1Delta) : absBigInt(amount0Delta);

  return { amount0Delta, amount1Delta, amountIn, amountOut };
}

export async function quoteExpectedAmountsForSwapExactInput(
  params: QuoteExpectedAmountsForSwapExactInputParams,
): Promise<{ expectedInput: bigint; expectedOutput: bigint }> {
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);

  const { bidPriceX64, askPriceX64 } = await resolveBidAskPrices(params);

  const [amount0Delta, amount1Delta] = (await params.publicClient.readContract({
    address: params.swapperAddress,
    abi: SWAPPER_ABI,
    functionName: "quoteSwap",
    args: [
      params.pool,
      params.zeroForOne,
      params.amountIn,
      priceLimitX64,
      bidPriceX64,
      askPriceX64,
    ],
  })) as [bigint, bigint];

  const expectedOutput = params.zeroForOne ? absBigInt(amount1Delta) : absBigInt(amount0Delta);

  const expectedInput = params.zeroForOne ? absBigInt(amount0Delta) : absBigInt(amount1Delta);

  return { expectedInput, expectedOutput };
}

export async function buildArgsForSwapExactOutput(
  params: BuildSwapExactOutputParams,
): Promise<SwapExactOutputArgs> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);

  const { bidPriceX64, askPriceX64 } = await resolveBidAskPrices(params);

  const {
    result: [amount0Delta, amount1Delta],
  } = (await params.publicClient.simulateContract({
    address: params.swapperAddress,
    abi: SWAPPER_ABI,
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
  })) as unknown as { result: [bigint, bigint] };

  const quotedAmountIn = params.zeroForOne ? absBigInt(amount0Delta) : absBigInt(amount1Delta);

  const maxAmountIn = ceilDiv(quotedAmountIn * (BPS_BASE + slippageBps), BPS_BASE);

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

export async function buildArgsAndExpectedAmountsForSwapExactOutput(
  params: BuildSwapExactOutputParams,
): Promise<{
  args: SwapExactOutputArgs;
  expectedInput: bigint;
  expectedOutput: bigint;
}> {
  const slippageBps = toSlippageBps(params.slippagePercent);
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);

  const { bidPriceX64, askPriceX64 } = await resolveBidAskPrices(params);

  const {
    result: [amount0Delta, amount1Delta],
  } = (await params.publicClient.simulateContract({
    address: params.swapperAddress,
    abi: SWAPPER_ABI,
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
  })) as unknown as { result: [bigint, bigint] };

  const expectedInput = params.zeroForOne ? absBigInt(amount0Delta) : absBigInt(amount1Delta);

  const expectedOutput = params.zeroForOne ? absBigInt(amount1Delta) : absBigInt(amount0Delta);

  const maxAmountIn = ceilDiv(expectedInput * (BPS_BASE + slippageBps), BPS_BASE);

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

export async function quoteExpectedAmountsForSwapExactOutput(
  params: QuoteExpectedAmountsForSwapExactOutputParams,
): Promise<{ expectedInput: bigint; expectedOutput: bigint }> {
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(params.zeroForOne);

  const { bidPriceX64, askPriceX64 } = await resolveBidAskPrices(params);

  const [amount0Delta, amount1Delta] = (await params.publicClient.readContract({
    address: params.swapperAddress,
    abi: SWAPPER_ABI,
    functionName: "quoteSwap",
    args: [
      params.pool,
      params.zeroForOne,
      -params.amountOut,
      priceLimitX64,
      bidPriceX64,
      askPriceX64,
    ],
  })) as [bigint, bigint];

  const expectedInput = params.zeroForOne ? absBigInt(amount0Delta) : absBigInt(amount1Delta);

  const expectedOutput = params.zeroForOne ? absBigInt(amount1Delta) : absBigInt(amount0Delta);

  return { expectedInput, expectedOutput };
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
    abi: SWAPPER_ABI,
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
    abi: SWAPPER_ABI,
    functionName: "swapExactOutput",
    args,
  });
}

export const prepareSwapExactOutputCalldata = encodeSwapExactOutputCalldata;

export function encodeSwapExactInputNativeForTokensCalldata(
  params: SwapExactInputParams,
): PreparedSwapTransaction {
  const data = encodeFunctionData({
    abi: SWAPPER_ABI,
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
