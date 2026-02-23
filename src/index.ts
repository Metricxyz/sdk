/**
 * MetricAMM SDK
 *
 * Helper functions for interacting with MetricAMM contracts using viem.
 * Provides easy-to-use interfaces for:
 * - Creating pools with proper bin data packing
 * - Managing liquidity positions
 * - Executing swaps via the router
 *
 * @packageDocumentation
 */

// ============ Types ============
export type {
  LiquidityDelta,
  BinData,
  PoolImmutables,
  PoolState,
  BinState,
  BinStateExternal,
  BinStatesExternal,
  BinStatesScaled,
  Slot0,
  Slot1,
  FeeConfig,
  SwapParams,
  SwapExactInputParams,
  SwapExactOutputParams,
  PositionBinSharesResult,
  CalculateUniformLiquidityParams,
  AnyLiquidityBinInput,
  CalculateAnyLiquidityParams,
  CalculatedLiquidityDistribution,
} from "./types.js";

// ============ Constants ============
export {
  Q64,
  MAX_UINT128,
  MAX_INT128,
  MAX_UINT104,
  MAX_INT104,
} from "./constants.js";

// ============ Addresses ============
export {
  ChainId,
  ADDRESSES,
  getAddresses,
  getAddressesOrThrow,
  isChainSupported,
  getSupportedChainIds,
  isChainDeployed,
  type ChainAddresses,
} from "./addresses.js";

// ============ ABIs ============
export {
  MetricOmmPoolAbi,
  MetricOmmPoolStateViewAbi,
  MetricOmmSwapRouterAbi,
  MetricOmmPoolFactoryAbi,
} from "./abis/index.js";

// ============ Utils ============
export {
  // Bin data utilities
  packBinData,
  packBins5,
  packBinDataArray,
  unpackBinData,
  createBins,
  createUniformBins,
  // Price utilities
  priceToQ64,
  q64ToPrice,
} from "./utils/index.js";

// ============ Pool Functions ============
export {
  // Pool creation
  createPool,
  prepareFactoryCreatePoolParams,
  prepareCreatePoolCalldata,
  preparePoolBinData,
  type CreatePoolFactoryParams,
  type CreatePoolParams,
  // Pool read functions
  getPoolImmutables,
  getPoolState,
  getBinState,
  getPositionBinShares,
  // Liquidity calculations
  calculateUniformLiquidityDistribution,
  calculateAnyLiquidityDistribution,
  calculateAnyLiquididtyDistributinon,
} from "./pool/index.js";

// ============ StateView Functions ============
export {
  getSlot0,
  getSlot1,
  getBinStateExternal,
  getBinStatesExternal,
  getBinStatesScaled,
  getBinTotalShares,
  getPositionBinSharesFromStateView,
  toPositionBinKey,
  getPositionBinSharesRange,
  getFeeConfig,
  getPriceProvider,
  getLastTradeTimestamp,
} from "./stateView/index.js";

// ============ Position Functions ============
export {
  modifyLiquidity,
  prepareModifyLiquidityCalldata,
  getPositionShares,
  getPositionSharesForBins,
  prepareRemoveLiquidityDeltas,
  prepareCustomRemoveLiquidityDeltas,
  removeLiquidity,
  prepareRemoveLiquidityCalldata,
  NO_SLIPPAGE_LIMIT,
  type PreparedModifyLiquidity,
  type RemoveLiquidityParams,
  type BinRemovalSpec,
} from "./position/index.js";

// ============ Router Functions ============
export {
  swapExactInput,
  swapExactOutput,
  swapExactInputNativeForTokens,
  prepareSwapExactInputCalldata,
  prepareSwapExactOutputCalldata,
  prepareSwapExactInputNativeForTokensCalldata,
  type PreparedSwapTransaction,
} from "./router/index.js";
