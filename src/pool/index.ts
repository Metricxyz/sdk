/**
 * MetricAMM SDK - Pool Functions
 */

// Pool creation
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
} from "./create.js";

// Pool read functions
export {
  getPoolImmutables,
  getPoolFeeConfig,
  getPoolState,
  getBinState,
  getPositionBinShares,
} from "./read.js";

// Liquidity calculations and position operations
export {
  buildModifyLiquidityArgsForPercentageRemoval,
  buildModifyLiquidityArgsForRemoval,
  buildRemoveLiquidityPoolDelta,
  additionPlanToPoolLiquidityDelta,
  removalPlanToPoolLiquidityDelta,
  encodeRemoveLiquidityCalldata,
  UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS,
  type LiquidityCursorBounds,
  getPositionShares,
  getPositionSharesForBins,
  NO_SLIPPAGE_LIMIT,
  type ModifyLiquidityArgs,
  type BuildModifyLiquidityArgsBase,
  type BuildModifyLiquidityArgsForPercentageRemovalParams,
  type BuildModifyLiquidityArgsForRemovalParams,
  type RemoveLiquidityParams,
  type BinRemovalSpec,
} from "./liquidity.js";

export {
  buildModifyLiquidityArgsForAddition,
  buildModifyLiquidityArgsForUniformAddition,
  buildAddLiquidityExactSharesParamsFromBinTargets,
  encodeAddLiquidityExactSharesSelfCalldata,
  encodeAddLiquidityExactSharesWithOwnerCalldata,
  type BuildModifyLiquidityArgsForAdditionParams,
  type BuildModifyLiquidityArgsForUniformAdditionParams,
} from "./liquidityAddExactShares.js";

export {
  buildAddLiquidityWeightedParams,
  type BuildAddLiquidityWeightedParamsParams,
  type AddLiquidityWeightedParams,
  scaleWeightedPoolDeltasToFitCaps,
  encodeAddLiquidityWeightedSelfCalldata,
  encodeAddLiquidityWeightedWithOwnerCalldata,
} from "./liquidityAddWeighted.js";

export {
  prepareAddLiquidityExactSharesSelfSupportingNativePaymentCalldata,
  prepareAddLiquidityExactSharesWithOwnerSupportingNativePaymentCalldata,
  prepareAddLiquidityWeightedSelfSupportingNativePaymentCalldata,
  prepareAddLiquidityWeightedWithOwnerSupportingNativePaymentCalldata,
} from "./nativeLiquidity.js";

export {
  prepareLiquidityCursorBounds,
  computeLiquidityCursorBounds,
  type ComputeLiquidityCursorBoundsParams,
} from "./cursorBounds.js";
