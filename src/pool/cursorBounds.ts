/**
 * Cursor bounds for LiquidityAdder adds, expressed as an allowed change in the pool's
 * distance from the oracle price. The pool price is `oracle × (1 + distanceE6 / 1e6)`,
 * where the distance grows linearly through each bin by its `lengthE6`, so a percent of
 * price maps to a walk across bin widths from the current cursor.
 */

import type { Address, PublicClient } from "viem";
import { MAX_UINT104 } from "../constants.js";
import { getBinStatesScaled, getSlot0 } from "../dataProvider/read.js";
import { getAddressesOrThrow } from "../addresses.js";
import { getPoolImmutables } from "./read.js";
import type { LiquidityCursorBounds } from "./liquidity.js";

const PERCENT_TO_DISTANCE_E12 = 10_000_000_000;
const LENGTH_E6_TO_E12 = 1_000_000n;

type Cursor = { bin: number; position: bigint };

export interface ComputeLiquidityCursorBoundsParams {
  curBinIdx: number;
  curPosInBin: bigint;
  lowestBin: number;
  highestBin: number;
  /** `lengthE6` of every pool bin, index 0 = `lowestBin`. */
  binLengthsE6: number[];
  /** Largest accepted change in the pool's distance from the oracle, in percent of price. */
  maxOracleDistanceChangePercent: number;
}

function toDistanceE12(maxOracleDistanceChangePercent: number): bigint {
  if (!Number.isFinite(maxOracleDistanceChangePercent) || maxOracleDistanceChangePercent < 0) {
    throw new Error("maxOracleDistanceChangePercent must be a non-negative finite number");
  }
  return BigInt(Math.floor(maxOracleDistanceChangePercent * PERCENT_TO_DISTANCE_E12));
}

function walkUp(
  start: Cursor,
  distanceE12: bigint,
  lengthE12: (bin: number) => bigint,
  highestBin: number,
): Cursor {
  let { bin, position } = start;
  let remaining = distanceE12 * MAX_UINT104;
  for (;;) {
    const length = lengthE12(bin);
    const room = length * (MAX_UINT104 - position);
    if (remaining <= room && length > 0n) {
      return { bin, position: position + remaining / length };
    }
    if (bin === highestBin) return { bin, position: MAX_UINT104 };
    remaining -= room;
    bin += 1;
    position = 0n;
  }
}

function walkDown(
  start: Cursor,
  distanceE12: bigint,
  lengthE12: (bin: number) => bigint,
  lowestBin: number,
): Cursor {
  let { bin, position } = start;
  let remaining = distanceE12 * MAX_UINT104;
  for (;;) {
    const length = lengthE12(bin);
    const room = length * position;
    if (remaining <= room && length > 0n) {
      return { bin, position: position - remaining / length };
    }
    if (bin === lowestBin) return { bin, position: 0n };
    remaining -= room;
    bin -= 1;
    position = MAX_UINT104;
  }
}

/**
 * Bounds that keep the pool within `maxOracleDistanceChangePercent` of its current distance
 * from the oracle, walking bin widths left and right and clamping at the pool's bin range.
 * Positions round inward so the bounds never allow more than the requested change.
 */
export function computeLiquidityCursorBounds({
  curBinIdx,
  curPosInBin,
  lowestBin,
  highestBin,
  binLengthsE6,
  maxOracleDistanceChangePercent,
}: ComputeLiquidityCursorBoundsParams): LiquidityCursorBounds {
  if (binLengthsE6.length !== highestBin - lowestBin + 1) {
    throw new Error("binLengthsE6 must hold one length per bin from lowestBin to highestBin");
  }
  if (curBinIdx < lowestBin || curBinIdx > highestBin) {
    throw new Error(`curBinIdx ${curBinIdx} is outside [${lowestBin}, ${highestBin}]`);
  }
  const distanceE12 = toDistanceE12(maxOracleDistanceChangePercent);
  const lengthE12 = (bin: number) => BigInt(binLengthsE6[bin - lowestBin]) * LENGTH_E6_TO_E12;
  const current = { bin: curBinIdx, position: curPosInBin };
  const minimal = walkDown(current, distanceE12, lengthE12, lowestBin);
  const maximal = walkUp(current, distanceE12, lengthE12, highestBin);
  return {
    minimalCurBin: minimal.bin,
    minimalPosition: minimal.position,
    maximalCurBin: maximal.bin,
    maximalPosition: maximal.position,
  };
}

/** Read the pool cursor and bin widths, then build bounds for LiquidityAdder add encoders. */
export async function prepareLiquidityCursorBounds(params: {
  publicClient: PublicClient;
  pool: Address;
  maxOracleDistanceChangePercent: number;
  factoryAddress?: Address;
  dataProviderAddress?: Address;
}): Promise<LiquidityCursorBounds> {
  const { publicClient, pool, maxOracleDistanceChangePercent } = params;
  let { factoryAddress, dataProviderAddress } = params;
  if (!factoryAddress || !dataProviderAddress) {
    const chainId = publicClient.chain?.id;
    if (chainId === undefined) {
      throw new Error(
        "publicClient.chain.id is required to resolve factory and dataProvider addresses",
      );
    }
    const addresses = getAddressesOrThrow(chainId);
    factoryAddress ??= addresses.factory;
    dataProviderAddress ??= addresses.dataProvider;
  }

  const [immutables, slot0] = await Promise.all([
    getPoolImmutables(publicClient, factoryAddress, pool),
    getSlot0(publicClient, dataProviderAddress, pool),
  ]);
  const bins = Array.from(
    { length: immutables.highestBin - immutables.lowestBin + 1 },
    (_, i) => immutables.lowestBin + i,
  );
  const binStates = await getBinStatesScaled(publicClient, dataProviderAddress, pool, bins);

  return computeLiquidityCursorBounds({
    curBinIdx: slot0.curBinIdx,
    curPosInBin: slot0.curPosInBin,
    lowestBin: immutables.lowestBin,
    highestBin: immutables.highestBin,
    binLengthsE6: binStates.lengthsInUnits,
    maxOracleDistanceChangePercent,
  });
}
