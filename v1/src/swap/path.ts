/**
 * MetricAMM SDK - swap path helpers shared by router and quoter.
 */

import type { Address, Hex, PublicClient } from "viem";
import { getAddress } from "viem";
import { POOL_ABI } from "../constants.js";
import { EMPTY_EXTENSION_DATA } from "../extensions/types.js";

function withExtensionData(extensionData?: Hex): Hex {
  return extensionData ?? EMPTY_EXTENSION_DATA;
}

export function encodeZeroForOneBitMap(zeroForOneDirections: readonly boolean[]): bigint {
  let bitmap = 0n;
  for (let i = 0; i < zeroForOneDirections.length; i++) {
    if (zeroForOneDirections[i]) {
      bitmap |= 1n << BigInt(i);
    }
  }
  return bitmap;
}

async function readPoolTokens(
  publicClient: PublicClient,
  pool: Address,
): Promise<{ token0: Address; token1: Address }> {
  const imm = (await publicClient.readContract({
    address: pool,
    abi: POOL_ABI,
    functionName: "getImmutables",
  })) as { token0: Address; token1: Address };

  return { token0: imm.token0, token1: imm.token1 };
}

function zeroForOneFromTokenIn(tokenIn: Address, token0: Address, token1: Address): boolean {
  const normalized = getAddress(tokenIn);
  if (normalized === getAddress(token0)) return true;
  if (normalized === getAddress(token1)) return false;
  throw new Error(`tokenIn ${tokenIn} is not a token in pool (${token0}, ${token1})`);
}

function normalizeExtensionDatas(
  pools: readonly Address[],
  extensionDatas?: readonly Hex[],
): Hex[] {
  if (!extensionDatas) {
    return pools.map(() => EMPTY_EXTENSION_DATA);
  }
  if (extensionDatas.length !== pools.length) {
    throw new Error("extensionDatas length must match pools length");
  }
  return extensionDatas.map((extensionData) => withExtensionData(extensionData));
}

export async function resolveSwapPath(
  publicClient: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  pools: readonly Address[],
  extensionDatas?: readonly Hex[],
): Promise<{
  tokens: Address[];
  zeroForOnes: boolean[];
  extensionDatas: Hex[];
  zeroForOneBitMap: bigint;
}> {
  if (pools.length === 0) {
    throw new Error("pools must not be empty");
  }

  const normalizedExtensionDatas = normalizeExtensionDatas(pools, extensionDatas);
  const tokens: Address[] = [getAddress(tokenIn)];
  const zeroForOnes: boolean[] = [];
  let currentToken = getAddress(tokenIn);

  for (const pool of pools) {
    const { token0, token1 } = await readPoolTokens(publicClient, pool);
    const zeroForOne = zeroForOneFromTokenIn(currentToken, token0, token1);
    const nextToken = getAddress(zeroForOne ? token1 : token0);
    zeroForOnes.push(zeroForOne);
    tokens.push(nextToken);
    currentToken = nextToken;
  }

  if (currentToken !== getAddress(tokenOut)) {
    throw new Error(`path ends at ${currentToken}, expected ${getAddress(tokenOut)}`);
  }

  return {
    tokens,
    zeroForOnes,
    extensionDatas: normalizedExtensionDatas,
    zeroForOneBitMap: encodeZeroForOneBitMap(zeroForOnes),
  };
}

export async function resolveZeroForOne(
  publicClient: PublicClient,
  pool: Address,
  tokenIn: Address,
  tokenOut: Address,
): Promise<boolean> {
  const { zeroForOnes } = await resolveSwapPath(publicClient, tokenIn, tokenOut, [pool]);
  return zeroForOnes[0]!;
}
