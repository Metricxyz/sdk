import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Address, PublicClient } from "viem";
import { encodeBinStateBytes32 } from "../src/utils/poolState.js";
import { getBinStatesScaled } from "../src/dataProvider/read.js";

describe("getBinStatesScaled", () => {
  it("decodes binStates bytes32[] and binTotalShares batch", async () => {
    const calls: { functionName: string; args: readonly unknown[] }[] = [];
    const pool = "0x2222222222222222222222222222222222222222" as Address;
    const dataProvider = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;

    const bin0 = encodeBinStateBytes32({
      token0BalanceScaled: 10n,
      token1BalanceScaled: 20n,
      lengthE6: 100,
      addFeeBuyE6: 0,
      addFeeSellE6: 0,
    });
    const bin1 = encodeBinStateBytes32({
      token0BalanceScaled: 0n,
      token1BalanceScaled: 30n,
      lengthE6: 100,
      addFeeBuyE6: 0,
      addFeeSellE6: 0,
    });
    const bin2 = encodeBinStateBytes32({
      token0BalanceScaled: 0n,
      token1BalanceScaled: 0n,
      lengthE6: 0,
      addFeeBuyE6: 0,
      addFeeSellE6: 0,
    });

    const publicClient = {
      readContract: async (req: { functionName: string; args: readonly unknown[] }) => {
        calls.push({ functionName: req.functionName, args: req.args });
        if (req.functionName === "binStates") {
          assert.deepEqual(req.args, [pool, [-1, 0, 2]]);
          return [bin0, bin1, bin2];
        }
        if (req.functionName === "binTotalShares") {
          assert.deepEqual(req.args, [pool, [-1, 0, 2]]);
          return [
            "0x0000000000000000000000000000000000000000000000000000000000000005",
            "0x000000000000000000000000000000000000000000000000000000000000000a",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          ];
        }
        throw new Error(`unexpected ${req.functionName}`);
      },
    } as unknown as PublicClient;

    const result = await getBinStatesScaled(publicClient, dataProvider, pool, [-1, 0, 2]);

    assert.deepEqual(
      calls.map((c) => c.functionName),
      ["binStates", "binTotalShares"],
    );
    assert.deepEqual(result.token0BalancesScaled, [10n, 0n, 0n]);
    assert.deepEqual(result.token1BalancesScaled, [20n, 30n, 0n]);
    assert.deepEqual(result.lengthsInUnits, [100, 100, 0]);
    assert.deepEqual(result.totalShares, [5n, 10n, 0n]);
  });

  it("returns empty arrays for empty bin list without RPC", async () => {
    let called = false;
    const publicClient = {
      readContract: async () => {
        called = true;
      },
    } as unknown as PublicClient;

    const result = await getBinStatesScaled(
      publicClient,
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "0x2222222222222222222222222222222222222222",
      [],
    );

    assert.equal(called, false);
    assert.deepEqual(result.totalShares, []);
  });
});
