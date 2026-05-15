/**
 * MetricAMM SDK - Utility Functions
 */

// Bin data utilities
export {
  packBinData,
  packBins5,
  packBinDataArray,
  unpackBinData,
  createBins,
  createUniformBins,
} from "./binData.js";

// Price utilities
export { priceToQ64, q64ToPrice } from "./price.js";

// Liquidity math utilities
export {
  ONE_E18,
  ceilDiv,
  toPriceE18 as toPriceX18,
  priceX64ToPriceE18,
  convertToken0ToToken1,
  convertToken1ToToken0,
  scaledPositiveDeltaToExternal,
} from "./liquidityMath.js";

// Packed pool storage decode (binStates bytes32[], etc.)
export {
  decodeBinStateBytes32,
  decodeBinStatesBytes32,
  decodeBinTotalSharesBytes32,
  decodeBinTotalSharesBatch,
  encodeBinStateBytes32,
  scaledBalanceToExternal,
  type DecodedBinStateScaled,
} from "./poolState.js";
