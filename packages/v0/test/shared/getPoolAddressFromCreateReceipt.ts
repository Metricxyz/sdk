import { decodeEventLog, type Address } from "viem";
import * as sdk from "../../index.js";

export function getPoolAddressFromCreateReceipt(
  logs: readonly { data: `0x${string}`; topics: readonly `0x${string}`[] }[],
): Address {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: sdk.MetricOmmPoolFactoryAbi,
        data: log.data,
        topics: [...log.topics] as any,
      });

      if (decoded.eventName === "PoolCreated") {
        return (decoded.args as { pool: Address }).pool;
      }
    } catch {
      // Not a factory event, ignore.
    }
  }

  throw new Error("PoolCreated event not found in transaction logs");
}
