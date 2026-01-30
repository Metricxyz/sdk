/**
 * MetricAMM SDK - Swap Router Functions
 * Functions for executing swaps
 */

import type { Address, PublicClient, WalletClient, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { SWAP_ROUTER_ABI } from "../constants.js";
import type { SwapExactInputParams, SwapExactOutputParams } from "../types.js";

/**
 * Prepared transaction data for swap operations
 */
export interface PreparedSwapTransaction {
  /** Target router address */
  to: Address;
  /** Encoded calldata */
  data: Hex;
  /** Value to send (for native ETH swaps) */
  value?: bigint;
}

/**
 * Prepare swapExactInput transaction calldata without sending.
 *
 * @param routerAddress - Router contract address
 * @param params - Swap parameters
 * @returns Prepared transaction data with calldata
 */
export function prepareSwapExactInputCalldata(
  routerAddress: Address,
  params: SwapExactInputParams,
): PreparedSwapTransaction {
  const data = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "swapExactInput",
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
    to: routerAddress,
    data,
  };
}

/**
 * Prepare swapExactOutput transaction calldata without sending.
 *
 * @param routerAddress - Router contract address
 * @param params - Swap parameters
 * @returns Prepared transaction data with calldata
 */
export function prepareSwapExactOutputCalldata(
  routerAddress: Address,
  params: SwapExactOutputParams,
): PreparedSwapTransaction {
  const data = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "swapExactOutput",
    args: [
      params.pool,
      params.recipient,
      params.zeroForOne,
      params.amountOut,
      params.priceLimitX64,
      params.maxAmountIn,
      params.deadline,
    ],
  });

  return {
    to: routerAddress,
    data,
  };
}

/**
 * Prepare swapExactInputNativeForTokens transaction calldata without sending.
 *
 * @param routerAddress - Router contract address
 * @param params - Swap parameters (without zeroForOne)
 * @returns Prepared transaction data with calldata and value
 */
export function prepareSwapExactInputNativeForTokensCalldata(
  routerAddress: Address,
  params: Omit<SwapExactInputParams, "zeroForOne">,
): PreparedSwapTransaction {
  const data = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "swapExactInputNativeForTokens",
    args: [
      params.pool,
      params.recipient,
      params.amountIn,
      params.priceLimitX64,
      params.minAmountOut,
      params.deadline,
    ],
  });

  return {
    to: routerAddress,
    data,
    value: params.amountIn,
  };
}

/**
 * Execute exact input swap
 */
export async function swapExactInput(
  publicClient: PublicClient,
  walletClient: WalletClient,
  routerAddress: Address,
  params: SwapExactInputParams,
  account: Address,
): Promise<Hex> {
  const { request } = await publicClient.simulateContract({
    address: routerAddress,
    abi: SWAP_ROUTER_ABI,
    functionName: "swapExactInput",
    args: [
      params.pool,
      params.recipient,
      params.zeroForOne,
      params.amountIn,
      params.priceLimitX64,
      params.minAmountOut,
      params.deadline,
    ],
    account,
  });

  return await walletClient.writeContract(request);
}

/**
 * Execute exact output swap
 */
export async function swapExactOutput(
  publicClient: PublicClient,
  walletClient: WalletClient,
  routerAddress: Address,
  params: SwapExactOutputParams,
  account: Address,
): Promise<Hex> {
  const { request } = await publicClient.simulateContract({
    address: routerAddress,
    abi: SWAP_ROUTER_ABI,
    functionName: "swapExactOutput",
    args: [
      params.pool,
      params.recipient,
      params.zeroForOne,
      params.amountOut,
      params.priceLimitX64,
      params.maxAmountIn,
      params.deadline,
    ],
    account,
  });

  return await walletClient.writeContract(request);
}

/**
 * Execute swap with native ETH input
 */
export async function swapExactInputNativeForTokens(
  publicClient: PublicClient,
  walletClient: WalletClient,
  routerAddress: Address,
  params: Omit<SwapExactInputParams, "zeroForOne">,
  account: Address,
): Promise<Hex> {
  const { request } = await publicClient.simulateContract({
    address: routerAddress,
    abi: SWAP_ROUTER_ABI,
    functionName: "swapExactInputNativeForTokens",
    args: [
      params.pool,
      params.recipient,
      params.amountIn,
      params.priceLimitX64,
      params.minAmountOut,
      params.deadline,
    ],
    account,
    value: params.amountIn,
  });

  return await walletClient.writeContract(request);
}
