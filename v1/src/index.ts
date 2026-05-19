/**
 * MetricAMM SDK (v1 contracts: Swapper, LiquidityAdder, add/removeLiquidity).
 *
 * @packageDocumentation
 */

// ============ Types ============
export type {
  LiquidityDelta,
  PoolLiquidityDelta,
  BinData,
  PoolImmutables,
  PoolState,
  BinState,
  BinStateExternal,
  BinStatesExternal,
  BinStatesScaled,
  Slot0,
  Slot1,
  PoolFeeConfig,
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
  type DeployedChainId,
} from "./addresses.js";

// ============ ABIs ============
export {
  MetricOmmPoolAbi,
  MetricOmmPoolDataProviderAbi,
  MetricOmmPoolSwapperAbi,
  MetricOmmPoolLiquidityAdderAbi,
  MetricOmmPoolFactoryAbi,
} from "./abis/index.js";

// ============ Utils ============
export {
  packBinData,
  packBins5,
  packBinDataArray,
  unpackBinData,
  createBins,
  createUniformBins,
  priceToQ64,
  q64ToPrice,
} from "./utils/index.js";

// ============ Pool Functions ============
export {
  createPool,
  prepareFactoryCreatePoolParams,
  encodeCreatePoolCalldata,
  preparePoolBinData,
  type CreatePoolFactoryParams,
  type CreatePoolParams,
  getPoolImmutables,
  getPoolFeeConfig,
  getPoolState,
  getBinState,
  getPositionBinShares,
} from "./pool/index.js";

// ============ DataProvider read functions ============
export {
  getSlot0,
  getSlot1,
  getBinStateExternal,
  getBinStatesExternal,
  getBinStatesScaled,
  getBinTotalShares,
  getPositionBinSharesFromDataProvider,
  getPositionBinSharesFromStateView,
  toPositionBinKey,
  getPositionBinSharesRange,
  getPriceProvider,
} from "./dataProvider/index.js";

// ============ Liquidity Functions ============
export {
  buildModifyLiquidityArgsForAddition,
  buildModifyLiquidityArgsForUniformAddition,
  buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount,
  buildModifyLiquidityArgsForPercentageRemoval,
  buildModifyLiquidityArgsForRemoval,
  buildAddLiquidityExactSharesParamsFromBinTargets,
  buildRemoveLiquidityPoolDelta,
  additionPlanToPoolLiquidityDelta,
  removalPlanToPoolLiquidityDelta,
  scaleWeightedPoolDeltasToFitCaps,
  encodeAddLiquidityExactSharesSelfCalldata,
  encodeAddLiquidityExactSharesWithOwnerCalldata,
  encodeAddLiquidityWeightedSelfCalldata,
  encodeAddLiquidityWeightedWithOwnerCalldata,
  encodeRemoveLiquidityCalldata,
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

// ============ Swapper Functions ============
export {
  buildArgsForSwapExactInput,
  buildArgsAndExpectedAmountsForSwapExactInput,
  quoteExpectedAmountsForSwapExactInput,
  buildArgsForSwapExactOutput,
  buildArgsAndExpectedAmountsForSwapExactOutput,
  quoteExpectedAmountsForSwapExactOutput,
  encodeSwapExactInputCalldata,
  encodeSwapExactOutputCalldata,
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
