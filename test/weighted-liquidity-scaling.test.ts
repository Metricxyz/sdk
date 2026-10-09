import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { scaleWeightedPoolDeltasToFitCaps } from "../src/pool/liquidityAddWeighted.js";

describe("weighted liquidity preview matches the pinned adder", async () => {
  const { viem } = await network.connect("hardhat");
  const adder = await viem.deployContract("LiquidityAdderScalingHarness");
  const weights = { binIdxs: [-1n, 0n], shares: [100n, 100n] };

  const cases = [
    { name: "both caps bind", need0: 200n, need1: 200n, max0: 200n, max1: 200n },
    { name: "token0 limits", need0: 200n, need1: 100n, max0: 200n, max1: 1_000n },
    { name: "token1 limits", need0: 100n, need1: 200n, max0: 1_000n, max1: 200n },
    { name: "only token0 is needed", need0: 200n, need1: 0n, max0: 200n, max1: 0n },
    { name: "only token1 is needed", need0: 0n, need1: 200n, max0: 0n, max1: 200n },
    { name: "caps below bin count stay intact", need0: 1n, need1: 1n, max0: 1n, max1: 1n },
    { name: "caps equal to bin count stay intact", need0: 1n, need1: 1n, max0: 2n, max1: 2n },
    {
      name: "caps just above bin count reserve headroom",
      need0: 1n,
      need1: 1n,
      max0: 3n,
      max1: 3n,
    },
    {
      name: "large 18-decimal amounts remain exact",
      need0: 2_000n * 10n ** 18n,
      need1: 2_000n * 10n ** 6n,
      max0: 2_000n * 10n ** 18n,
      max1: 2_000n * 10n ** 6n,
    },
  ];

  for (const { name, need0, need1, max0, max1 } of cases) {
    it(name, async () => {
      const expected = await adder.read.scale([weights, max0, max1, need0, need1]);
      const params = {
        weights,
        probeNeed0: need0,
        probeNeed1: need1,
        maxAmountToken0: max0,
        maxAmountToken1: max1,
      };
      const before = structuredClone(params);
      assert.deepEqual(scaleWeightedPoolDeltasToFitCaps(params), expected);
      assert.deepEqual(params, before, "preview must not mutate the execution weights or caps");
    });
  }

  it("reserves one base unit per bin before scaling", async () => {
    const expected = await adder.read.scale([weights, 200n, 200n, 200n, 200n]);
    assert.deepEqual(expected.shares, [99n, 99n]);
    assert.deepEqual(
      scaleWeightedPoolDeltasToFitCaps({
        weights,
        probeNeed0: 200n,
        probeNeed1: 200n,
        maxAmountToken0: 200n,
        maxAmountToken1: 200n,
      }).shares,
      expected.shares,
    );
  });

  it("rejects shares rounded to zero by the reserve", async () => {
    const tinyWeights = { binIdxs: [-1n, 0n], shares: [1n, 1n] };
    await assert.rejects(adder.read.scale([tinyWeights, 3n, 3n, 2n, 2n]), /SharesRoundedToZero/);
    assert.throws(
      () =>
        scaleWeightedPoolDeltasToFitCaps({
          weights: tinyWeights,
          probeNeed0: 2n,
          probeNeed1: 2n,
          maxAmountToken0: 3n,
          maxAmountToken1: 3n,
        }),
      /shares rounded to zero/,
    );
  });
});
