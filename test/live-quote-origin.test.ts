import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import {
  BaseError,
  ContractFunctionRevertedError,
  getAddress,
  parseUnits,
  zeroAddress,
} from "viem";
import * as sdk from "../src/index.js";
import { MetricOmmSwapQuoterAbi } from "../src/abis/MetricOmmSwapQuoter.js";
import { addLiquidityToPool } from "./shared/poolLiquidity.js";
import {
  approveTokensForLiquidityAdder,
  approveTokensForSimpleRouter,
  createPoolViaFactory,
  deployMetricTestEnv,
} from "./shared/testEnv.js";

describe("live quotes with a swap-context price provider", async () => {
  const { viem, networkHelpers } = await network.connect("hardhat");
  const [deployer, recipient] = await viem.getWalletClients();

  async function fixture() {
    const env = await deployMetricTestEnv(viem, deployer);
    const provider = await viem.deployContract("SwapContextPriceProvider", [
      env.token0.address,
      env.token1.address,
    ]);
    const allowlist = await viem.deployContract("SwapAllowlistExtension", [env.factory.address]);
    const pools = [];
    await approveTokensForLiquidityAdder(
      env,
      deployer,
      parseUnits("100", 18),
      parseUnits("100", 6),
    );
    await approveTokensForSimpleRouter(env, deployer, parseUnits("100", 18), parseUnits("100", 6));
    for (const salt of [1n, 2n]) {
      const pool = await createPoolViaFactory(env, deployer, {
        priceProvider: provider.address,
        salt: `0x${salt.toString(16).padStart(64, "0")}`,
        extensions: [allowlist.address],
        extensionOrders: sdk.buildExtensionOrders({ beforeSwap: [1] }),
        extensionInitData: [sdk.EMPTY_EXTENSION_INIT_DATA],
      });
      await provider.write.setRegisteredPool([pool, true]);
      await allowlist.write.setAllowedToSwap([pool, env.simpleRouter.address, true]);
      await addLiquidityToPool(env, deployer, pool, salt);
      pools.push(pool);
    }
    const common = {
      publicClient: env.publicClient,
      tokenIn: env.token0.address,
      tokenOut: env.token1.address,
      sender: env.simpleRouter.address,
      recipient: recipient.account.address,
      quoterAddress: env.quoter.address,
    };
    return { env, provider, allowlist, pools, common, amountIn: 100_000_000_000_000n };
  }

  it("reproduces the wallet-origin failure and quotes exact input/output for one hop", async () => {
    const { env, pools, common, amountIn } = await networkHelpers.loadFixture(fixture);
    const request = {
      address: env.quoter.address,
      abi: MetricOmmSwapQuoterAbi,
      functionName: "quoteLiveExactInSingle",
      args: [pools[0], common.sender, common.recipient, true, amountIn, 0n, "0x"],
    } as const;
    await assert.rejects(
      env.publicClient.simulateContract({ ...request, account: common.recipient }),
    );
    const direct = await env.publicClient.simulateContract({ ...request, account: zeroAddress });
    const quote = await sdk.quoteLiveExactInSingle({ ...common, pool: pools[0], amountIn });
    assert.deepEqual([quote.amountIn, quote.amountOut], direct.result);
    assert.equal(quote.amountIn, amountIn);
    assert.ok(quote.amountOut > 0n);
    const exactOut = await sdk.quoteLiveExactOutSingle({
      ...common,
      pool: pools[0],
      amountOut: quote.amountOut / 2n,
    });
    assert.equal(exactOut.amountOut, quote.amountOut / 2n);
    assert.ok(exactOut.amountIn > 0n);

    // The actual sender must still reach the allowlist; a zero-origin read must
    // not replace sender/recipient calldata with the simulation address.
    await assert.rejects(
      sdk.quoteLiveExactInSingle({
        ...common,
        sender: common.recipient,
        pool: pools[0],
        amountIn,
      }),
    );
  });

  it("quotes exact input/output across two gated pools", async () => {
    const { pools, common, amountIn } = await networkHelpers.loadFixture(fixture);
    const path = { ...common, tokenOut: common.tokenIn, pools };
    const hop1 = await sdk.quoteLiveExactInSingle({ ...common, pool: pools[0], amountIn });
    const hop2 = await sdk.quoteLiveExactInSingle({
      ...common,
      pool: pools[1],
      tokenIn: common.tokenOut,
      tokenOut: common.tokenIn,
      amountIn: hop1.amountOut,
    });
    const quote = await sdk.quoteLiveExactIn({ ...path, amountIn });
    assert.equal(quote.amountIn, amountIn);
    assert.equal(quote.amountOut, hop2.amountOut);
    const exactOut = await sdk.quoteLiveExactOut({ ...path, amountOut: quote.amountOut / 2n });
    assert.equal(exactOut.amountOut, quote.amountOut / 2n);
    assert.ok(exactOut.amountIn > 0n);
  });

  it("builds and executes a wallet swap while retaining oracle registration checks", async () => {
    const { env, provider, pools, common, amountIn } = await networkHelpers.loadFixture(fixture);
    const params = await sdk.buildExactInputSingleParams({
      ...common,
      pool: pools[0],
      amountIn,
      slippagePercent: 0.5,
      deadline: (await env.publicClient.getBlock()).timestamp + 300n,
    });
    assert.equal(params.recipient, common.recipient);
    assert.ok(params.amountOutMinimum > 0n);
    const request = {
      account: deployer.account,
      to: env.simpleRouter.address,
      data: sdk.encodeExactInputSingleCalldata(params),
    };
    await provider.write.setRegisteredPool([pools[0], false]);
    await assert.rejects(env.publicClient.call(request));
    await provider.write.setRegisteredPool([pools[0], true]);
    await env.publicClient.call(request);
    const before = await env.token1.read.balanceOf([common.recipient]);
    const hash = await deployer.sendTransaction(request);
    assert.equal((await env.publicClient.waitForTransactionReceipt({ hash })).status, "success");
    const after = await env.token1.read.balanceOf([common.recipient]);
    assert.ok(after - before >= params.amountOutMinimum);
  });

  it("preserves recipient fallback for omitted and explicit zero senders", async () => {
    const { allowlist, pools, common, amountIn } = await networkHelpers.loadFixture(fixture);
    for (const pool of pools) {
      await allowlist.write.setAllowedToSwap([pool, common.recipient, true]);
    }
    for (const sender of [undefined, zeroAddress]) {
      const single = { ...common, sender, pool: pools[0] };
      const exactIn = await sdk.quoteLiveExactInSingle({ ...single, amountIn });
      assert.ok(exactIn.amountOut > 0n);
      const exactOut = await sdk.quoteLiveExactOutSingle({
        ...single,
        amountOut: exactIn.amountOut / 2n,
      });
      assert.equal(exactOut.amountOut, exactIn.amountOut / 2n);
      const path = { ...common, sender, tokenOut: common.tokenIn, pools };
      const pathIn = await sdk.quoteLiveExactIn({ ...path, amountIn });
      const pathOut = await sdk.quoteLiveExactOut({ ...path, amountOut: pathIn.amountOut / 2n });
      assert.equal(pathOut.amountOut, pathIn.amountOut / 2n);
    }
  });

  it("keeps hypothetical quotes on the original recipient caller", async () => {
    const { env, pools, common, amountIn } = await networkHelpers.loadFixture(fixture);
    const callers: unknown[] = [];
    const publicClient = {
      ...env.publicClient,
      simulateContract(request: { account?: unknown }) {
        callers.push(request.account);
        return env.publicClient.simulateContract(request);
      },
    };
    const referencePriceX64 = 1n << 64n;
    const prices = {
      bidPriceX64: referencePriceX64 - referencePriceX64 / 10_000n,
      askPriceX64: referencePriceX64 + referencePriceX64 / 10_000n,
      referencePriceX64,
    };
    const single = { ...common, publicClient, pool: pools[0], ...prices };
    const quote = await sdk.quoteHypotheticalExactInputSingle({ ...single, amountIn });
    await sdk.quoteHypotheticalExactOutputSingle({ ...single, amountOut: quote.amountOut / 2n });
    const path = {
      ...common,
      publicClient,
      tokenOut: common.tokenIn,
      pools,
      bidPricesX64: pools.map(() => prices.bidPriceX64),
      askPricesX64: pools.map(() => prices.askPriceX64),
      referencePricesX64: pools.map(() => referencePriceX64),
    };
    const pathQuote = await sdk.quoteHypotheticalExactInput({ ...path, amountIn });
    await sdk.quoteHypotheticalExactOutput({ ...path, amountOut: pathQuote.amountOut / 2n });
    assert.deepEqual(callers, Array(4).fill(common.recipient));
  });

  it("rejects live quotes on a paused pool with the quoter's PoolPaused error", async () => {
    const { env, pools, common, amountIn } = await networkHelpers.loadFixture(fixture);
    const pausedPool = pools[1];
    await env.factory.write.pausePool([pausedPool]);

    const isPoolPaused = (error: unknown) => {
      assert.ok(error instanceof BaseError);
      const revert = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
      assert.ok(revert instanceof ContractFunctionRevertedError);
      assert.equal(revert.data?.errorName, "PoolPaused");
      assert.deepEqual(revert.data?.args, [getAddress(pausedPool), 1]);
      return true;
    };
    const single = {
      ...common,
      pool: pausedPool,
      tokenIn: common.tokenOut,
      tokenOut: common.tokenIn,
    };
    await assert.rejects(sdk.quoteLiveExactInSingle({ ...single, amountIn }), isPoolPaused);
    await assert.rejects(
      sdk.quoteLiveExactOutSingle({ ...single, amountOut: 1_000n }),
      isPoolPaused,
    );
    const path = { ...common, tokenOut: common.tokenIn, pools };
    await assert.rejects(sdk.quoteLiveExactIn({ ...path, amountIn }), isPoolPaused);
    await assert.rejects(sdk.quoteLiveExactOut({ ...path, amountOut: 1_000n }), isPoolPaused);

    // The unpaused hop still quotes live, and hypothetical quotes ignore pause state.
    const live = await sdk.quoteLiveExactInSingle({ ...common, pool: pools[0], amountIn });
    assert.ok(live.amountOut > 0n);
    const referencePriceX64 = 1n << 64n;
    const hypothetical = await sdk.quoteHypotheticalExactInputSingle({
      ...single,
      amountIn: live.amountOut,
      bidPriceX64: referencePriceX64 - referencePriceX64 / 10_000n,
      askPriceX64: referencePriceX64 + referencePriceX64 / 10_000n,
      referencePriceX64,
    });
    assert.ok(hypothetical.amountOut > 0n);
  });
});
