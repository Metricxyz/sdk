/**
 * MetricAMM SDK - Pool Read Functions
 * Functions for reading pool state directly from pool contract
 */

import type { Address, PublicClient } from "viem";
import { POOL_ABI } from "../constants.js";
import type { PoolImmutables, PoolState, BinState } from "../types.js";

/**
 * Read pool immutables
 */
export async function getPoolImmutables(
  publicClient: PublicClient,
  poolAddress: Address,
): Promise<PoolImmutables> {
  const result = (await publicClient.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "getImmutables",
  })) as [
    Address,
    Address,
    Address,
    Address,
    bigint,
    bigint,
    bigint,
    boolean,
    bigint,
    bigint,
    number,
    number,
    bigint,
    bigint,
  ];

  return {
    factory: result[0],
    token0: result[2],
    token1: result[3],
    token0ScaleMultiplier: result[12],
    token1ScaleMultiplier: result[13],
    initialScaledToken0PerShareE18: result[4],
    initialScaledToken1PerShareE18: result[5],
    minimalMintableLiquidity: result[6],
    maxDriftE8: result[8],
    maxDriftDecayPerSecondE8: result[9],
    lowestBin: result[10],
    highestBin: result[11],
  };
}

/**
 * Read pool state
 */
export async function getPoolState(
  publicClient: PublicClient,
  poolAddress: Address,
): Promise<PoolState> {
  const result = (await publicClient.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "getState",
  })) as any[];

  return {
    curBinIdx: result[0],
    curPosInBin: result[1],
    curBinDistFromProvidedPriceE6: result[2],
    driftE8: result[3],
    performanceFeeE6: result[4],
    totalScaledToken0InBins: result[5],
    totalScaledToken1InBins: result[6],
  };
}

/**
 * Read bin state
 */
export async function getBinState(
  publicClient: PublicClient,
  poolAddress: Address,
  binIdx: number,
): Promise<BinState> {
  const result = (await publicClient.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "getBinState",
    args: [binIdx],
  })) as any[];

  return {
    token0BalanceScaled: result[0],
    token1BalanceScaled: result[1],
    lengthE6: result[2],
    addFeeBuyE6: result[3],
    addFeeSellE6: result[4],
  };
}

/**
 * Get user position shares in a specific bin
 */
export async function getPositionBinShares(
  publicClient: PublicClient,
  poolAddress: Address,
  owner: Address,
  salt: bigint,
  binIdx: number,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "getPositionBinShares",
    args: [owner, salt, binIdx],
  })) as bigint;
}
