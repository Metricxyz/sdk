/**
 * MetricAMM SDK - MetricOmmSwapQuoter single-hop quotes.
 */

import type { Address, PublicClient, Hex } from "viem";
import { resolveZeroForOne } from "../swap/path.js";
import {
  defaultPriceLimitX64,
  resolveQuoterAddress,
  simulateQuote,
  withQuoteExtensionData,
  type QuoteSwapResult,
} from "./quotePath.js";

export interface QuoteLiveExactInSingleParams {
  publicClient: PublicClient;
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  recipient: Address;
  amountIn: bigint;
  priceLimitX64?: bigint;
  extensionData?: Hex;
  quoterAddress?: Address;
}

export interface QuoteLiveExactOutSingleParams {
  publicClient: PublicClient;
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  recipient: Address;
  amountOut: bigint;
  priceLimitX64?: bigint;
  extensionData?: Hex;
  quoterAddress?: Address;
}

export interface QuoteHypotheticalExactInputSingleParams {
  publicClient: PublicClient;
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  recipient: Address;
  amountIn: bigint;
  bidPriceX64: bigint;
  askPriceX64: bigint;
  referencePriceX64: bigint;
  priceLimitX64?: bigint;
  extensionData?: Hex;
  quoterAddress?: Address;
}

export interface QuoteHypotheticalExactOutputSingleParams {
  publicClient: PublicClient;
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  recipient: Address;
  amountOut: bigint;
  bidPriceX64: bigint;
  askPriceX64: bigint;
  referencePriceX64: bigint;
  priceLimitX64?: bigint;
  extensionData?: Hex;
  quoterAddress?: Address;
}

export async function quoteLiveExactInSingle(
  params: QuoteLiveExactInSingleParams,
): Promise<QuoteSwapResult> {
  const zeroForOne = await resolveZeroForOne(
    params.publicClient,
    params.pool,
    params.tokenIn,
    params.tokenOut,
  );
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(zeroForOne);
  const quoterAddress = await resolveQuoterAddress({
    publicClient: params.publicClient,
    quoterAddress: params.quoterAddress,
  });

  return simulateQuote(
    params.publicClient,
    quoterAddress,
    params.recipient,
    "quoteLiveExactInSingle",
    [
      params.pool,
      params.recipient,
      zeroForOne,
      params.amountIn,
      priceLimitX64,
      withQuoteExtensionData(params.extensionData),
    ],
  );
}

export async function quoteLiveExactOutSingle(
  params: QuoteLiveExactOutSingleParams,
): Promise<QuoteSwapResult> {
  const zeroForOne = await resolveZeroForOne(
    params.publicClient,
    params.pool,
    params.tokenIn,
    params.tokenOut,
  );
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(zeroForOne);
  const quoterAddress = await resolveQuoterAddress({
    publicClient: params.publicClient,
    quoterAddress: params.quoterAddress,
  });

  return simulateQuote(
    params.publicClient,
    quoterAddress,
    params.recipient,
    "quoteLiveExactOutSingle",
    [
      params.pool,
      params.recipient,
      zeroForOne,
      params.amountOut,
      priceLimitX64,
      withQuoteExtensionData(params.extensionData),
    ],
  );
}

export async function quoteHypotheticalExactInputSingle(
  params: QuoteHypotheticalExactInputSingleParams,
): Promise<QuoteSwapResult> {
  const zeroForOne = await resolveZeroForOne(
    params.publicClient,
    params.pool,
    params.tokenIn,
    params.tokenOut,
  );
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(zeroForOne);
  const quoterAddress = await resolveQuoterAddress({
    publicClient: params.publicClient,
    quoterAddress: params.quoterAddress,
  });

  return simulateQuote(
    params.publicClient,
    quoterAddress,
    params.recipient,
    "quoteHypotheticalExactInputSingle",
    [
      params.pool,
      params.recipient,
      zeroForOne,
      params.amountIn,
      priceLimitX64,
      params.bidPriceX64,
      params.askPriceX64,
      params.referencePriceX64,
      withQuoteExtensionData(params.extensionData),
    ],
  );
}

export async function quoteHypotheticalExactOutputSingle(
  params: QuoteHypotheticalExactOutputSingleParams,
): Promise<QuoteSwapResult> {
  const zeroForOne = await resolveZeroForOne(
    params.publicClient,
    params.pool,
    params.tokenIn,
    params.tokenOut,
  );
  const priceLimitX64 = params.priceLimitX64 ?? defaultPriceLimitX64(zeroForOne);
  const quoterAddress = await resolveQuoterAddress({
    publicClient: params.publicClient,
    quoterAddress: params.quoterAddress,
  });

  return simulateQuote(
    params.publicClient,
    quoterAddress,
    params.recipient,
    "quoteHypotheticalExactOutputSingle",
    [
      params.pool,
      params.recipient,
      zeroForOne,
      params.amountOut,
      priceLimitX64,
      params.bidPriceX64,
      params.askPriceX64,
      params.referencePriceX64,
      withQuoteExtensionData(params.extensionData),
    ],
  );
}
