import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeFunctionData, type PublicClient } from "viem";
import { network } from "hardhat";
import {
  estimateCreatePoolGas,
  encodeCreatePoolCalldata,
  createUniformBins,
  DISABLED_BID_ASK_REF_ASYMMETRY_X8,
  type CreatePoolFactoryParams,
} from "../src/index.js";
import { POOL_FACTORY_ABI } from "../src/constants.js";
import { deployMetricTestEnv } from "./shared/testEnv.js";

const factory = "0x1111111111111111111111111111111111111111" as const;
const account = "0x2222222222222222222222222222222222222222" as const;
const params: CreatePoolFactoryParams = {
  token0: factory,
  token1: account,
  priceProvider: factory,
  admin: account,
  adminFeeDestination: account,
  nonNegativeBins: [1n],
  negativeBins: [2n],
  initialScaledAmount0PerE18Shares: 10n ** 18n,
  initialScaledAmount1PerE18Shares: 10n ** 18n,
  minimalOperationalLiquidity: 1_000_000n,
  protocolSpreadFeeE6: 0,
  adminSpreadFeeE6: 0,
  protocolNotionalFeeE8: 0,
  adminNotionalFeeE8: 0,
  curBinDistFromProvidedPricePercent: 0,
  bidAskRefAsymmetryX8: DISABLED_BID_ASK_REF_ASYMMETRY_X8,
  salt: `0x${"00".repeat(32)}`,
};

describe("estimateCreatePoolGas", () => {
  it("estimates exactly the encoded factory request without a wallet", async () => {
    let calls = 0;
    const client = {
      async estimateContractGas(request: Record<string, unknown>) {
        calls++;
        assert.equal(request.address, factory);
        assert.equal(request.account, account);
        assert.equal(request.functionName, "createPool");
        assert.equal(request.abi, POOL_FACTORY_ABI);
        const decoded = decodeFunctionData({
          abi: POOL_FACTORY_ABI,
          data: encodeCreatePoolCalldata(params),
        });
        assert.deepEqual(request.args, decoded.args);
        return 8_078_268n;
      },
    } as unknown as PublicClient;
    assert.equal(await estimateCreatePoolGas(client, factory, params, account), 8_078_268n);
    assert.equal(calls, 1);
  });

  it("validates parameters before making an RPC request", async () => {
    let calls = 0;
    const client = {
      async estimateContractGas() {
        calls++;
        return 1n;
      },
    } as unknown as PublicClient;
    await assert.rejects(
      estimateCreatePoolGas(client, factory, { ...params, bidAskRefAsymmetryX8: 0 }, account),
      /bidAskRefAsymmetryX8 must be a positive integer/,
    );
    assert.equal(calls, 0);
  });

  it("preserves RPC errors instead of treating them as a bin-count limit", async () => {
    const error = new Error("RPC gas estimation unavailable");
    const client = {
      async estimateContractGas() {
        throw error;
      },
    } as unknown as PublicClient;
    await assert.rejects(
      estimateCreatePoolGas(client, factory, params, account),
      (e) => e === error,
    );
  });

  it("does not impose a universal 80-bin limit", async () => {
    const largeParams = {
      ...params,
      nonNegativeBins: createUniformBins(120, 1_000),
      negativeBins: createUniformBins(120, 1_000),
    };
    const client = {
      async estimateContractGas(request: { args: [{ nonNegativeBinDataArray: bigint[] }] }) {
        assert.equal(request.args[0].nonNegativeBinDataArray.length, 24);
        return 10_173_437n;
      },
    } as unknown as PublicClient;
    assert.equal(await estimateCreatePoolGas(client, factory, largeParams, account), 10_173_437n);
  });
});

describe("estimateCreatePoolGas on a local factory", async () => {
  const { viem } = await network.connect("hardhat");

  it("does not submit a transaction and estimates a request that can be executed", async () => {
    const [wallet] = await viem.getWalletClients();
    const env = await deployMetricTestEnv(viem, wallet);
    const config: CreatePoolFactoryParams = {
      ...params,
      token0: env.token0.address,
      token1: env.token1.address,
      priceProvider: env.priceProvider.address,
      admin: wallet.account.address,
      adminFeeDestination: wallet.account.address,
      nonNegativeBins: createUniformBins(10, 1_000),
      negativeBins: createUniformBins(10, 1_000),
    };
    const nonceBefore = await env.publicClient.getTransactionCount({
      address: wallet.account.address,
    });
    const gas = await estimateCreatePoolGas(
      env.publicClient,
      env.factory.address,
      config,
      wallet.account.address,
    );
    assert.ok(gas > 0n);
    assert.equal(
      await env.publicClient.getTransactionCount({ address: wallet.account.address }),
      nonceBefore,
    );
    const largerGas = await estimateCreatePoolGas(
      env.publicClient,
      env.factory.address,
      {
        ...config,
        nonNegativeBins: createUniformBins(20, 1_000),
        negativeBins: createUniformBins(20, 1_000),
      },
      wallet.account.address,
    );
    assert.ok(largerGas > gas, "more bins require a larger estimate");
    const hash = await wallet.sendTransaction({
      to: env.factory.address,
      data: encodeCreatePoolCalldata(config),
      gas,
    });
    const receipt = await env.publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");
    assert.ok(receipt.gasUsed <= gas);
  });
});
