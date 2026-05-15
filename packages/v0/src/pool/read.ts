/**
 * MetricAMM SDK - Pool Read Functions
 * Functions for reading pool state directly from pool contract
 */

import type { Address, PublicClient } from "viem";
import { POOL_ABI, STATE_VIEW_ABI } from "../constants.js";
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
 * Read pool state via StateView (slot0 + slot1)
 */
export async function getPoolState(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
): Promise<PoolState> {
  const [slot0, slot1] = await Promise.all([
    publicClient.readContract({
      address: stateViewAddress,
      abi: STATE_VIEW_ABI,
      functionName: "slot0",
      args: [poolAddress],
    }) as Promise<any[]>,
    publicClient.readContract({
      address: stateViewAddress,
      abi: STATE_VIEW_ABI,
      functionName: "slot1",
      args: [poolAddress],
    }) as Promise<any[]>,
  ]);

  return {
    curBinIdx: slot0[0],
    curPosInBin: slot0[1],
    curBinDistFromProvidedPriceE6: slot0[2],
    driftE8: slot0[3],
    performanceFeeE6: slot0[4],
    totalScaledToken0InBins: slot1[0],
    totalScaledToken1InBins: slot1[1],
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
