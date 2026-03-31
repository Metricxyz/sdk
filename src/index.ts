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
  PositionBinSharesResult,
  CalculateUniformLiquidityParams,
  LiquidityBinValueInput as AnyLiquidityBinInput,
  CalculateAnyLiquidityParams,
  PreparedLiquidityDistribution,
  CalculatedLiquidityDistribution,
} from "./types.js";

// ============ Constants ============
export { Q64, MAX_UINT128, MAX_INT128, MAX_UINT104, MAX_INT104 } from "./constants.js";

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
  encodeCreatePoolCalldata,
  preparePoolBinData,
  type CreatePoolFactoryParams,
  type CreatePoolParams,
  // Pool read functions
  getPoolImmutables,
  getPoolState,
  getBinState,
  getPositionBinShares,
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

// ============ Liquidity Functions ============
export {
  buildModifyLiquidityArgsForAddition,
  buildModifyLiquidityArgsForUniformAddition,
  buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount,
  buildModifyLiquidityArgsForPercentageRemoval,
  buildModifyLiquidityArgsForRemoval,
  encodeModifyLiquidityCalldata,
  getPositionShares,
  getPositionSharesForBins,
  NO_SLIPPAGE_LIMIT,
  type ModifyLiquidityArgs,
  type BuildModifyLiquidityArgsBase,
  type BuildModifyLiquidityArgsForAdditionParams,
  type BuildModifyLiquidityArgsForUniformAdditionParams,
  type BuildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmountParams,
  type BuildModifyLiquidityArgsForPercentageRemovalParams,
  type BuildModifyLiquidityArgsForRemovalParams,
  type RemoveLiquidityParams,
  type BinRemovalSpec,
} from "./pool/liquidity.js";

// ============ Router Functions ============
export {
  buildArgsForSwapExactInput,
  buildArgsAndExpectedAmountsForSwapExactInput,
  quoteExpectedAmountsForSwapExactInput,
  buildArgsForSwapExactOutput,
  buildArgsAndExpectedAmountsForSwapExactOutput,
  quoteExpectedAmountsForSwapExactOutput,
  prepareSwapExactInputCalldata,
  prepareSwapExactOutputCalldata,
  prepareSwapExactInputNativeForTokensCalldata,
  type PreparedSwapTransaction,
  type BuildSwapExactInputParams,
  type QuoteExpectedAmountsForSwapExactInputParams,
  type BuildSwapExactOutputParams,
  type QuoteExpectedAmountsForSwapExactOutputParams,
  type SwapExactInputParams,
  type SwapExactOutputParams,
  type SwapExactInputArgs,
  type SwapExactOutputArgs,
} from "./router/index.js";

// ============ Factory Functions ============
export {
  getFactoryAssetBalances,
  collectFactoryFees,
  type FactoryAssetBalance,
  type CollectFactoryFeesParams,
  type CollectedFactoryFeeTx,
  type CollectFactoryFeesResult,
} from "./factory/index.js";
