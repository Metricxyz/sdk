/**
 * Two-hop path tests: multihop quote/swap vs chained single-hop on identical pool state.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits, type Address } from "viem";
import * as sdk from "../src/index.js";
import { addLiquidityToPool } from "./shared/poolLiquidity.js";
import {
  erc20Balance,
  executeExactInputSingle,
  executeExactOutputSingle,
} from "./shared/swapTestHelpers.js";
import {
  approveTokensForLiquidityAdder,
  approveTokensForSimpleRouter,
  createPoolViaFactory,
  deployMetricTestEnv,
  type MetricTestEnv,
} from "./shared/testEnv.js";

const SALT_POOL_A = "0x00000000000000000000000000000000000000000000000000000000000000a1" as const;
const SALT_POOL_B = "0x00000000000000000000000000000000000000000000000000000000000000b2" as const;

type PathTestEnv = {
  env: MetricTestEnv;
  poolA: Address;
  poolB: Address;
  token0: Address;
  token1: Address;
  recipient: Address;
  deadline: bigint;
  amountIn: bigint;
  quoterAddress: Address;
};

async function setupTwoPoolPathEnv(viem: any, deployer: any): Promise<PathTestEnv> {
  const env = await deployMetricTestEnv(viem, deployer);
  const max0 = parseUnits("1000000", 18);
  const max1 = parseUnits("1000000", 6);
  await approveTokensForLiquidityAdder(env, deployer, max0, max1);
  await approveTokensForSimpleRouter(env, deployer, max0, max1);

  const poolA = await createPoolViaFactory(env, deployer, { salt: SALT_POOL_A });
  const poolB = await createPoolViaFactory(env, deployer, { salt: SALT_POOL_B });

  await addLiquidityToPool(env, deployer, poolA, 1n);
  await addLiquidityToPool(env, deployer, poolB, 2n);

  return {
    env,
    poolA,
    poolB,
    token0: env.token0.address,
    token1: env.token1.address,
    recipient: deployer.account.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    // Small enough that hop-2 fully consumes hop-1 output (multihop exact-in requires full fills).
    amountIn: 2_000_000_000_000n,
    quoterAddress: env.quoter.address,
  };
}

async function token0Balance(
  publicClient: any,
  token0: Address,
  account: Address,
): Promise<bigint> {
  return erc20Balance(publicClient, token0, account);
}

describe("two-hop path quote and swap", async () => {
  const { viem, networkHelpers } = (await network.connect("hardhat")) as any;
  const [deployer] = await viem.getWalletClients();

  async function pathFixture(): Promise<PathTestEnv> {
    return setupTwoPoolPathEnv(viem, deployer);
  }

  it("quoteLiveExactIn matches chained singles", async () => {
    const ctx = await networkHelpers.loadFixture(pathFixture);
    const { env, poolA, poolB, token0, token1, recipient, amountIn, quoterAddress } = ctx;

    const hop1 = await sdk.quoteLiveExactInSingle({
      publicClient: env.publicClient,
      pool: poolA,
      tokenIn: token0,
      tokenOut: token1,
      recipient,
      amountIn,
      quoterAddress,
    });
    const hop2 = await sdk.quoteLiveExactInSingle({
      publicClient: env.publicClient,
      pool: poolB,
      tokenIn: token1,
      tokenOut: token0,
      recipient,
      amountIn: hop1.amountOut,
      quoterAddress,
    });

    const path = await sdk.quoteLiveExactIn({
      publicClient: env.publicClient,
      tokenIn: token0,
      tokenOut: token0,
      pools: [poolA, poolB],
      recipient,
      amountIn,
      quoterAddress,
    });

    assert.equal(hop1.amountIn, amountIn);
    assert.equal(hop2.amountIn, hop1.amountOut);
    assert.equal(path.amountIn, amountIn);
    assert.equal(path.amountOut, hop2.amountOut);
  });

  it("quoteLiveExactOut matches chained singles", async () => {
    const ctx = await networkHelpers.loadFixture(pathFixture);
    const { env, poolA, poolB, token0, token1, recipient, quoterAddress } = ctx;

    const hop1Quote = await sdk.quoteLiveExactInSingle({
      publicClient: env.publicClient,
      pool: poolA,
      tokenIn: token0,
      tokenOut: token1,
      recipient,
      amountIn: parseUnits("1", 18),
      quoterAddress,
    });
    const targetOut = hop1Quote.amountOut / 2n;
    assert.ok(targetOut > 0n);

    const hop2 = await sdk.quoteLiveExactOutSingle({
      publicClient: env.publicClient,
      pool: poolB,
      tokenIn: token1,
      tokenOut: token0,
      recipient,
      amountOut: targetOut,
      quoterAddress,
    });
    const hop1 = await sdk.quoteLiveExactOutSingle({
      publicClient: env.publicClient,
      pool: poolA,
      tokenIn: token0,
      tokenOut: token1,
      recipient,
      amountOut: hop2.amountIn,
      quoterAddress,
    });

    const path = await sdk.quoteLiveExactOut({
      publicClient: env.publicClient,
      tokenIn: token0,
      tokenOut: token0,
      pools: [poolA, poolB],
      recipient,
      amountOut: targetOut,
      quoterAddress,
    });

    assert.equal(path.amountOut, targetOut);
    assert.equal(path.amountIn, hop1.amountIn);
  });

  it("quoteHypotheticalExactInput matches chained singles", async () => {
    const ctx = await networkHelpers.loadFixture(pathFixture);
    const { env, poolA, poolB, token0, token1, recipient, amountIn, quoterAddress } = ctx;

    const [bidA, askA, referenceA] = await env.priceProvider.read.getQuote();
    const [bidB, askB, referenceB] = [bidA, askA, referenceA];

    const hop1 = await sdk.quoteHypotheticalExactInputSingle({
      publicClient: env.publicClient,
      pool: poolA,
      tokenIn: token0,
      tokenOut: token1,
      recipient,
      amountIn,
      bidPriceX64: bidA,
      askPriceX64: askA,
      referencePriceX64: referenceA,
      quoterAddress,
    });
    const hop2 = await sdk.quoteHypotheticalExactInputSingle({
      publicClient: env.publicClient,
      pool: poolB,
      tokenIn: token1,
      tokenOut: token0,
      recipient,
      amountIn: hop1.amountOut,
      bidPriceX64: bidB,
      askPriceX64: askB,
      referencePriceX64: referenceB,
      quoterAddress,
    });

    const path = await sdk.quoteHypotheticalExactInput({
      publicClient: env.publicClient,
      tokenIn: token0,
      tokenOut: token0,
      pools: [poolA, poolB],
      bidPricesX64: [bidA, bidB],
      askPricesX64: [askA, askB],
      referencePricesX64: [referenceA, referenceB],
      recipient,
      amountIn,
      quoterAddress,
    });

    assert.equal(hop1.amountIn, amountIn);
    assert.equal(hop2.amountIn, hop1.amountOut);
    assert.equal(path.amountIn, amountIn);
    assert.equal(path.amountOut, hop2.amountOut);
  });

  it("exactInput swap matches two sequential singles", async () => {
    const singlesCtx = await networkHelpers.loadFixture(pathFixture);
    const balanceBeforeSingles = await token0Balance(
      singlesCtx.env.publicClient,
      singlesCtx.token0,
      singlesCtx.recipient,
    );

    const hop1Quote = await sdk.quoteLiveExactInSingle({
      publicClient: singlesCtx.env.publicClient,
      pool: singlesCtx.poolA,
      tokenIn: singlesCtx.token0,
      tokenOut: singlesCtx.token1,
      recipient: singlesCtx.recipient,
      amountIn: singlesCtx.amountIn,
      quoterAddress: singlesCtx.quoterAddress,
    });

    await executeExactInputSingle(singlesCtx.env, deployer, {
      pool: singlesCtx.poolA,
      tokenIn: singlesCtx.token0,
      tokenOut: singlesCtx.token1,
      zeroForOne: true,
      amountIn: singlesCtx.amountIn,
      amountOutMinimum: 0n,
      recipient: singlesCtx.recipient,
      deadline: singlesCtx.deadline,
      priceLimitX64: 0n,
    });

    await executeExactInputSingle(singlesCtx.env, deployer, {
      pool: singlesCtx.poolB,
      tokenIn: singlesCtx.token1,
      tokenOut: singlesCtx.token0,
      zeroForOne: false,
      amountIn: hop1Quote.amountOut,
      amountOutMinimum: 0n,
      recipient: singlesCtx.recipient,
      deadline: singlesCtx.deadline,
      priceLimitX64: sdk.MAX_UINT128,
    });

    const balanceAfterSingles = await token0Balance(
      singlesCtx.env.publicClient,
      singlesCtx.token0,
      singlesCtx.recipient,
    );

    const pathCtx = await networkHelpers.loadFixture(pathFixture);
    const balanceBeforePath = await token0Balance(
      pathCtx.env.publicClient,
      pathCtx.token0,
      pathCtx.recipient,
    );
    assert.equal(balanceBeforePath, balanceBeforeSingles);

    const pathParams = await sdk.buildExactInputParams({
      publicClient: pathCtx.env.publicClient,
      tokenIn: pathCtx.token0,
      tokenOut: pathCtx.token0,
      pools: [pathCtx.poolA, pathCtx.poolB],
      recipient: pathCtx.recipient,
      amountIn: pathCtx.amountIn,
      slippagePercent: 0,
      deadline: pathCtx.deadline,
      quoterAddress: pathCtx.quoterAddress,
    });

    const pathHash = await deployer.sendTransaction({
      to: pathCtx.env.simpleRouter.address,
      data: sdk.encodeExactInputCalldata(pathParams),
    });
    assert.equal(
      (await pathCtx.env.publicClient.waitForTransactionReceipt({ hash: pathHash })).status,
      "success",
    );

    const balanceAfterPath = await token0Balance(
      pathCtx.env.publicClient,
      pathCtx.token0,
      pathCtx.recipient,
    );

    assert.equal(balanceAfterSingles - balanceBeforeSingles, balanceAfterPath - balanceBeforePath);
  });

  it("exactOutput swap matches two sequential singles", async () => {
    const ctx = await networkHelpers.loadFixture(pathFixture);
    const { env, poolA, token0, token1, recipient, quoterAddress } = ctx;

    const hop1Quote = await sdk.quoteLiveExactInSingle({
      publicClient: env.publicClient,
      pool: poolA,
      tokenIn: token0,
      tokenOut: token1,
      recipient,
      amountIn: parseUnits("1", 18),
      quoterAddress,
    });
    const targetOut = hop1Quote.amountOut / 2n;
    assert.ok(targetOut > 0n);

    const singlesCtx = await networkHelpers.loadFixture(pathFixture);
    const balanceBeforeSingles = await token0Balance(
      singlesCtx.env.publicClient,
      singlesCtx.token0,
      singlesCtx.recipient,
    );

    const hop2Quote = await sdk.quoteLiveExactOutSingle({
      publicClient: singlesCtx.env.publicClient,
      pool: singlesCtx.poolB,
      tokenIn: singlesCtx.token1,
      tokenOut: singlesCtx.token0,
      recipient: singlesCtx.recipient,
      amountOut: targetOut,
      quoterAddress: singlesCtx.quoterAddress,
    });

    await executeExactOutputSingle(singlesCtx.env, deployer, {
      pool: singlesCtx.poolB,
      tokenIn: singlesCtx.token1,
      tokenOut: singlesCtx.token0,
      zeroForOne: false,
      amountOut: targetOut,
      amountInMaximum: sdk.MAX_UINT128,
      recipient: singlesCtx.recipient,
      deadline: singlesCtx.deadline,
      priceLimitX64: sdk.MAX_UINT128,
    });

    await executeExactOutputSingle(singlesCtx.env, deployer, {
      pool: singlesCtx.poolA,
      tokenIn: singlesCtx.token0,
      tokenOut: singlesCtx.token1,
      zeroForOne: true,
      amountOut: hop2Quote.amountIn,
      amountInMaximum: sdk.MAX_UINT128,
      recipient: singlesCtx.recipient,
      deadline: singlesCtx.deadline,
      priceLimitX64: 0n,
    });

    const balanceAfterSingles = await token0Balance(
      singlesCtx.env.publicClient,
      singlesCtx.token0,
      singlesCtx.recipient,
    );

    const pathCtx = await networkHelpers.loadFixture(pathFixture);
    const balanceBeforePath = await token0Balance(
      pathCtx.env.publicClient,
      pathCtx.token0,
      pathCtx.recipient,
    );
    assert.equal(balanceBeforePath, balanceBeforeSingles);

    const pathParams = await sdk.buildExactOutputParams({
      publicClient: pathCtx.env.publicClient,
      tokenIn: pathCtx.token0,
      tokenOut: pathCtx.token0,
      pools: [pathCtx.poolA, pathCtx.poolB],
      recipient: pathCtx.recipient,
      amountOut: targetOut,
      slippagePercent: 0,
      deadline: pathCtx.deadline,
      quoterAddress: pathCtx.quoterAddress,
    });

    const pathHash = await deployer.sendTransaction({
      to: pathCtx.env.simpleRouter.address,
      data: sdk.encodeExactOutputCalldata(pathParams),
    });
    assert.equal(
      (await pathCtx.env.publicClient.waitForTransactionReceipt({ hash: pathHash })).status,
      "success",
    );

    const balanceAfterPath = await token0Balance(
      pathCtx.env.publicClient,
      pathCtx.token0,
      pathCtx.recipient,
    );

    assert.equal(balanceAfterSingles - balanceBeforeSingles, balanceAfterPath - balanceBeforePath);
  });
});
