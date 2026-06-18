/**
 * MetricAMM SDK - Providers oracle (pool registration + blacklist).
 */

export {
  getRegistrationFee,
  isPoolBlacklisted,
  isPoolRegistered,
  getPoolOracleStatus,
  registerPool,
  type PoolOracleStatus,
  type RegisterPoolParams,
  type RegisterPoolResult,
} from "./registry.js";
