/**
 * MetricAMM SDK - Pool read helpers (v1 pools + factory-backed immutables).
 */

import type { Address, PublicClient } from "viem";
import { POOL_FACTORY_ABI, STATE_VIEW_ABI } from "../constants.js";
import type { PoolImmutables, PoolState, BinState } from "../types.js";

/**
 * Read pool immutables via the factory (v1 pools do not expose a pool-side immutables getter).
 */
export async function getPoolImmutables(
  publicClient: PublicClient,
  factoryAddress: Address,
  poolAddress: Address,
): Promise<PoolImmutables> {
  const imm = (await publicClient.readContract({
    address: factoryAddress,
    abi: POOL_FACTORY_ABI,
    functionName: "poolImmutables",
    args: [poolAddress],
  })) as {
    token0: Address;
    token1: Address;
    immutablePriceProvider: Address;
    depositAllowlistProvider: Address;
    swapAllowlistProvider: Address;
    reportSwapToPriceProvider: boolean;
    token0ScaleMultiplier: bigint;
    token1ScaleMultiplier: bigint;
    initialScaledAmount0PerShareE18: bigint;
    initialScaledAmount1PerShareE18: bigint;
    minimalMintableLiquidity: bigint;
    lowestBin: number;
    highestBin: number;
  };

  return {
    factory: factoryAddress,
    token0: imm.token0,
    token1: imm.token1,
    token0ScaleMultiplier: imm.token0ScaleMultiplier,
    token1ScaleMultiplier: imm.token1ScaleMultiplier,
    initialScaledToken0PerShareE18: imm.initialScaledAmount0PerShareE18,
    initialScaledToken1PerShareE18: imm.initialScaledAmount1PerShareE18,
    minimalMintableLiquidity: imm.minimalMintableLiquidity,
    maxDriftE8: 0n,
    maxDriftDecayPerSecondE8: 0n,
    lowestBin: imm.lowestBin,
    highestBin: imm.highestBin,
  };
}

/**
 * Read pool state via StateView (slot0 + slot1).
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
    }) as Promise<readonly [number, number, bigint, number, number, number]>,
    publicClient.readContract({
      address: stateViewAddress,
      abi: STATE_VIEW_ABI,
      functionName: "slot1",
      args: [poolAddress],
    }) as Promise<readonly [bigint, bigint]>,
  ]);

  return {
    pauseLevel: slot0[0],
    curBinIdx: slot0[1],
    curPosInBin: slot0[2],
    curBinDistFromProvidedPrice: slot0[3],
    spreadFeeE6: slot0[4],
    notionalFeeE8: slot0[5],
    totalScaledToken0InBins: slot1[0],
    totalScaledToken1InBins: slot1[1],
  };
}

/**
 * Read bin state (scaled balances) via StateView.
 */
export async function getBinState(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  binIdx: number,
): Promise<BinState> {
  const result = (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "binStateScaled",
    args: [poolAddress, binIdx],
  })) as readonly [bigint, bigint, number, number, number];

  return {
    token0BalanceScaled: result[0],
    token1BalanceScaled: result[1],
    lengthE6: result[2],
    addFeeBuyE6: result[3],
    addFeeSellE6: result[4],
  };
}

/**
 * Get user position shares in a specific bin (StateView).
 */
export async function getPositionBinShares(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  owner: Address,
  salt: bigint,
  binIdx: number,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "positionBinShares",
    args: [poolAddress, owner, salt, binIdx],
  })) as bigint;
}
