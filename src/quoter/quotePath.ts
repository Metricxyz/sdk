/**
 * MetricAMM SDK - MetricOmmSwapQuoter multihop quotes and shared helpers.
 */

import type { Address, PublicClient, Hex } from "viem";
import { getAddressesOrThrow } from "../addresses.js";
import { MAX_UINT128, QUOTER_ABI } from "../constants.js";
import { EMPTY_EXTENSION_DATA } from "../extensions/types.js";
import { resolveSwapPath } from "../swap/path.js";

export type QuoteSwapResult = {
  amountIn: bigint;
  amountOut: bigint;
};

export interface QuoteLiveExactInParams {
  publicClient: PublicClient;
  tokenIn: Address;
  tokenOut: Address;
  pools: readonly Address[];
  extensionDatas?: readonly Hex[];
  recipient: Address;
  amountIn: bigint;
  quoterAddress?: Address;
}

export interface QuoteLiveExactOutParams {
  publicClient: PublicClient;
  tokenIn: Address;
  tokenOut: Address;
  pools: readonly Address[];
  extensionDatas?: readonly Hex[];
  recipient: Address;
  amountOut: bigint;
  quoterAddress?: Address;
}

export interface QuoteHypotheticalExactInputParams {
  publicClient: PublicClient;
  tokenIn: Address;
  tokenOut: Address;
  pools: readonly Address[];
  extensionDatas?: readonly Hex[];
  bidPricesX64: readonly bigint[];
  askPricesX64: readonly bigint[];
  recipient: Address;
  amountIn: bigint;
  quoterAddress?: Address;
}

export interface QuoteHypotheticalExactOutputParams {
  publicClient: PublicClient;
  tokenIn: Address;
  tokenOut: Address;
  pools: readonly Address[];
  extensionDatas?: readonly Hex[];
  bidPricesX64: readonly bigint[];
  askPricesX64: readonly bigint[];
  recipient: Address;
  amountOut: bigint;
  quoterAddress?: Address;
}

export async function resolveQuoterAddress(params: {
  publicClient?: PublicClient;
  quoterAddress?: Address;
}): Promise<Address> {
  if (params.quoterAddress) return params.quoterAddress;
  if (!params.publicClient) {
    throw new Error("Either publicClient or quoterAddress must be provided");
  }
  const chainId = params.publicClient.chain?.id ?? (await params.publicClient.getChainId());
  const addresses = getAddressesOrThrow(chainId);
  if (addresses.quoter === "0x0000000000000000000000000000000000000000" || !addresses.quoter) {
    throw new Error(
      `Chain ${chainId} has no default quoter address. Pass a quoterAddress to override.`,
    );
  }
  return addresses.quoter;
}

export function defaultPriceLimitX64(zeroForOne: boolean): bigint {
  return zeroForOne ? 0n : MAX_UINT128;
}

export function withQuoteExtensionData(extensionData?: Hex): Hex {
  return extensionData ?? EMPTY_EXTENSION_DATA;
}

export function validateHypotheticalPrices(
  pools: readonly Address[],
  bidPricesX64: readonly bigint[],
  askPricesX64: readonly bigint[],
): void {
  if (bidPricesX64.length !== pools.length || askPricesX64.length !== pools.length) {
    throw new Error("bidPricesX64 and askPricesX64 length must match pools length");
  }
}

export async function simulateQuote(
  publicClient: PublicClient,
  quoterAddress: Address,
  recipient: Address,
  functionName:
    | "quoteLiveExactInSingle"
    | "quoteLiveExactOutSingle"
    | "quoteLiveExactIn"
    | "quoteLiveExactOut"
    | "quoteHypotheticalExactInputSingle"
    | "quoteHypotheticalExactOutputSingle"
    | "quoteHypotheticalExactInput"
    | "quoteHypotheticalExactOutput",
  args: readonly unknown[],
): Promise<QuoteSwapResult> {
  const {
    result: [amountIn, amountOut],
  } = (await publicClient.simulateContract({
    address: quoterAddress,
    abi: QUOTER_ABI,
    functionName,
    args,
    account: recipient,
  })) as unknown as { result: [bigint, bigint] };

  return { amountIn, amountOut };
}

export async function quoteLiveExactIn(params: QuoteLiveExactInParams): Promise<QuoteSwapResult> {
  const quoterAddress = await resolveQuoterAddress({
    publicClient: params.publicClient,
    quoterAddress: params.quoterAddress,
  });
  const { extensionDatas, zeroForOneBitMap } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    params.pools,
    params.extensionDatas,
  );

  return simulateQuote(params.publicClient, quoterAddress, params.recipient, "quoteLiveExactIn", [
    {
      pools: [...params.pools],
      extensionDatas,
      zeroForOneBitMap,
      amountIn: params.amountIn,
    },
  ]);
}

export async function quoteLiveExactOut(params: QuoteLiveExactOutParams): Promise<QuoteSwapResult> {
  const quoterAddress = await resolveQuoterAddress({
    publicClient: params.publicClient,
    quoterAddress: params.quoterAddress,
  });
  const { extensionDatas, zeroForOneBitMap } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    params.pools,
    params.extensionDatas,
  );

  return simulateQuote(params.publicClient, quoterAddress, params.recipient, "quoteLiveExactOut", [
    {
      pools: [...params.pools],
      extensionDatas,
      zeroForOneBitMap,
      amountOut: params.amountOut,
    },
  ]);
}

export async function quoteHypotheticalExactInput(
  params: QuoteHypotheticalExactInputParams,
): Promise<QuoteSwapResult> {
  validateHypotheticalPrices(params.pools, params.bidPricesX64, params.askPricesX64);
  const quoterAddress = await resolveQuoterAddress({
    publicClient: params.publicClient,
    quoterAddress: params.quoterAddress,
  });
  const { extensionDatas, zeroForOneBitMap } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    params.pools,
    params.extensionDatas,
  );

  return simulateQuote(
    params.publicClient,
    quoterAddress,
    params.recipient,
    "quoteHypotheticalExactInput",
    [
      {
        pools: [...params.pools],
        extensionDatas,
        zeroForOneBitMap,
        amountIn: params.amountIn,
        bidPricesX64: [...params.bidPricesX64],
        askPricesX64: [...params.askPricesX64],
      },
    ],
  );
}

export async function quoteHypotheticalExactOutput(
  params: QuoteHypotheticalExactOutputParams,
): Promise<QuoteSwapResult> {
  validateHypotheticalPrices(params.pools, params.bidPricesX64, params.askPricesX64);
  const quoterAddress = await resolveQuoterAddress({
    publicClient: params.publicClient,
    quoterAddress: params.quoterAddress,
  });
  const { extensionDatas, zeroForOneBitMap } = await resolveSwapPath(
    params.publicClient,
    params.tokenIn,
    params.tokenOut,
    params.pools,
    params.extensionDatas,
  );

  return simulateQuote(
    params.publicClient,
    quoterAddress,
    params.recipient,
    "quoteHypotheticalExactOutput",
    [
      {
        pools: [...params.pools],
        extensionDatas,
        zeroForOneBitMap,
        amountOut: params.amountOut,
        bidPricesX64: [...params.bidPricesX64],
        askPricesX64: [...params.askPricesX64],
      },
    ],
  );
}
