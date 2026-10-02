/**
 * Forked-chain regression for the SPCX/USDG Max deposit on Robinhood (block 77372562,
 * state captured in fixtures/spcx-liquidity-snapshot.json). Sends a real weighted add
 * with exactly the SPCX budget in the wallet. Skipped unless ROBINHOOD_RPC_URL points
 * at an archive node.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { network } from "hardhat";
import {
  encodeAbiParameters,
  erc20Abi,
  keccak256,
  maxUint256,
  parseEther,
  toHex,
  type Address,
  type Hex,
} from "viem";
import * as sdk from "../src/index.js";

const snapshot = JSON.parse(
  readFileSync(new URL("./fixtures/spcx-liquidity-snapshot.json", import.meta.url), "utf8"),
  (_, value) =>
    value && typeof value === "object" && "bigint" in value ? BigInt(value.bigint) : value,
);
const immutables = snapshot.records.find(
  (r: { functionName: string }) => r.functionName === "getImmutables",
).result;
const snapshotSlot0 = snapshot.records.find(
  (r: { functionName: string }) => r.functionName === "slot0",
).result;

const OZ_ERC20_STORAGE_SLOT = 0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00n;
const LP = "0x00000000000000000000000000000000005bC0de" as Address;

describe("SPCX Max deposit on a Robinhood fork", { skip: !process.env.ROBINHOOD_RPC_URL }, () => {
  it("deposits the whole 132.41178045 SPCX balance at the snapshot block", async () => {
    const { viem, networkHelpers } = await network.connect({ network: "robinhoodFork" });
    const publicClient = await viem.getPublicClient();
    const addresses = sdk.getAddressesOrThrow(4663);
    const pool = snapshot.poolAddress as Address;
    const spcx = immutables.token0 as Address;
    const usdg = immutables.token1 as Address;
    const budgetSpcx = BigInt(snapshot.sourceAmount);
    const usdgBalance = 1_000_000_000_000n;

    const balanceOf = (token: Address) =>
      publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [LP],
      });

    async function setErc20Balance(token: Address, amount: bigint) {
      const mappingSlots = [...Array(20).keys()].map(BigInt).concat(OZ_ERC20_STORAGE_SLOT);
      for (const mappingSlot of mappingSlots) {
        const slot = keccak256(
          encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [LP, mappingSlot]),
        );
        const original = (await publicClient.getStorageAt({ address: token, slot })) ?? "0x0";
        await networkHelpers.setStorageAt(token, slot, toHex(amount, { size: 32 }));
        if ((await balanceOf(token)) === amount) return;
        await networkHelpers.setStorageAt(token, slot, original as Hex);
      }
      throw new Error(`could not locate the balance slot of ${token}`);
    }

    const slot0 = await sdk.getSlot0(publicClient, addresses.dataProvider, pool);
    assert.equal(slot0.curBinIdx, snapshotSlot0[1], "fork is not at the snapshot state");
    assert.equal(slot0.curPosInBin, snapshotSlot0[2], "fork is not at the snapshot state");

    await networkHelpers.impersonateAccount(LP);
    await networkHelpers.setBalance(LP, parseEther("10"));
    await setErc20Balance(spcx, budgetSpcx);
    await setErc20Balance(usdg, usdgBalance);
    const lp = await viem.getWalletClient(LP);
    for (const token of [spcx, usdg]) {
      await lp.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [addresses.liquidityAdder, maxUint256],
      });
    }

    const params = await sdk.buildAddLiquidityWeightedParams({
      publicClient,
      factoryAddress: addresses.factory,
      dataProviderAddress: addresses.dataProvider,
      poolAddress: pool,
      bins: snapshot.bins,
      currentPriceX64: BigInt(snapshot.currentPriceX64),
      maxAmountToken0: budgetSpcx,
      maxAmountToken1: usdgBalance,
      maximalCursorMovement: 0.1,
    });
    const hash = await lp.sendTransaction({
      to: addresses.liquidityAdder,
      data: sdk.encodeAddLiquidityWeightedSelfCalldata({ pool, ...params }),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");

    const spentSpcx = budgetSpcx - (await balanceOf(spcx));
    assert.ok(
      spentSpcx * 1000n >= budgetSpcx * 999n,
      `spent ${spentSpcx} SPCX wei, far below the ${budgetSpcx} budget`,
    );
    assert.ok(usdgBalance - (await balanceOf(usdg)) > 0n);
  });
});
