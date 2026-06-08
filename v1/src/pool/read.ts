/**
 * MetricAMM SDK - Pool read helpers (v1 pools + pool-side immutables).
 */

import type { Address, PublicClient } from "viem";
import { POOL_FACTORY_ABI, POOL_ABI, DATA_PROVIDER_ABI } from "../constants.js";
import type { PoolImmutables, PoolState, BinState, PoolFeeConfig } from "../types.js";

/**
 * Read pool immutables via `MetricOmmPool.getImmutables()`.
 */
export async function getPoolImmutables(
  publicClient: PublicClient,
  _factoryAddress: Address,
  poolAddress: Address,
): Promise<PoolImmutables> {
  const imm = (await publicClient.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "getImmutables",
  })) as {
    factory: Address;
    token0: Address;
    token1: Address;
    token0ScaleMultiplier: bigint;
    token1ScaleMultiplier: bigint;
    initialScaledToken0PerShareE18: bigint;
    initialScaledToken1PerShareE18: bigint;
    minimalMintableLiquidity: bigint;
    immutablePriceProvider: Address;
    hooks: Address;
    hooksPermissions: number;
    lowestBin: bigint;
    highestBin: bigint;
  };

  return {
    factory: imm.factory,
    token0: imm.token0,
    token1: imm.token1,
    token0ScaleMultiplier: imm.token0ScaleMultiplier,
    token1ScaleMultiplier: imm.token1ScaleMultiplier,
    initialScaledToken0PerShareE18: imm.initialScaledToken0PerShareE18,
    initialScaledToken1PerShareE18: imm.initialScaledToken1PerShareE18,
    minimalMintableLiquidity: imm.minimalMintableLiquidity,
    immutablePriceProvider: imm.immutablePriceProvider,
    hooks: imm.hooks,
    hooksPermissions: imm.hooksPermissions,
    maxDriftE8: 0n,
    maxDriftDecayPerSecondE8: 0n,
    lowestBin: Number(imm.lowestBin),
    highestBin: Number(imm.highestBin),
  };
}

/** Read persisted fee config for a pool from the factory. */
export async function getPoolFeeConfig(
  publicClient: PublicClient,
  factoryAddress: Address,
  poolAddress: Address,
): Promise<PoolFeeConfig> {
  const result = (await publicClient.readContract({
    address: factoryAddress,
    abi: POOL_FACTORY_ABI,
    functionName: "poolFeeConfig",
    args: [poolAddress],
  })) as readonly [number, number, number, number];

  return {
    protocolSpreadFeeE6: result[0],
    adminSpreadFeeE6: result[1],
    protocolNotionalFeeE8: result[2],
    adminNotionalFeeE8: result[3],
  };
}

/**
 * Read pool state via MetricOmmPoolDataProvider (slot0 + slot1).
 */
export async function getPoolState(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
): Promise<PoolState> {
  const [slot0, slot1] = await Promise.all([
    publicClient.readContract({
      address: dataProviderAddress,
      abi: DATA_PROVIDER_ABI,
      functionName: "slot0",
      args: [poolAddress],
    }) as Promise<readonly [number, number, bigint, number, number, number]>,
    publicClient.readContract({
      address: dataProviderAddress,
      abi: DATA_PROVIDER_ABI,
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
 * Read bin state (scaled balances) via MetricOmmPoolDataProvider.
 */
export async function getBinState(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
  binIdx: number,
): Promise<BinState> {
  const result = (await publicClient.readContract({
    address: dataProviderAddress,
    abi: DATA_PROVIDER_ABI,
    functionName: "binState",
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
 * Get user position shares in a specific bin (DataProvider).
 */
export async function getPositionBinShares(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
  owner: Address,
  salt: bigint,
  binIdx: number,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: dataProviderAddress,
    abi: DATA_PROVIDER_ABI,
    functionName: "positionBinShares",
    args: [poolAddress, owner, salt, binIdx],
  })) as bigint;
}
