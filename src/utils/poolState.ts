/**
 * Decode packed pool storage words (matches PoolStateLibrary._decodeBinState).
 */

const UINT104_MASK = (1n << 104n) - 1n;
const UINT16_MASK = 0xffffn;

export interface DecodedBinStateScaled {
  token0BalanceScaled: bigint;
  token1BalanceScaled: bigint;
  lengthE6: number;
  addFeeBuyE6: number;
  addFeeSellE6: number;
}

function toPackedBigInt(data: `0x${string}` | bigint): bigint {
  return typeof data === "bigint" ? data : BigInt(data);
}

/** Decode a single bin state storage word. */
export function decodeBinStateBytes32(data: `0x${string}` | bigint): DecodedBinStateScaled {
  const packed = toPackedBigInt(data);
  return {
    token0BalanceScaled: packed & UINT104_MASK,
    token1BalanceScaled: (packed >> 104n) & UINT104_MASK,
    lengthE6: Number((packed >> 208n) & UINT16_MASK),
    addFeeBuyE6: Number((packed >> 224n) & UINT16_MASK),
    addFeeSellE6: Number((packed >> 240n) & UINT16_MASK),
  };
}

/** Decode bin total shares storage word (uint256 in slot). */
export function decodeBinTotalSharesBytes32(data: `0x${string}` | bigint): bigint {
  return toPackedBigInt(data);
}

export function decodeBinStatesBytes32(
  words: readonly (`0x${string}` | bigint)[],
): DecodedBinStateScaled[] {
  return words.map(decodeBinStateBytes32);
}

export function decodeBinTotalSharesBatch(words: readonly (`0x${string}` | bigint)[]): bigint[] {
  return words.map(decodeBinTotalSharesBytes32);
}

/** Unscale stored balance to external (native decimals); matches on-chain DataProvider floor division. */
export function scaledBalanceToExternal(scaled: bigint, scaleMultiplier: bigint): bigint {
  if (scaleMultiplier === 0n) {
    throw new Error("scaleMultiplier must be non-zero");
  }
  return scaled / scaleMultiplier;
}

/** Pack a bin state into bytes32 (inverse of decodeBinStateBytes32). */
export function encodeBinStateBytes32(state: DecodedBinStateScaled): `0x${string}` {
  const packed =
    (state.token0BalanceScaled & UINT104_MASK) |
    ((state.token1BalanceScaled & UINT104_MASK) << 104n) |
    (BigInt(state.lengthE6 & 0xffff) << 208n) |
    (BigInt(state.addFeeBuyE6 & 0xffff) << 224n) |
    (BigInt(state.addFeeSellE6 & 0xffff) << 240n);
  return `0x${packed.toString(16).padStart(64, "0")}` as `0x${string}`;
}
