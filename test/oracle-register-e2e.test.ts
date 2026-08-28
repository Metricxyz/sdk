import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import type { Address, Hex } from "viem";
import * as sdk from "../src/index.js";

// E2E for the providers-oracle registration flow: deploy a faithful registration oracle + pool factory
// on the hardhat EVM, then drive the SDK's registerPool/status helpers end-to-end (real txs, real value
// transfer, real receipts, real post-state reads).
describe("registerPool E2E (providers oracle)", async () => {
  const { viem } = (await network.connect("hardhat")) as any;
  // account 0 is the implicit deployer/sender for contract setup writes; payer registers the pool.
  const [, payer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const pool = "0x2222222222222222222222222222222222222222" as Address;
  const fee = 1_000_000_000_000_000n; // 0.001 ETH
  const feedId = `0x${"ab".repeat(32)}` as Hex;

  async function deploySetup() {
    const oracle = await viem.deployContract("MockRegistrationOracle", []);
    const factory = await viem.deployContract("MockPoolFactory", []);
    await oracle.write.setRegistrationFee([fee]);
    await oracle.write.setApprovedFactory([factory.address, true]);
    await factory.write.setPool([pool, true]);
    return { oracle, factory };
  }

  it("registers a pool: pays the fee, clears blacklist, flips registered status", async () => {
    const { oracle, factory } = await deploySetup();
    // Start blacklisted to prove registration clears it (as OracleBase.register does).
    await oracle.write.setBlacklist([pool, true]);

    // Pre-state via SDK reads. (getPoolOracleStatus uses viem multicall / Multicall3, which the bare
    // hardhat chain doesn't deploy — that path is covered by the unit test; here we use single reads.)
    assert.equal(await sdk.getRegistrationFee(publicClient, oracle.address), fee);
    assert.equal(await sdk.isPoolRegistered(publicClient, oracle.address, feedId, pool), false);
    assert.equal(await sdk.isPoolBlacklisted(publicClient, oracle.address, pool), true);

    // Register via the SDK (value defaults to the live registrationFee).
    const { hash, receipt } = await sdk.registerPool({
      publicClient,
      walletClient: payer,
      oracleAddress: oracle.address,
      feedId,
      pool,
      factory: factory.address,
      account: payer.account.address,
    });
    assert.ok(hash, "tx hash returned");
    assert.equal(receipt?.status, "success", "register tx succeeded");

    // Post-state: registered + blacklist cleared.
    assert.equal(await sdk.isPoolRegistered(publicClient, oracle.address, feedId, pool), true);
    assert.equal(await sdk.isPoolBlacklisted(publicClient, oracle.address, pool), false);
  });

  it("honors an explicit value and registers without a prior blacklist", async () => {
    const { oracle, factory } = await deploySetup();

    const { receipt } = await sdk.registerPool({
      publicClient,
      walletClient: payer,
      oracleAddress: oracle.address,
      feedId,
      pool,
      factory: factory.address,
      account: payer.account.address,
      value: fee, // explicit, equal to required
    });
    assert.equal(receipt?.status, "success");
    assert.equal(await sdk.isPoolRegistered(publicClient, oracle.address, feedId, pool), true);
  });

  it("reverts when the factory is not approved on the oracle", async () => {
    const oracle = await viem.deployContract("MockRegistrationOracle", []);
    const factory = await viem.deployContract("MockPoolFactory", []);
    await oracle.write.setRegistrationFee([fee]);
    await factory.write.setPool([pool, true]);
    // factory deliberately NOT approved

    await assert.rejects(
      sdk.registerPool({
        publicClient,
        walletClient: payer,
        oracleAddress: oracle.address,
        feedId,
        pool,
        factory: factory.address,
        account: payer.account.address,
      }),
    );
  });
});
