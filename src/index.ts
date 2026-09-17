/**
 * MetricAMM SDK (v1 contracts: SimpleRouter, SwapQuoter, LiquidityAdder, add/removeLiquidity).
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
  MetricOmmSwapQuoterAbi,
  MetricOmmSimpleRouterAbi,
  MetricOmmPoolLiquidityAdderAbi,
  MetricOmmPoolFactoryAbi,
  DepositAllowlistExtensionAbi,
  SwapAllowlistExtensionAbi,
  PriceVelocityGuardExtensionAbi,
  OracleValueStopLossExtensionAbi,
  OracleProviderAbi,
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
  unpackPacked2Uint128,
  unpackPacked2Int128,
  unpackPackedSwapDetails,
  unpackBinSwappedEvent,
  unpackSwapEvent,
  type UnpackedPacked2Uint128,
  type UnpackedPacked2Int128,
  type UnpackedPackedSwapDetails,
  type UnpackedBinSwappedEvent,
  type UnpackedSwapEvent,
} from "./utils/index.js";

// ============ Pool Functions ============
export {
  createPool,
  prepareFactoryCreatePoolParams,
  computeMinimumOperationalLiquidity,
  encodeCreatePoolCalldata,
  preparePoolBinData,
  DISABLED_BID_ASK_REF_ASYMMETRY_X8,
  type CreatePoolFactoryParams,
  type CreatePoolParams,
  type ExtensionOrders,
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

export {
  prepareAddLiquidityExactSharesSelfSupportingNativePaymentCalldata,
  prepareAddLiquidityExactSharesWithOwnerSupportingNativePaymentCalldata,
  prepareAddLiquidityWeightedSelfSupportingNativePaymentCalldata,
  prepareAddLiquidityWeightedWithOwnerSupportingNativePaymentCalldata,
  UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS,
  type LiquidityCursorBounds,
  prepareLiquidityCursorBounds,
  computeLiquidityCursorBounds,
  cursorMovementToPositionDelta,
} from "./pool/index.js";

// ============ PeripheryPayments ============
export {
  encodeMulticallCalldata,
  encodeRefundETHCalldata,
  encodeUnwrapWETH9Calldata,
} from "./peripheryPayments/index.js";

// ============ Quoter Functions ============
export {
  quoteLiveExactInSingle,
  quoteLiveExactOutSingle,
  quoteLiveExactIn,
  quoteLiveExactOut,
  quoteHypotheticalExactInputSingle,
  quoteHypotheticalExactOutputSingle,
  quoteHypotheticalExactInput,
  quoteHypotheticalExactOutput,
  resolveQuoterAddress,
  defaultPriceLimitX64,
  type QuoteSwapResult,
  type QuoteLiveExactInSingleParams,
  type QuoteLiveExactOutSingleParams,
  type QuoteLiveExactInParams,
  type QuoteLiveExactOutParams,
  type QuoteHypotheticalExactInputSingleParams,
  type QuoteHypotheticalExactOutputSingleParams,
  type QuoteHypotheticalExactInputParams,
  type QuoteHypotheticalExactOutputParams,
} from "./quoter/index.js";

// ============ SimpleRouter Functions ============
export {
  buildExactInputSingleParams,
  buildExactOutputSingleParams,
  buildExactInputParams,
  buildExactOutputParams,
  encodeExactInputSingleCalldata,
  encodeExactOutputSingleCalldata,
  encodeExactInputCalldata,
  encodeExactOutputCalldata,
  encodeZeroForOneBitMap,
  prepareExactInputSingleCalldata,
  prepareExactOutputSingleCalldata,
  prepareExactInputCalldata,
  prepareExactOutputCalldata,
  prepareExactInputSingleAndUnwrapCalldata,
  prepareExactInputAndUnwrapCalldata,
  prepareExactInputSingleSupportingNativePaymentCalldata,
  prepareExactInputSupportingNativePaymentCalldata,
  prepareExactOutputSupportingNativePaymentCalldata,
  prepareExactOutputSingleSupportingNativePaymentCalldata,
  prepareExactOutputSingleAndUnwrapCalldata,
  prepareExactOutputAndUnwrapCalldata,
  type ExactInputSingleParams,
  type ExactOutputSingleParams,
  type ExactInputParams,
  type ExactOutputParams,
  type BuildExactInputSingleParams,
  type BuildExactOutputSingleParams,
  type BuildExactInputParams,
  type BuildExactOutputParams,
  prepareExactInputFromRoute,
  prepareExactOutputFromRoute,
  type TradeType,
  type RouteType,
  type RouteLegResponse,
  type RouteOptionResponse,
  type RouteResponse,
  type PrepareExactInputFromRouteParams,
  type PrepareExactOutputFromRouteParams,
  type PreparedExactInputFromRoute,
  type PreparedExactOutputFromRoute,
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

// ============ Oracle Functions (pool registration + blacklist) ============
export {
  getRegistrationFee,
  isPoolBlacklisted,
  isPoolRegistered,
  getPoolOracleStatus,
  registerPool,
  type PoolOracleStatus,
  type RegisterPoolParams,
  type RegisterPoolResult,
} from "./oracle/index.js";

// ============ Extension Functions ============
export {
  EMPTY_EXTENSION_DATA,
  EMPTY_EXTENSION_ORDERS,
  EMPTY_EXTENSION_INIT_DATA,
  encodeExtensionOrder,
  buildExtensionOrders,
  encodeOracleStopLossInitData,
  encodeSetAllowedToDepositCalldata,
  encodeSetAllowAllDepositorsCalldata,
  encodeSetAllowedToSwapCalldata,
  encodeSetAllowAllSwappersCalldata,
  encodeSetMaxChangePerBlockCalldata,
  encodeSetAnchorMidPriceCalldata,
  encodeProposeOracleStopLossTimelockCalldata,
  encodeExecuteOracleStopLossTimelockCalldata,
  encodeCancelOracleStopLossTimelockCalldata,
  encodeProposeOracleStopLossDrawdownCalldata,
  encodeExecuteOracleStopLossDrawdownCalldata,
  encodeCancelOracleStopLossDrawdownCalldata,
  encodeProposeOracleStopLossDecayCalldata,
  encodeExecuteOracleStopLossDecayCalldata,
  encodeCancelOracleStopLossDecayCalldata,
  encodeProposeOracleStopLossHighWatermarksCalldata,
  encodeExecuteOracleStopLossHighWatermarksCalldata,
  encodeCancelOracleStopLossHighWatermarksCalldata,
  STOP_LOSS_E6,
  STOP_LOSS_E18,
  computeOracleStopLossMetrics,
  isStopLossMetricBreached,
  secondsUntilStopLossClears,
  decayedHighWatermark,
  stopLossThreshold,
  recommendedInitialScaledAmounts,
  evaluateOracleStopLoss,
  getOracleStopLossConfig,
  getCurrentHighWatermarks,
  getOracleStopLossAnyBinStatus,
  type PoolExtensions,
  type ExtensionOrderAction,
  type OracleStopLossMetrics,
  type RecommendedInitialScaledAmounts,
  type OracleStopLossBinInput,
  type OracleStopLossBinStatus,
  type EvaluateOracleStopLossParams,
  type OracleStopLossEvaluation,
  type OracleStopLossConfig,
  type GetOracleStopLossAnyBinStatusParams,
  type OracleStopLossAnyBinStatus,
} from "./extensions/index.js";

export {
  encodeSequenceCalldata,
  OnStepSuccess,
  OnStepFailure,
  type SequenceCall,
} from "./router/sequence.js";
export {
  encodeExternalSwapCalldata,
  prepareExternalSwapCalldata,
  prepareExternalSwapSupportingNativePaymentCalldata,
  prepareExternalSwapAndUnwrapCalldata,
  type ExternalSwapParams,
} from "./router/externalSwap.js";
export {
  prepareExactInputWithExternalSwapFallbackCalldata,
  prepareExactInputSupportingNativePaymentWithExternalSwapFallbackCalldata,
  prepareExactInputAndUnwrapWithExternalSwapFallbackCalldata,
  prepareExactInputSingleWithExternalSwapFallbackCalldata,
  prepareExactInputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata,
  prepareExactInputSingleAndUnwrapWithExternalSwapFallbackCalldata,
  prepareExactOutputWithExternalSwapFallbackCalldata,
  prepareExactOutputSupportingNativePaymentWithExternalSwapFallbackCalldata,
  prepareExactOutputAndUnwrapWithExternalSwapFallbackCalldata,
  prepareExactOutputSingleWithExternalSwapFallbackCalldata,
  prepareExactOutputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata,
  prepareExactOutputSingleAndUnwrapWithExternalSwapFallbackCalldata,
  type ExternalSwapFallback,
} from "./router/fallbackSwap.js";
