/**
 * MetricAMM SDK - StateView Read Functions
 * Efficient batch read functions using the StateView contract
 */

import type { Address, PublicClient } from "viem";
import { STATE_VIEW_ABI } from "../constants.js";
import type {
  Slot0,
  Slot1,
  BinStateExternal,
  BinStatesExternal,
  BinStatesScaled,
  FeeConfig,
  PositionBinSharesResult,
} from "../types.js";

/**
 * Get slot0 data efficiently (all in one call)
 */
export async function getSlot0(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
): Promise<Slot0> {
  const result = (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "slot0",
    args: [poolAddress],
  })) as any[];

  return {
    curBinIdx: result[0],
    curPosInBin: result[1],
    curBinDistFromProvidedPriceE6: result[2],
    driftE8: result[3],
    performanceFeeE6: result[4],
  };
}

/**
 * Get slot1 data (performance fee amounts in external units)
 */
export async function getSlot1(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
): Promise<Slot1> {
  const result = (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "slot1",
    args: [poolAddress],
  })) as any[];

  return {
    performanceFeeAmount0: result[0],
    performanceFeeAmount1: result[1],
  };
}

/**
 * Get bin state with balances in external (native token decimal) units
 */
export async function getBinStateExternal(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  binIdx: number,
): Promise<BinStateExternal> {
  const result = (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "binState",
    args: [poolAddress, binIdx],
  })) as any[];

  return {
    token0Balance: result[0],
    token1Balance: result[1],
    lengthE6: result[2],
    addFeeBuyE6: result[3],
    addFeeSellE6: result[4],
  };
}

/**
 * Get multiple bin states efficiently (batch read)
 */
export async function getBinStatesExternal(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  binIndices: number[],
): Promise<BinStatesExternal> {
  const result = (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "binStates",
    args: [poolAddress, binIndices],
  })) as any[];

  return {
    token0Balances: result[0],
    token1Balances: result[1],
    lengthsInUnits: result[2],
    addFeeBuysE6: result[3],
    addFeeSellsE6: result[4],
    totalShares: result[5],
  };
}

/**
 * Get multiple bin states in scaled (internal) units (batch read)
 */
export async function getBinStatesScaled(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  binIndices: number[],
): Promise<BinStatesScaled> {
  const result = (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "binStatesScaled",
    args: [poolAddress, binIndices],
  })) as any[];

  return {
    token0BalancesScaled: result[0],
    token1BalancesScaled: result[1],
    lengthsInUnits: result[2],
    addFeeBuysE6: result[3],
    addFeeSellsE6: result[4],
    totalShares: result[5],
  };
}

/**
 * Get bin total shares
 */
export async function getBinTotalShares(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  binIdx: number,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "binTotalShares",
    args: [poolAddress, binIdx],
  })) as bigint;
}

/**
 * Get user position shares via StateView
 */
export async function getPositionBinSharesFromStateView(
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

/**
 * Create a position bin key (matches Solidity's toPositionBinKey)
 * Layout: [address(160)] | [salt(80)] | [bin(16)] = 256 bits
 */
export function toPositionBinKey(
  owner: Address,
  salt: bigint,
  bin: number,
): `0x${string}` {
  // Convert owner address to bigint (160 bits)
  const ownerBigInt = BigInt(owner);
  // Salt is 80 bits, bin is 16 bits (signed, convert to uint16)
  const binUint16 = bin < 0 ? BigInt(bin + 0x10000) : BigInt(bin);
  // Pack: owner << 96 | salt << 16 | bin
  const packed =
    (ownerBigInt << 96n) |
    ((salt & 0xffffffffffffffffffffn) << 16n) |
    (binUint16 & 0xffffn);
  return `0x${packed.toString(16).padStart(64, "0")}` as `0x${string}`;
}

/**
 * Get user position shares for a range of bins via StateView batch call
 *
 * @param publicClient - Viem public client
 * @param stateViewAddress - StateView contract address
 * @param poolAddress - Pool address
 * @param owner - Position owner (e.g., NFTPositionManager address)
 * @param salt - Position salt (e.g., NFT token ID)
 * @param lowerBin - Lower bin index (inclusive)
 * @param upperBin - Upper bin index (inclusive)
 * @returns Array of { binIdx, shares } for bins with non-zero shares
 */
export async function getPositionBinSharesRange(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
  owner: Address,
  salt: bigint,
  lowerBin: number,
  upperBin: number,
): Promise<PositionBinSharesResult[]> {
  const binIndices: number[] = [];
  const positionBinKeys: `0x${string}`[] = [];

  for (let bin = lowerBin; bin <= upperBin; bin++) {
    binIndices.push(bin);
    positionBinKeys.push(toPositionBinKey(owner, salt, bin));
  }

  // Batch read all bin shares using the new positionBinSharesBatch function
  const results = (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "positionBinSharesBatch",
    args: [poolAddress, positionBinKeys],
  })) as bigint[];

  const positionShares: PositionBinSharesResult[] = [];
  for (let i = 0; i < binIndices.length; i++) {
    const shares = results[i];
    if (shares > 0n) {
      positionShares.push({
        binIdx: binIndices[i],
        shares,
      });
    }
  }

  return positionShares;
}

/**
 * Get fee configuration
 */
export async function getFeeConfig(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
): Promise<FeeConfig> {
  const result = (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "feeConfig",
    args: [poolAddress],
  })) as any[];

  return {
    adminAddr: result[0],
    protocolFee: result[1],
    adminFee: result[2],
    adminFeeDest: result[3],
  };
}

/**
 * Get price provider address
 */
export async function getPriceProvider(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
): Promise<Address> {
  return (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "priceProvider",
    args: [poolAddress],
  })) as Address;
}

/**
 * Get last trade timestamp
 */
export async function getLastTradeTimestamp(
  publicClient: PublicClient,
  stateViewAddress: Address,
  poolAddress: Address,
): Promise<number> {
  return (await publicClient.readContract({
    address: stateViewAddress,
    abi: STATE_VIEW_ABI,
    functionName: "lastTradeTimestamp",
    args: [poolAddress],
  })) as number;
}
