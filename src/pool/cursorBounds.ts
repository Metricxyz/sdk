/**
 * Helpers for weighted-add LiquidityAdder cursor bounds.
 *
 * Cursor position is measured in linear units: each bin spans MAX_UINT104 + 1
 * positions (0 … MAX_UINT104). Movement can cross bin boundaries; distance is
 * summed across bins.
 */

import type { Address, PublicClient } from "viem";
import { MAX_UINT104 } from "../constants.js";
import { getSlot0 } from "../dataProvider/read.js";
import { getAddressesOrThrow } from "../addresses.js";
import { UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS, type LiquidityCursorBounds } from "./liquidity.js";

const POSITIONS_PER_BIN = MAX_UINT104 + 1n;
const CURSOR_MOVEMENT_SCALE = 1_000_000_000n;

function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  const r = a % b;
  if (r !== 0n && a < 0n) return q - 1n;
  return q;
}

function floorMod(a: bigint, b: bigint): bigint {
  return a - floorDiv(a, b) * b;
}

function cursorToLinear(curBinIdx: number, curPosInBin: bigint): bigint {
  return BigInt(curBinIdx) * POSITIONS_PER_BIN + curPosInBin;
}

function linearToCursor(linear: bigint): { curBinIdx: number; curPosInBin: bigint } {
  return {
    curBinIdx: Number(floorDiv(linear, POSITIONS_PER_BIN)),
    curPosInBin: floorMod(linear, POSITIONS_PER_BIN),
  };
}

/** Convert a movement factor to position units (1.0 = MAX_UINT104 positions). */
export function cursorMovementToPositionDelta(maximalCursorMovement: number): bigint {
  if (!Number.isFinite(maximalCursorMovement) || maximalCursorMovement < 0) {
    throw new Error("maximalCursorMovement must be a non-negative finite number");
  }
  const scaledMovement = BigInt(Math.round(maximalCursorMovement * Number(CURSOR_MOVEMENT_SCALE)));
  return (scaledMovement * MAX_UINT104) / CURSOR_MOVEMENT_SCALE;
}

/**
 * Build LiquidityCursorBounds around a cursor by allowing up to
 * `maximalCursorMovement * MAX_UINT104` positions of movement left or right.
 */
export function computeLiquidityCursorBounds(
  curBinIdx: number,
  curPosInBin: bigint,
  maximalCursorMovement: number,
): LiquidityCursorBounds {
  const delta = cursorMovementToPositionDelta(maximalCursorMovement);
  const currentLinear = cursorToLinear(curBinIdx, curPosInBin);

  const protocolMinLinear = cursorToLinear(
    UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS.minimalCurBin,
    UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS.minimalPosition,
  );
  const protocolMaxLinear = cursorToLinear(
    UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS.maximalCurBin,
    UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS.maximalPosition,
  );

  const clampedMinLinear =
    currentLinear - delta < protocolMinLinear ? protocolMinLinear : currentLinear - delta;
  const clampedMaxLinear =
    currentLinear + delta > protocolMaxLinear ? protocolMaxLinear : currentLinear + delta;

  const minimal = linearToCursor(clampedMinLinear);
  const maximal = linearToCursor(clampedMaxLinear);

  return {
    minimalCurBin: minimal.curBinIdx,
    minimalPosition: minimal.curPosInBin,
    maximalCurBin: maximal.curBinIdx,
    maximalPosition: maximal.curPosInBin,
  };
}

/**
 * Read the pool cursor and return LiquidityCursorBounds for weighted add encoders.
 *
 * @param maximalCursorMovement - 1.0 allows up to MAX_UINT104 positions of movement
 *   left or right from the current cursor (summing across bin boundaries).
 */
export async function prepareLiquidityCursorBounds(params: {
  publicClient: PublicClient;
  pool: Address;
  maximalCursorMovement: number;
  dataProviderAddress?: Address;
}): Promise<LiquidityCursorBounds> {
  let dataProviderAddress: Address;
  if (params.dataProviderAddress) {
    dataProviderAddress = params.dataProviderAddress;
  } else {
    const chainId = params.publicClient.chain?.id;
    if (chainId === undefined) {
      throw new Error("publicClient.chain.id is required to resolve dataProvider address");
    }
    dataProviderAddress = getAddressesOrThrow(chainId).dataProvider;
  }
  const slot0 = await getSlot0(params.publicClient, dataProviderAddress, params.pool);

  return computeLiquidityCursorBounds(
    slot0.curBinIdx,
    slot0.curPosInBin,
    params.maximalCursorMovement,
  );
}
