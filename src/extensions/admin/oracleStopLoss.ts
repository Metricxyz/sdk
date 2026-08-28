import type { Address, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { OracleValueStopLossExtensionAbi } from "../../abis/OracleValueStopLossExtension.js";

export function encodeProposeOracleStopLossTimelockCalldata(params: {
  extension: Address;
  pool: Address;
  newTimelock: number;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "proposeOracleStopLossTimelock",
    args: [params.pool, params.newTimelock],
  });
}

export function encodeExecuteOracleStopLossTimelockCalldata(params: {
  extension: Address;
  pool: Address;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "executeOracleStopLossTimelock",
    args: [params.pool],
  });
}

export function encodeCancelOracleStopLossTimelockCalldata(params: {
  extension: Address;
  pool: Address;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "cancelOracleStopLossTimelock",
    args: [params.pool],
  });
}

export function encodeProposeOracleStopLossDrawdownCalldata(params: {
  extension: Address;
  pool: Address;
  newMaxDrawdownE6: bigint;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "proposeOracleStopLossDrawdown",
    args: [params.pool, params.newMaxDrawdownE6],
  });
}

export function encodeExecuteOracleStopLossDrawdownCalldata(params: {
  extension: Address;
  pool: Address;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "executeOracleStopLossDrawdown",
    args: [params.pool],
  });
}

export function encodeCancelOracleStopLossDrawdownCalldata(params: {
  extension: Address;
  pool: Address;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "cancelOracleStopLossDrawdown",
    args: [params.pool],
  });
}

export function encodeProposeOracleStopLossDecayCalldata(params: {
  extension: Address;
  pool: Address;
  newDecayPerSecondE18: bigint;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "proposeOracleStopLossDecay",
    args: [params.pool, params.newDecayPerSecondE18],
  });
}

export function encodeExecuteOracleStopLossDecayCalldata(params: {
  extension: Address;
  pool: Address;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "executeOracleStopLossDecay",
    args: [params.pool],
  });
}

export function encodeCancelOracleStopLossDecayCalldata(params: {
  extension: Address;
  pool: Address;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "cancelOracleStopLossDecay",
    args: [params.pool],
  });
}

export function encodeProposeOracleStopLossHighWatermarksCalldata(params: {
  extension: Address;
  pool: Address;
  binIdx: number;
  newHwmToken0: bigint;
  newHwmToken1: bigint;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "proposeOracleStopLossHighWatermarks",
    args: [params.pool, params.binIdx, params.newHwmToken0, params.newHwmToken1],
  });
}

export function encodeExecuteOracleStopLossHighWatermarksCalldata(params: {
  extension: Address;
  pool: Address;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "executeOracleStopLossHighWatermarks",
    args: [params.pool],
  });
}

export function encodeCancelOracleStopLossHighWatermarksCalldata(params: {
  extension: Address;
  pool: Address;
}): Hex {
  return encodeFunctionData({
    abi: OracleValueStopLossExtensionAbi,
    functionName: "cancelOracleStopLossHighWatermarks",
    args: [params.pool],
  });
}
