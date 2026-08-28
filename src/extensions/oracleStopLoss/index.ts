/**
 * OracleValueStopLossExtension helpers: pure math, offline evaluation, and pool status reads.
 */

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
  type OracleStopLossMetrics,
  type RecommendedInitialScaledAmounts,
} from "./math.js";

export {
  evaluateOracleStopLoss,
  type OracleStopLossBinInput,
  type OracleStopLossBinStatus,
  type EvaluateOracleStopLossParams,
  type OracleStopLossEvaluation,
} from "./evaluate.js";

export {
  getOracleStopLossConfig,
  getCurrentHighWatermarks,
  getOracleStopLossAnyBinStatus,
  type OracleStopLossConfig,
  type GetOracleStopLossAnyBinStatusParams,
  type OracleStopLossAnyBinStatus,
} from "./read.js";
