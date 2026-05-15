/**
 * Integration checks against a pinned Ethereum mainnet fork.
 *
 * Env (fork suite runs only when ETHEREUM_RPC_URL or MAINNET_RPC_URL is set):
 * - ETHEREUM_RPC_URL or MAINNET_RPC_URL — required for fork tests to run (otherwise the suite is skipped)
 * - ETHEREUM_FORK_BLOCK_NUMBER — optional; when unset, forks at the RPC’s **latest** mainnet block (same as Hardhat omitting `blockNumber`). Set to pin for reproducible CI.
 * - V1_ETHEREUM_TEST_POOL — optional pool address; when set, runs StateView deploy + pool reads + quoteSwap smoke
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, isAddress, type Address } from "viem";
import * as sdk from "../src/index.js";

const FORK = "ethereum-mainnet-fork" as const;

const allowlistFactoryAbi = [
  {
    type: "function",
    name: "FACTORY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address", name: "" }],
  },
] as const;

const hasForkRpc = Boolean(
  process.env.ETHEREUM_RPC_URL?.trim() || process.env.MAINNET_RPC_URL?.trim(),
);

describe("Ethereum mainnet fork — v1 SDK + deployments", { skip: !hasForkRpc }, async () => {
  const { viem } = await network.connect(FORK);
  const publicClient = await viem.getPublicClient();

  it("fork head matches pinned block when ETHEREUM_FORK_BLOCK_NUMBER is set", async () => {
    const raw = process.env.ETHEREUM_FORK_BLOCK_NUMBER;
    if (raw == null || raw === "" || !Number.isFinite(Number(raw))) {
      return;
    }
    const want = BigInt(raw);
    const head = await publicClient.getBlockNumber();
    assert.equal(head, want);
  });

  it("pins chain id to Ethereum mainnet", async () => {
    const id = await publicClient.getChainId();
    assert.equal(id, sdk.ChainId.ETHEREUM);
  });

  it("exposes only Ethereum in ADDRESSES and getAddressesOrThrow(1)", () => {
    assert.deepEqual(sdk.getSupportedChainIds(), [sdk.ChainId.ETHEREUM]);
    const a = sdk.getAddressesOrThrow(sdk.ChainId.ETHEREUM);
    assert.ok(isAddress(a.factory));
    assert.throws(() => sdk.getAddressesOrThrow(8453), /Chain 8453/);
  });

  it("has contract bytecode at every bundled v1 address + WETH", async () => {
    const a = sdk.getAddressesOrThrow(sdk.ChainId.ETHEREUM);
    const addrs: Address[] = [
      a.factory,
      a.poolDeployer,
      a.liquidityAdder,
      a.swapDataProvider,
      a.depositAllowlist,
      a.swapAllowlist,
      a.swapper,
      a.wrappedNative,
    ];
    for (const addr of addrs) {
      const code = await publicClient.getCode({ address: addr });
      assert.ok(code && code !== "0x", `no code at ${addr}`);
    }
  });

  it("factory.poolDeployer matches bundled pool deployer", async () => {
    const a = sdk.getAddressesOrThrow(sdk.ChainId.ETHEREUM);
    const pd = (await publicClient.readContract({
      address: a.factory,
      abi: sdk.MetricOmmPoolFactoryAbi,
      functionName: "poolDeployer",
    })) as Address;
    assert.equal(getAddress(pd), getAddress(a.poolDeployer));
  });

  it("allowlist contracts point at the bundled factory", async () => {
    const a = sdk.getAddressesOrThrow(sdk.ChainId.ETHEREUM);
    const depF = (await publicClient.readContract({
      address: a.depositAllowlist,
      abi: allowlistFactoryAbi,
      functionName: "FACTORY",
    })) as Address;
    const swapF = (await publicClient.readContract({
      address: a.swapAllowlist,
      abi: allowlistFactoryAbi,
      functionName: "FACTORY",
    })) as Address;
    assert.equal(getAddress(depF), getAddress(a.factory));
    assert.equal(getAddress(swapF), getAddress(a.factory));
  });

  it("optional pool: getPoolImmutables, StateView reads, quoteSwap", async function () {
    const raw = process.env.V1_ETHEREUM_TEST_POOL?.trim();
    if (!raw || !isAddress(raw)) {
      this.skip();
      return;
    }
    const pool = getAddress(raw) as Address;
    const a = sdk.getAddressesOrThrow(sdk.ChainId.ETHEREUM);

    const imm = await sdk.getPoolImmutables(publicClient, a.factory, pool);
    assert.ok(isAddress(imm.token0));
    assert.ok(isAddress(imm.token1));

    const stateView = await viem.deployContract("MetricOmmPoolStateView", [a.factory]);
    const stateViewAddr = stateView.address as Address;

    const slot0 = await sdk.getSlot0(publicClient, stateViewAddr, pool);
    assert.ok(Number.isFinite(slot0.curBinIdx));

    const q = await sdk.quoteSwap({
      publicClient,
      swapperAddress: a.swapper,
      pool,
      zeroForOne: true,
      amountSpecified: 1n,
    });
    assert.ok(typeof q.amountIn === "bigint");
    assert.ok(typeof q.amountOut === "bigint");
  });
});
