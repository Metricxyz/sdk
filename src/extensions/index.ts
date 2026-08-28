export {
  EMPTY_EXTENSION_DATA,
  EMPTY_EXTENSION_ORDERS,
  type ExtensionOrders,
  type PoolExtensions,
} from "./types.js";

export { encodeExtensionOrder, buildExtensionOrders, type ExtensionOrderAction } from "./orders.js";

export { EMPTY_EXTENSION_INIT_DATA, encodeOracleStopLossInitData } from "./init/index.js";

export {
  encodeSetAllowedToDepositCalldata,
  encodeSetAllowAllDepositorsCalldata,
} from "./admin/depositAllowlist.js";
export {
  encodeSetAllowedToSwapCalldata,
  encodeSetAllowAllSwappersCalldata,
} from "./admin/swapAllowlist.js";
export {
  encodeSetMaxChangePerBlockCalldata,
  encodeSetAnchorMidPriceCalldata,
} from "./admin/priceVelocityGuard.js";
export {
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
} from "./admin/oracleStopLoss.js";

export {
  STOP_LOSS_E6,
  STOP_LOSS_E18,
  STOP_LOSS_METRIC_SCALE,
  STOP_LOSS_METRIC_MAX,
  mulDiv,
  clampStopLossMetric,
  decayedHighWatermark,
  stopLossThreshold,
  computeOracleStopLossMetrics,
  isStopLossMetricBreached,
  secondsUntilStopLossClears,
  recommendedInitialScaledAmounts,
  evaluateOracleStopLoss,
  getOracleStopLossConfig,
  getCurrentHighWatermarks,
  getOracleStopLossAnyBinStatus,
  type OracleStopLossMetrics,
  type RecommendedInitialScaledAmounts,
  type OracleStopLossBinInput,
  type OracleStopLossBinStatus,
  type EvaluateOracleStopLossParams,
  type OracleStopLossEvaluation,
  type OracleStopLossConfig,
  type GetOracleStopLossAnyBinStatusParams,
  type OracleStopLossAnyBinStatus,
} from "./oracleStopLoss/index.js";
