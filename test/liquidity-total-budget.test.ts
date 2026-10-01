import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Address, PublicClient, ReadContractParameters } from "viem";
import { buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount as build } from "../src/pool/liquidity.js";

// Read-only Robinhood SPCX/USDG snapshot at block 77372562. No network or wallet.
const snapshot = JSON.parse(
  readFileSync(new URL("./fixtures/spcx-liquidity-snapshot.json", import.meta.url), "utf8"),
  (_, value) =>
    value && typeof value === "object" && "bigint" in value ? BigInt(value.bigint) : value,
);

function fixture(token0 = true) {
  const reads: ReadContractParameters[] = [];
  const readContract = async (args: ReadContractParameters) => {
    reads.push(args);
    const record = snapshot.records.find(
      (entry: { functionName: string }) => entry.functionName === args.functionName,
    );
    assert.ok(record, `Unexpected read ${args.functionName}`);
    return record.result;
  };
  const publicClient = {
    getBlockNumber: async () => BigInt(snapshot.blockNumber),
    readContract,
  } as unknown as PublicClient;
  return {
    reads,
    params: {
      publicClient,
      factoryAddress: snapshot.poolAddress as Address,
      dataProviderAddress: snapshot.poolAddress as Address,
      poolAddress: snapshot.poolAddress as Address,
      bins: snapshot.bins as number[],
      totalValueToAddInToken: token0 ? BigInt(snapshot.sourceAmount) : 83225472700n,
      totalValueInToken0: token0,
      currentPriceX64: BigInt(snapshot.currentPriceX64),
    },
  };
}

describe("total-token liquidity budget", () => {
  it("keeps SPCX Max inside its exact budget despite per-bin rounding", async () => {
    const { params, reads } = fixture();
    const result = await build(params);
    // Before the fix: 132411780450056657798, exceeding the source by 56657798 wei.
    assert.ok(result[2] <= params.totalValueToAddInToken);
    assert.ok(params.totalValueToAddInToken - result[2] < 1000000000n);
    assert.equal(result[1].length, params.bins.length);
    assert.ok(result[1].every((delta) => delta.deltaShares > 0n));
    // Recompute the required token amounts from the captured populated-bin
    // balances and returned shares using the contract's ceiling divisions.
    // This fails if only spec caps were clipped while shares stayed too large.
    const immutables = snapshot.records.find(
      (r: { functionName: string }) => r.functionName === "getImmutables",
    ).result;
    const packed = snapshot.records.find(
      (r: { functionName: string }) => r.functionName === "binStates",
    ).result as string[];
    const shares = snapshot.records.find(
      (r: { functionName: string }) => r.functionName === "binTotalShares",
    ).result as string[];
    const ceil = (n: bigint, d: bigint) => (n + d - 1n) / d;
    const mask = (1n << 104n) - 1n;
    for (const side of [0, 1]) {
      const scale = BigInt(
        side === 0 ? immutables.token0ScaleMultiplier : immutables.token1ScaleMultiplier,
      );
      const required = result[1].reduce((sum, delta, i) => {
        const balance = (BigInt(packed[i]) >> BigInt(side * 104)) & mask;
        return sum + ceil(ceil(delta.deltaShares * balance, BigInt(shares[i])), scale);
      }, 0n);
      assert.equal(result[side === 0 ? 2 : 3], required);
    }

    // Calibration and correction read the same state once, even across blocks.
    assert.equal(reads.length, 4);
    assert.ok(reads.every((args) => args.blockNumber === BigInt(snapshot.blockNumber)));
  });

  for (const token0 of [true, false]) {
    for (const weighted of [true, false]) {
      for (const buffer of [0, 0.1, 1, 100]) {
        it(`fits source token${token0 ? 0 : 1}, weighted=${weighted}, buffer=${buffer}%`, async () => {
          const { params } = fixture(token0);
          const result = await build({
            ...params,
            weights: weighted ? params.bins.map((_, index) => index + 1) : undefined,
            specAmountBufferPercent: buffer,
          });
          const spec = result[token0 ? 2 : 3];
          assert.ok(spec > 0n);
          assert.ok(spec <= params.totalValueToAddInToken);
          assert.ok(spec * 100n >= params.totalValueToAddInToken * 98n);
        });
      }
    }
  }

  it("preserves an already affordable USDG result", async () => {
    const { params } = fixture(false);
    const result = await build(params);
    assert.equal(result[3], 83225472689n);
  });

  it("does not cap the opposite token at an unrelated wallet balance", async () => {
    const { params } = fixture();
    const result = await build(params);
    assert.ok(result[3] > 1000000n);
  });

  it("rejects a source budget too small to cover the selected bins", async () => {
    const { params } = fixture(false);
    await assert.rejects(build({ ...params, totalValueToAddInToken: 1n }), /too small|must be > 0/);
  });
});
