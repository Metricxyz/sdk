import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MetricOmmPoolAbi, MetricOmmPoolFactoryAbi } from "../src/abis/index.js";

function hasAbiItem(abi: readonly { name?: string; type: string }[], type: string, name: string) {
  return abi.some((item) => item.type === type && item.name === name);
}

describe("latest Metric contract ABIs", () => {
  it("exposes the new pool fee-transfer event and liquidity overflow error", () => {
    assert.equal(hasAbiItem(MetricOmmPoolAbi, "event", "FeeTransferFailed"), true);
    assert.equal(hasAbiItem(MetricOmmPoolAbi, "error", "SharesAmountTooLarge"), true);
  });

  it("drops the obsolete factory fee-collection failure event", () => {
    assert.equal(hasAbiItem(MetricOmmPoolFactoryAbi, "event", "PoolCollectFeeFailed"), false);
  });
});
