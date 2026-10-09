/**
 * MetricAMM SDK - Bin Data Utilities
 * Functions for packing/unpacking bin data
 */

import type { BinData, PoolBin } from "../types.js";

/**
 * Pack bin data into 48-bit representation
 * Layout: [lengthE6: 16 bits][addFeeBuyE6: 16 bits][addFeeSellE6: 16 bits]
 */
export function packBinData(binData: BinData): bigint {
  const length = BigInt(binData.lengthE6) & 0xffffn;
  const buyFee = BigInt(binData.addFeeBuyE6) & 0xffffn;
  const sellFee = BigInt(binData.addFeeSellE6) & 0xffffn;

  return length | (buyFee << 16n) | (sellFee << 32n);
}

/**
 * Pack 5 bins into a single uint256
 * Each bin takes 48 bits, total 240 bits used, 16 bits unused
 */
export function packBins5(bins: BinData[]): bigint {
  if (bins.length !== 5) {
    throw new Error("Must provide exactly 5 bins");
  }

  let packed = 0n;
  for (let i = 0; i < 5; i++) {
    const binPacked = packBinData(bins[i]);
    packed |= binPacked << (BigInt(i) * 48n);
  }

  return packed;
}

/**
 * Pack an array of bin data into uint256 array (5 bins per uint256)
 * Pads with zero bins if length is not divisible by 5
 */
export function packBinDataArray(bins: BinData[]): bigint[] {
  const zeroBin: BinData = { lengthE6: 0, addFeeBuyE6: 0, addFeeSellE6: 0 };
  const result: bigint[] = [];

  // Process in chunks of 5
  for (let i = 0; i < bins.length; i += 5) {
    const chunk: BinData[] = [];
    for (let j = 0; j < 5; j++) {
      chunk.push(bins[i + j] || zeroBin);
    }
    result.push(packBins5(chunk));
  }

  return result;
}

/**
 * Unpack 48-bit bin data
 */
export function unpackBinData(packed: bigint): BinData {
  const lengthE6 = Number(packed & 0xffffn);
  const addFeeBuyE6 = Number((packed >> 16n) & 0xffffn);
  const addFeeSellE6 = Number((packed >> 32n) & 0xffffn);

  return {
    lengthE6,
    addFeeBuyE6,
    addFeeSellE6,
  };
}

const BINS_PER_WORD = 5;

/**
 * Unpack one side of a pool's packed bin configuration the way the factory reads it:
 * five bins per word, ending at the first zero-length bin. Slots after it are ignored.
 */
export function unpackBinDataArray(words: readonly (bigint | `0x${string}`)[]): BinData[] {
  const bins: BinData[] = [];
  for (const word of words) {
    const value = BigInt.asUintN(256, BigInt(word));
    for (let slot = 0; slot < BINS_PER_WORD; slot++) {
      const bin = unpackBinData((value >> (BigInt(slot) * 48n)) & 0xffffffffffffn);
      if (bin.lengthE6 === 0) return bins;
      bins.push(bin);
    }
  }
  return bins;
}

/**
 * Unpack a pool's bin layout from `PoolCreated`'s `nonNegativeBinDataArray` (bins 0, 1, …)
 * and `negativeBinDataArray` (bins -1, -2, …) into one list in ascending bin order.
 */
export function unpackPoolBins(
  nonNegativeBinDataArray: readonly (bigint | `0x${string}`)[],
  negativeBinDataArray: readonly (bigint | `0x${string}`)[],
): PoolBin[] {
  const negative = unpackBinDataArray(negativeBinDataArray).map((bin, i) => ({
    binIdx: -i - 1,
    ...bin,
  }));
  const nonNegative = unpackBinDataArray(nonNegativeBinDataArray).map((bin, i) => ({
    binIdx: i,
    ...bin,
  }));
  return [...negative.reverse(), ...nonNegative];
}

/**
 * Pack bin data array into uint256 array ready for contract calls.
 *
 * @param bins Array of bin configurations
 * @returns Packed uint256 array ready for contract calls
 *
 * @example
 * // Create 3 bins: 1% length with default fees
 * const bins = createBins([
 *   { lengthE6: 10000, addFeeBuyE6: 0, addFeeSellE6: 0 },
 *   { lengthE6: 10000, addFeeBuyE6: 0, addFeeSellE6: 0 },
 *   { lengthE6: 10000, addFeeBuyE6: 0, addFeeSellE6: 0 },
 * ]);
 *
 * @example
 * // Create bins with custom fees
 * const bins = createBins([
 *   { lengthE6: 10000, addFeeBuyE6: 500, addFeeSellE6: 200 },   // 1% length, +0.05% buy, +0.02% sell
 *   { lengthE6: 20000, addFeeBuyE6: 0, addFeeSellE6: 0 },       // 2% length, no extra fees
 * ]);
 */
export function createBins(bins: BinData[]): bigint[] {
  return packBinDataArray(bins);
}

/**
 * Create uniform bins with the same configuration.
 *
 * @param count Number of bins to create
 * @param lengthE6 Bin length in E6 format (10000 = 1%)
 * @param addFeeBuyE6 Additional buy fee in E6 format (default: 0)
 * @param addFeeSellE6 Additional sell fee in E6 format (default: 0)
 * @returns Packed uint256 array ready for contract calls
 *
 * @example
 * // Create 20 uniform bins, each 1% length
 * const bins = createUniformBins(20, 10000);
 *
 * @example
 * // Create 10 bins with 0.5% length and +0.1% buy fee
 * const bins = createUniformBins(10, 5000, 1000);
 */
export function createUniformBins(
  count: number,
  lengthE6: number,
  addFeeBuyE6: number = 0,
  addFeeSellE6: number = 0,
): bigint[] {
  const bins: BinData[] = Array(count).fill({
    lengthE6,
    addFeeBuyE6,
    addFeeSellE6,
  });
  return packBinDataArray(bins);
}
