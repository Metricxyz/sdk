/**
 * SimpleRouter single-hop swap helpers.
 *
 * Typical ERC-20 flow:
 * 1. `buildExactInputSingleParams` / `buildExactOutputSingleParams` — quote + slippage
 * 2. `encodeExactInputSingleCalldata` — calldata for `walletClient.writeContract` or `sendTransaction`
 * 3. Approve `tokenIn` on the SimpleRouter before sending (not needed for native ETH; see `nativeSwap.ts`)
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

/**
 * Arguments for `MetricOmmSimpleRouter.exactInputSingle`.
 * Pass to `encodeExactInputSingleCalldata` or native prepare helpers when `tokenIn` is WETH.
 */
export type ExactInputSingleParams = {
  /** Pool to swap through. */
  pool: Address;
  /** Input token (`addresses.wrappedNative` when swapping from native ETH). */
  tokenIn: Address;
  /** Output token (`addresses.wrappedNative` when unwrapping to ETH in a follow-up call). */
  tokenOut: Address;
  /** `true` when swapping token0 → token1 for this pool. */
  zeroForOne: boolean;
  /** Exact input amount in `tokenIn` native decimals. */
  amountIn: bigint;
  /** Minimum acceptable output; reverts if less is received. */
  amountOutMinimum: bigint;
  /** Address that receives output tokens. */
  recipient: Address;
  /** Unix timestamp after which the swap reverts. */
  deadline: bigint;
  /** Q64.64 price bound; use `0` / `MAX_UINT128` defaults from builders when unsure. */
  priceLimitX64: bigint;
  /** Per-pool extension calldata; omit for pools without extensions. */
  extensionData?: Hex;
};

/**
 * Arguments for `MetricOmmSimpleRouter.exactOutputSingle`.
 */
export type ExactOutputSingleParams = {
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  zeroForOne: boolean;
  /** Exact output amount in `tokenOut` native decimals. */
  amountOut: bigint;
  /** Maximum input willing to spend (slippage cap). */
  amountInMaximum: bigint;
  recipient: Address;
  deadline: bigint;
  priceLimitX64: bigint;
  extensionData?: Hex;
};

/**
 * Inputs for {@link buildExactInputSingleParams}.
 * Quotes live on-chain via the SwapQuoter and applies `slippagePercent` to derive `amountOutMinimum`.
 */
export interface BuildExactInputSingleParams {
  publicClient: PublicClient;
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  recipient: Address;
  /** Input amount in `tokenIn` decimals (wei for ETH / WETH). */
  amountIn: bigint;
  /** Human-readable slippage tolerance, e.g. `0.5` = 0.5%. */
  slippagePercent: number;
  /** Optional price bound; defaults from quoter direction when omitted. */
  priceLimitX64?: bigint;
  deadline: bigint;
  extensionData?: Hex;
  /** Override when `addresses.quoter` is unset. */
  quoterAddress?: Address;
  /** `addresses.wrappedNative` — required when `tokenIn` or `tokenOut` is native (zero address). */
  wrappedNative?: Address;
}

/** Inputs for {@link buildExactOutputSingleParams}. */
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
  wrappedNative?: Address;
}

/**
 * Convert a human slippage percent to basis points (1 bp = 0.01%).
 * @example toSlippageBps(0.5) // 50n
 */
export function toSlippageBps(slippagePercent: number): bigint {
  if (!Number.isFinite(slippagePercent) || slippagePercent < 0 || slippagePercent > 100) {
    throw new Error("slippagePercent must be a finite number between 0 and 100");
  }
  return BigInt(Math.round(slippagePercent * 100));
}

/** Ceiling division for bigint values. Used when rounding slippage up on exact-output swaps. */
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

/**
 * Build single-hop exact-input swap params with live quote and slippage.
 *
 * Resolves `zeroForOne`, quotes `amountOut`, and sets `amountOutMinimum`.
 * For native ETH input, use `prepareExactInputSingleSupportingNativePaymentCalldata` and set `msg.value` on the transaction.
 * (params will contain WETH as `tokenIn`).
 *
 * @example
 * ```ts
 * const params = await buildExactInputSingleParams({
 *   publicClient,
 *   pool,
 *   tokenIn: usdc,
 *   tokenOut: weth,
 *   recipient: account,
 *   amountIn: parseUnits("100", 6),
 *   slippagePercent: 0.5,
 *   deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
 *   quoterAddress: addresses.quoter,
 * });
 * await walletClient.writeContract({
 *   address: addresses.simpleRouter,
 *   abi: MetricOmmSimpleRouterAbi,
 *   functionName: "exactInputSingle",
 *   args: [params],
 *   account,
 * });
 * ```
 */
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

/**
 * Build single-hop exact-output swap params with live quote and slippage.
 * Sets `amountInMaximum` from quoted input plus `slippagePercent`.
 */
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

/**
 * Encode `exactInputSingle` calldata for `addresses.simpleRouter`.
 * Approve `tokenIn` on the router before sending (unless using native ETH prepare helpers).
 */
export function encodeExactInputSingleCalldata(params: ExactInputSingleParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [toExactInputSingleStruct(params)],
  });
}

/** Alias for {@link encodeExactInputSingleCalldata}. */
export const prepareExactInputSingleCalldata = encodeExactInputSingleCalldata;

/** Encode `exactOutputSingle` calldata for `addresses.simpleRouter`. */
export function encodeExactOutputSingleCalldata(params: ExactOutputSingleParams): Hex {
  return encodeFunctionData({
    abi: SIMPLE_ROUTER_ABI,
    functionName: "exactOutputSingle",
    args: [toExactOutputSingleStruct(params)],
  });
}

/** Alias for {@link encodeExactOutputSingleCalldata}. */
export const prepareExactOutputSingleCalldata = encodeExactOutputSingleCalldata;
