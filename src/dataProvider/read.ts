/**
 * MetricAMM SDK - DataProvider read functions
 * Batch reads via MetricOmmPoolDataProvider.
 */

import type { Address, PublicClient } from "viem";
import { DATA_PROVIDER_ABI } from "../constants.js";
import { getPoolImmutables } from "../pool/read.js";
import type {
  Slot0,
  Slot1,
  BinStateExternal,
  BinStatesExternal,
  BinStatesScaled,
  PositionBinSharesResult,
} from "../types.js";
import {
  decodeBinStatesBytes32,
  decodeBinTotalSharesBatch,
  scaledBalanceToExternal,
} from "../utils/poolState.js";

const EMPTY_BIN_STATES_SCALED: BinStatesScaled = {
  token0BalancesScaled: [],
  token1BalancesScaled: [],
  lengthsInUnits: [],
  addFeeBuysE6: [],
  addFeeSellsE6: [],
  totalShares: [],
};

const EMPTY_BIN_STATES_EXTERNAL: BinStatesExternal = {
  token0Balances: [],
  token1Balances: [],
  lengthsInUnits: [],
  addFeeBuysE6: [],
  addFeeSellsE6: [],
  totalShares: [],
};

async function readPackedBinStatesBatch(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
  binIndices: number[],
): Promise<{
  decoded: ReturnType<typeof decodeBinStatesBytes32>;
  totalShares: bigint[];
}> {
  const [binStatesPacked, totalSharesPacked] = await Promise.all([
    publicClient.readContract({
      address: dataProviderAddress,
      abi: DATA_PROVIDER_ABI,
      functionName: "binStates",
      args: [poolAddress, binIndices],
    }),
    publicClient.readContract({
      address: dataProviderAddress,
      abi: DATA_PROVIDER_ABI,
      functionName: "binTotalShares",
      args: [poolAddress, binIndices],
    }),
  ]);

  return {
    decoded: decodeBinStatesBytes32(binStatesPacked as readonly `0x${string}`[]),
    totalShares: decodeBinTotalSharesBatch(totalSharesPacked as readonly `0x${string}`[]),
  };
}

function toBinStatesScaled(
  decoded: ReturnType<typeof decodeBinStatesBytes32>,
  totalShares: bigint[],
): BinStatesScaled {
  return {
    token0BalancesScaled: decoded.map((d) => d.token0BalanceScaled),
    token1BalancesScaled: decoded.map((d) => d.token1BalanceScaled),
    lengthsInUnits: decoded.map((d) => d.lengthE6),
    addFeeBuysE6: decoded.map((d) => d.addFeeBuyE6),
    addFeeSellsE6: decoded.map((d) => d.addFeeSellE6),
    totalShares,
  };
}

/** Get slot0 data efficiently (all in one call). */
export async function getSlot0(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
): Promise<Slot0> {
  const result = (await publicClient.readContract({
    address: dataProviderAddress,
    abi: DATA_PROVIDER_ABI,
    functionName: "slot0",
    args: [poolAddress],
  })) as any[];

  return {
    pauseLevel: Number(result[0]),
    curBinIdx: Number(result[1]),
    curPosInBin: result[2],
    curBinDistFromProvidedPrice: Number(result[3]),
    spreadFeeE6: Number(result[4]),
    notionalFeeE8: Number(result[5]),
    bidAskRefAsymmetryX8: Number(result[6]),
  };
}

/** Get slot1 data (total scaled token amounts in bins). */
export async function getSlot1(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
): Promise<Slot1> {
  const result = (await publicClient.readContract({
    address: dataProviderAddress,
    abi: DATA_PROVIDER_ABI,
    functionName: "slot1",
    args: [poolAddress],
  })) as any[];

  return {
    totalScaledToken0InBins: result[0],
    totalScaledToken1InBins: result[1],
  };
}

/**
 * Get bin state with balances in external (native token decimal) units.
 * Lens returns scaled storage values; pass factoryAddress to unscale via pool immutables.
 */
export async function getBinStateExternal(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
  binIdx: number,
  factoryAddress: Address,
): Promise<BinStateExternal> {
  const [immutables, result] = await Promise.all([
    getPoolImmutables(publicClient, factoryAddress, poolAddress),
    publicClient.readContract({
      address: dataProviderAddress,
      abi: DATA_PROVIDER_ABI,
      functionName: "binState",
      args: [poolAddress, binIdx],
    }),
  ]);

  const scaled = result as readonly [bigint, bigint, number, number, number];

  return {
    token0Balance: scaledBalanceToExternal(scaled[0], immutables.token0ScaleMultiplier),
    token1Balance: scaledBalanceToExternal(scaled[1], immutables.token1ScaleMultiplier),
    lengthE6: scaled[2],
    addFeeBuyE6: scaled[3],
    addFeeSellE6: scaled[4],
  };
}

/** Get multiple bin states efficiently (batch read, external units). */
export async function getBinStatesExternal(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
  binIndices: number[],
  factoryAddress: Address,
): Promise<BinStatesExternal> {
  if (binIndices.length === 0) {
    return EMPTY_BIN_STATES_EXTERNAL;
  }

  const [immutables, batch] = await Promise.all([
    getPoolImmutables(publicClient, factoryAddress, poolAddress),
    readPackedBinStatesBatch(publicClient, dataProviderAddress, poolAddress, binIndices),
  ]);

  return {
    token0Balances: batch.decoded.map((d) =>
      scaledBalanceToExternal(d.token0BalanceScaled, immutables.token0ScaleMultiplier),
    ),
    token1Balances: batch.decoded.map((d) =>
      scaledBalanceToExternal(d.token1BalanceScaled, immutables.token1ScaleMultiplier),
    ),
    lengthsInUnits: batch.decoded.map((d) => d.lengthE6),
    addFeeBuysE6: batch.decoded.map((d) => d.addFeeBuyE6),
    addFeeSellsE6: batch.decoded.map((d) => d.addFeeSellE6),
    totalShares: batch.totalShares,
  };
}

/** Get multiple bin states in scaled (internal storage) units via binStates + binTotalShares. */
export async function getBinStatesScaled(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
  binIndices: number[],
): Promise<BinStatesScaled> {
  if (binIndices.length === 0) {
    return EMPTY_BIN_STATES_SCALED;
  }

  const batch = await readPackedBinStatesBatch(
    publicClient,
    dataProviderAddress,
    poolAddress,
    binIndices,
  );

  return toBinStatesScaled(batch.decoded, batch.totalShares);
}

/** Get bin total shares. */
export async function getBinTotalShares(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
  binIdx: number,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: dataProviderAddress,
    abi: DATA_PROVIDER_ABI,
    functionName: "binTotalShares",
    args: [poolAddress, binIdx],
  })) as bigint;
}

/** Get user position shares via MetricOmmPoolDataProvider. */
export async function getPositionBinSharesFromDataProvider(
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

/**
 * Create a position bin key (matches Solidity's toPositionBinKey)
 * Layout: [address(160)] | [salt(80)] | [bin(16)] = 256 bits
 */
export function toPositionBinKey(owner: Address, salt: bigint, bin: number): `0x${string}` {
  const ownerBigInt = BigInt(owner);
  const binUint16 = bin < 0 ? BigInt(bin + 0x10000) : BigInt(bin);
  const packed =
    (ownerBigInt << 96n) | ((salt & 0xffffffffffffffffffffn) << 16n) | (binUint16 & 0xffffn);
  return `0x${packed.toString(16).padStart(64, "0")}` as `0x${string}`;
}

/**
 * Get user position shares for a range of bins via DataProvider batch calls.
 */
export async function getPositionBinSharesRange(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
  owner: Address,
  salt: bigint,
  lowerBin: number,
  upperBin: number,
): Promise<PositionBinSharesResult[]> {
  const binIndices: number[] = [];
  for (let bin = lowerBin; bin <= upperBin; bin++) {
    binIndices.push(bin);
  }

  return getPositionBinSharesForBins(
    publicClient,
    dataProviderAddress,
    poolAddress,
    owner,
    salt,
    binIndices,
  );
}

/**
 * Bins read per RPC round-trip in {@link getPositionBinSharesForBins}. `positionBinShares` has
 * no on-chain array overload and multicall can't be assumed available (e.g. plain local test
 * chains don't deploy Multicall3), so a wide bin range is chunked instead of fired as one
 * `Promise.all` per bin — a pool's full `lowestBin`..`highestBin` can otherwise mean hundreds of
 * concurrent reads, which public RPC providers commonly rate-limit or refuse.
 */
const POSITION_BIN_SHARES_CHUNK_SIZE = 25;

/** Get user position shares for specific (possibly non-contiguous) bins. */
export async function getPositionBinSharesForBins(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
  owner: Address,
  salt: bigint,
  bins: number[],
): Promise<PositionBinSharesResult[]> {
  const positionShares: PositionBinSharesResult[] = [];

  for (let start = 0; start < bins.length; start += POSITION_BIN_SHARES_CHUNK_SIZE) {
    const chunk = bins.slice(start, start + POSITION_BIN_SHARES_CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((bin) =>
        publicClient.readContract({
          address: dataProviderAddress,
          abi: DATA_PROVIDER_ABI,
          functionName: "positionBinShares",
          args: [poolAddress, owner, salt, bin],
        }),
      ),
    );

    for (let i = 0; i < chunk.length; i++) {
      const shares = results[i] as bigint;
      if (shares > 0n) {
        positionShares.push({
          binIdx: chunk[i]!,
          shares,
        });
      }
    }
  }

  return positionShares;
}

/** Get price provider address. */
export async function getPriceProvider(
  publicClient: PublicClient,
  dataProviderAddress: Address,
  poolAddress: Address,
): Promise<Address> {
  return (await publicClient.readContract({
    address: dataProviderAddress,
    abi: DATA_PROVIDER_ABI,
    functionName: "priceProvider",
    args: [poolAddress],
  })) as Address;
}
