/**
 * MetricAMM SDK - Pool Functions
 */

// Pool creation
export {
  createPool,
  prepareFactoryCreatePoolParams,
  encodeCreatePoolCalldata,
  preparePoolBinData,
  type CreatePoolFactoryParams,
  type CreatePoolParams,
} from "./create.js";

// Pool read functions
export { getPoolImmutables, getPoolState, getBinState, getPositionBinShares } from "./read.js";

// Liquidity calculations and position operations
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
} from "./liquidity.js";
