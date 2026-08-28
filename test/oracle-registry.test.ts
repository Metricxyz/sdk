import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Address, Hex, PublicClient, WalletClient } from "viem";
import {
  getRegistrationFee,
  isPoolBlacklisted,
  isPoolRegistered,
  getPoolOracleStatus,
  registerPool,
} from "../src/oracle/registry.js";

const oracle = "0x1111111111111111111111111111111111111111" as Address;
const pool = "0x2222222222222222222222222222222222222222" as Address;
const factory = "0x3333333333333333333333333333333333333333" as Address;
const account = "0x4444444444444444444444444444444444444444" as Address;
const feedId = `0x${"ab".repeat(32)}` as Hex;
const txHash = `0x${"cd".repeat(32)}` as Hex;

describe("oracle registry reads", () => {
  it("getRegistrationFee reads registrationFee()", async () => {
    const publicClient = {
      readContract: async (req: { address: Address; functionName: string }) => {
        assert.equal(req.address, oracle);
        assert.equal(req.functionName, "registrationFee");
        return 1234n;
      },
    } as unknown as PublicClient;

    assert.equal(await getRegistrationFee(publicClient, oracle), 1234n);
  });

  it("isPoolBlacklisted reads blacklisted(account)", async () => {
    const publicClient = {
      readContract: async (req: { functionName: string; args?: readonly unknown[] }) => {
        assert.equal(req.functionName, "blacklisted");
        assert.deepEqual(req.args, [pool]);
        return true;
      },
    } as unknown as PublicClient;

    assert.equal(await isPoolBlacklisted(publicClient, oracle, pool), true);
  });

  it("isPoolRegistered reads registeredPool(feedId, pool)", async () => {
    const publicClient = {
      readContract: async (req: { functionName: string; args?: readonly unknown[] }) => {
        assert.equal(req.functionName, "registeredPool");
        assert.deepEqual(req.args, [feedId, pool]);
        return true;
      },
    } as unknown as PublicClient;

    assert.equal(await isPoolRegistered(publicClient, oracle, feedId, pool), true);
  });

  it("getPoolOracleStatus multicalls registeredPool/blacklisted/registrationFee", async () => {
    const publicClient = {
      multicall: async (req: { contracts: { functionName: string }[] }) => {
        assert.deepEqual(
          req.contracts.map((c) => c.functionName),
          ["registeredPool", "blacklisted", "registrationFee"],
        );
        return [true, false, 5000n];
      },
    } as unknown as PublicClient;

    const status = await getPoolOracleStatus(publicClient, oracle, feedId, pool);
    assert.deepEqual(status, { registered: true, blacklisted: false, registrationFee: 5000n });
  });
});

describe("oracle registry registerPool", () => {
  it("defaults value to registrationFee, simulates+writes, awaits receipt", async () => {
    const calls: string[] = [];
    const publicClient = {
      readContract: async (req: { functionName: string }) => {
        calls.push(`read:${req.functionName}`);
        return 777n; // registrationFee
      },
      simulateContract: async (req: {
        functionName: string;
        args?: readonly unknown[];
        value?: bigint;
        account?: Address;
      }) => {
        calls.push(`sim:${req.functionName}`);
        assert.equal(req.functionName, "register");
        assert.deepEqual(req.args, [feedId, pool, factory]);
        assert.equal(req.value, 777n);
        assert.equal(req.account, account);
        return { request: { mock: true } };
      },
      waitForTransactionReceipt: async (req: { hash: Hex }) => {
        calls.push("receipt");
        assert.equal(req.hash, txHash);
        return { status: "success", transactionHash: txHash };
      },
    } as unknown as PublicClient;

    const walletClient = {
      writeContract: async (request: unknown) => {
        calls.push("write");
        assert.deepEqual(request, { mock: true });
        return txHash;
      },
    } as unknown as WalletClient;

    const result = await registerPool({
      publicClient,
      walletClient,
      oracleAddress: oracle,
      feedId,
      pool,
      factory,
      account,
    });

    assert.equal(result.hash, txHash);
    assert.ok(result.receipt);
    assert.deepEqual(calls, ["read:registrationFee", "sim:register", "write", "receipt"]);
  });

  it("uses explicit value and skips receipt when awaitReceipt=false", async () => {
    let readCalled = false;
    let waited = false;
    const publicClient = {
      readContract: async () => {
        readCalled = true;
        return 0n;
      },
      simulateContract: async (req: { value?: bigint }) => {
        assert.equal(req.value, 42n);
        return { request: {} };
      },
      waitForTransactionReceipt: async () => {
        waited = true;
        return {};
      },
    } as unknown as PublicClient;

    const walletClient = {
      writeContract: async () => txHash,
    } as unknown as WalletClient;

    const result = await registerPool({
      publicClient,
      walletClient,
      oracleAddress: oracle,
      feedId,
      pool,
      factory,
      account,
      value: 42n,
      awaitReceipt: false,
    });

    assert.equal(result.hash, txHash);
    assert.equal(result.receipt, undefined);
    assert.equal(readCalled, false, "explicit value must skip registrationFee read");
    assert.equal(waited, false, "awaitReceipt=false must skip receipt");
  });
});
