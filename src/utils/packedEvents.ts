/**
 * Unpack packed event fields (matches metric-core `types/Packed.sol`: `Packed2Int128Lib`,
 * `Packed2Uint128Lib`, `PackedSwapDetailsLib`). `MetricOmmPool`'s `Swap` and `BinSwapped`
 * events carry these as plain `uint256` words in their ABI (`internalType` differs, `type`
 * does not) — viem decodes them as a bare `bigint` with no further meaning attached. Pass
 * that `bigint` (or its `0x`-hex form) through the helpers below to recover the real values.
 */

const UINT128_MASK = (1n << 128n) - 1n;
const INT128_SIGN_BIT = 1n << 127n;
const INT128_MODULUS = 1n << 128n;

const UINT104_MASK = (1n << 104n) - 1n;
const INT16_MASK = 0xffffn;
const INT16_SIGN_BIT = 1n << 15n;
const INT16_MODULUS = 1n << 16n;

function toPackedBigInt(data: bigint | `0x${string}`): bigint {
  return typeof data === "bigint" ? data : BigInt(data);
}

/** Reinterpret the low `width` bits of `value` as a two's-complement signed integer. */
function signExtend(value: bigint, mask: bigint, signBit: bigint, modulus: bigint): bigint {
  const masked = value & mask;
  return (masked & signBit) !== 0n ? masked - modulus : masked;
}

export interface UnpackedPacked2Uint128 {
  /** Top 128 bits. */
  high: bigint;
  /** Bottom 128 bits. */
  low: bigint;
}

/** Unpack a `Packed2Uint128` word: `high` = top 128 bits, `low` = bottom 128 bits (both unsigned). */
export function unpackPacked2Uint128(packed: bigint | `0x${string}`): UnpackedPacked2Uint128 {
  const value = toPackedBigInt(packed);
  return {
    high: (value >> 128n) & UINT128_MASK,
    low: value & UINT128_MASK,
  };
}

export interface UnpackedPacked2Int128 {
  /** Top 128 bits, sign-extended (two's-complement `int128`). */
  high: bigint;
  /** Bottom 128 bits, sign-extended (two's-complement `int128`). */
  low: bigint;
}

/** Unpack a `Packed2Int128` word: `high`/`low` are two's-complement `int128` halves. */
export function unpackPacked2Int128(packed: bigint | `0x${string}`): UnpackedPacked2Int128 {
  const value = toPackedBigInt(packed);
  return {
    high: signExtend(value >> 128n, UINT128_MASK, INT128_SIGN_BIT, INT128_MODULUS),
    low: signExtend(value, UINT128_MASK, INT128_SIGN_BIT, INT128_MODULUS),
  };
}

export interface UnpackedPackedSwapDetails {
  /** Whether `amountSpecified` was treated as an exact input. */
  exactInput: boolean;
  /** Active bin index after the swap (`int16` range). */
  binIdx: number;
  /** Position within `binIdx` after the swap (`uint104` range). */
  posInBin: bigint;
}

/**
 * Unpack a `PackedSwapDetails` word. Layout, low bits first: `posInBin` (bits 0..103,
 * `uint104`), `binIdx` (bits 104..119, `int16`), `exactInput` (bit 120).
 */
export function unpackPackedSwapDetails(packed: bigint | `0x${string}`): UnpackedPackedSwapDetails {
  const value = toPackedBigInt(packed);
  return {
    exactInput: ((value >> 120n) & 1n) === 1n,
    binIdx: Number(signExtend(value >> 104n, INT16_MASK, INT16_SIGN_BIT, INT16_MODULUS)),
    posInBin: value & UINT104_MASK,
  };
}

export interface UnpackedBinSwappedEvent {
  binIdx: bigint;
  /** Change in this bin's scaled token0 balance for this swap step. */
  binDelta0Scaled: bigint;
  /** Change in this bin's scaled token1 balance for this swap step. */
  binDelta1Scaled: bigint;
  /** This step's LP-leg fee (stays in the bin). */
  lpFeeAmount: bigint;
  /** This step's platform-leg fee (protocol + admin, withheld). */
  platformFeeAmount: bigint;
}

/**
 * Unpack a decoded `BinSwapped(int256 binIdx, Packed2Int128 binDeltas, Packed2Uint128 fees)`
 * log's `args` (e.g. from viem's `decodeEventLog`/`parseEventLogs` against `MetricOmmPoolAbi`).
 */
export function unpackBinSwappedEvent(args: {
  binIdx: bigint;
  binDeltas: bigint;
  fees: bigint;
}): UnpackedBinSwappedEvent {
  const deltas = unpackPacked2Int128(args.binDeltas);
  const fees = unpackPacked2Uint128(args.fees);
  return {
    binIdx: args.binIdx,
    binDelta0Scaled: deltas.high,
    binDelta1Scaled: deltas.low,
    lpFeeAmount: fees.high,
    platformFeeAmount: fees.low,
  };
}

export interface UnpackedSwapEvent {
  sender: `0x${string}`;
  recipient: `0x${string}`;
  exactInput: boolean;
  /** Active bin index after the swap. */
  binIdx: number;
  /** Position within `binIdx` after the swap. */
  posInBin: bigint;
  /** Net native-token flow for token0 over the whole call (positive = the pool gained it). */
  amountDelta0: bigint;
  /** Net native-token flow for token1 over the whole call (positive = the pool gained it). */
  amountDelta1: bigint;
  /** Platform SPREAD-leg fee on the input-token leg. */
  platformSpreadFee: bigint;
  /** Platform NOTIONAL-leg fee on the input-token leg. */
  platformNotionalFee: bigint;
}

/**
 * Unpack a decoded `Swap(address sender, address recipient, PackedSwapDetails details,
 * Packed2Int128 amountDeltas, Packed2Uint128 platformFees)` log's `args` (e.g. from viem's
 * `decodeEventLog`/`parseEventLogs` against `MetricOmmPoolAbi`).
 */
export function unpackSwapEvent(args: {
  sender: `0x${string}`;
  recipient: `0x${string}`;
  details: bigint;
  amountDeltas: bigint;
  platformFees: bigint;
}): UnpackedSwapEvent {
  const swapDetails = unpackPackedSwapDetails(args.details);
  const amounts = unpackPacked2Int128(args.amountDeltas);
  const fees = unpackPacked2Uint128(args.platformFees);
  return {
    sender: args.sender,
    recipient: args.recipient,
    exactInput: swapDetails.exactInput,
    binIdx: swapDetails.binIdx,
    posInBin: swapDetails.posInBin,
    amountDelta0: amounts.high,
    amountDelta1: amounts.low,
    platformSpreadFee: fees.high,
    platformNotionalFee: fees.low,
  };
}
