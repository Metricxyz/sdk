/**
 * Native ETH swap E2E tests on local Hardhat — real router multicall swaps.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits, type Address } from "viem";
import * as sdk from "../src/index.js";
import {
  createPoolForPair,
  deployOracleForPair,
  seedPoolLiquidity,
  type ExtraTestToken,
} from "./shared/poolLiquidity.js";
import {
  assertRouterEmpty,
  buildManualExactInputPath,
  buildManualExactInputSingle,
  erc20Balance,
} from "./shared/swapTestHelpers.js";
import {
  approveTokensForLiquidityAdder,
  approveTokensForSimpleRouter,
  createPoolViaFactory,
  deployMetricTestEnv,
  type MetricTestEnv,
} from "./shared/testEnv.js";

const SALT_POOL_TOKEN0_TOKEN1 =
  "0x00000000000000000000000000000000000000000000000000000000000000a1" as const;
const SALT_POOL_WETH_SWAP_TOKEN1 =
  "0x00000000000000000000000000000000000000000000000000000000000000b2" as const;
const SALT_POOL_WETH_TOKEN1 =
  "0x00000000000000000000000000000000000000000000000000000000000000b3" as const;
const SALT_POOL_SWAP_TOKEN1_TOKEN2 =
  "0x00000000000000000000000000000000000000000000000000000000000000c3" as const;

type NativeSwapTestEnv = {
  env: MetricTestEnv;
  /** 18-decimal intermediate for WETH pools (periphery-style token1). */
  swapToken1: { address: Address; write: any };
  token2: { address: Address; write: any };
  poolToken0Token1: Address;
  poolWethSwapToken1: Address;
  poolWethToken1: Address;
  poolSwapToken1Token2: Address;
  swapper: Address;
  ethRecipient: Address;
  deadline: bigint;
  quoterAddress: Address;
  wrappedNative: Address;
};

function asExtraTokens(
  swapToken1: { address: Address; write: any },
  token2: { address: Address; write: any },
): ExtraTestToken[] {
  return [
    { address: swapToken1.address, write: swapToken1.write, decimals: 18 },
    { address: token2.address, write: token2.write, decimals: 18 },
  ];
}

async function approveRouterForTokens(
  env: MetricTestEnv,
  wallet: any,
  swapToken1: { address: Address; write: any },
  token2: { address: Address; write: any },
): Promise<void> {
  await approveTokensForSimpleRouter(
    env,
    wallet,
    parseUnits("1000000", 18),
    parseUnits("1000000", 6),
  );
  await env.weth.write.approve([env.simpleRouter.address, parseUnits("100", 18)], {
    account: wallet.account,
  });
  await swapToken1.write.approve([env.simpleRouter.address, parseUnits("1000000", 18)], {
    account: wallet.account,
  });
  await token2.write.approve([env.simpleRouter.address, parseUnits("1000000", 18)], {
    account: wallet.account,
  });
}

async function setupNativeSwapEnv(
  viem: any,
  deployer: any,
  ethRecipient: Address,
): Promise<NativeSwapTestEnv> {
  const env = await deployMetricTestEnv(viem, deployer);
  const swapToken1 = await viem.deployContract("MockERC20", ["Swap Token 1", "STKN1", 18]);
  const token2 = await viem.deployContract("MockERC20", ["Token 2", "TKN2", 18]);
  const extraTokens = asExtraTokens(swapToken1, token2);

  await approveTokensForLiquidityAdder(
    env,
    deployer,
    parseUnits("1000000", 18),
    parseUnits("1000000", 6),
  );

  const oracleWethSwapToken1 = await deployOracleForPair(
    viem,
    env.weth.address,
    swapToken1.address,
  );
  const oracleWethToken1 = await deployOracleForPair(viem, env.weth.address, env.token1.address);
  const oracleSwapToken1Token2 = await deployOracleForPair(
    viem,
    swapToken1.address,
    token2.address,
  );

  const poolToken0Token1 = await createPoolViaFactory(env, deployer, {
    salt: SALT_POOL_TOKEN0_TOKEN1,
  });
  const poolWethSwapToken1 = await createPoolForPair(
    env,
    deployer,
    env.weth.address,
    swapToken1.address,
    oracleWethSwapToken1,
    SALT_POOL_WETH_SWAP_TOKEN1,
  );
  const poolWethToken1 = await createPoolForPair(
    env,
    deployer,
    env.weth.address,
    env.token1.address,
    oracleWethToken1,
    SALT_POOL_WETH_TOKEN1,
  );
  const poolSwapToken1Token2 = await createPoolForPair(
    env,
    deployer,
    swapToken1.address,
    token2.address,
    oracleSwapToken1Token2,
    SALT_POOL_SWAP_TOKEN1_TOKEN2,
  );

  await seedPoolLiquidity(
    env,
    deployer,
    poolToken0Token1,
    env.token0.address,
    env.token1.address,
    1n,
    {
      extraTokens,
    },
  );
  await seedPoolLiquidity(
    env,
    deployer,
    poolWethSwapToken1,
    env.weth.address,
    swapToken1.address,
    2n,
    { extraTokens },
  );
  await seedPoolLiquidity(env, deployer, poolWethToken1, env.weth.address, env.token1.address, 3n, {
    extraTokens,
  });
  await seedPoolLiquidity(
    env,
    deployer,
    poolSwapToken1Token2,
    swapToken1.address,
    token2.address,
    4n,
    {
      extraTokens,
    },
  );

  await approveRouterForTokens(env, deployer, swapToken1, token2);

  return {
    env,
    swapToken1,
    token2,
    poolToken0Token1,
    poolWethSwapToken1,
    poolWethToken1,
    poolSwapToken1Token2,
    swapper: deployer.account.address,
    ethRecipient,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    quoterAddress: env.quoter.address,
    wrappedNative: env.weth.address,
  };
}

describe("native ETH swap E2E (Hardhat)", async () => {
  const { viem, networkHelpers } = (await network.connect("hardhat")) as any;
  const [deployer, ethRecipient] = await viem.getWalletClients();

  async function nativeFixture(): Promise<NativeSwapTestEnv> {
    return setupNativeSwapEnv(viem, deployer, ethRecipient.account.address);
  }

  it("single hop: ETH → token1 via multicall", async () => {
    const ctx = await networkHelpers.loadFixture(nativeFixture);
    const { env, swapToken1, poolWethSwapToken1, swapper, deadline, wrappedNative } = ctx;
    const amountIn = 2_500n;

    const token1Before = await erc20Balance(env.publicClient, swapToken1.address, swapper);
    const ethBefore = await env.publicClient.getBalance({ address: swapper });

    const params = await buildManualExactInputSingle(
      env.publicClient,
      poolWethSwapToken1,
      wrappedNative,
      swapToken1.address,
      amountIn,
      swapper,
      deadline,
    );

    const data = sdk.prepareExactInputSingleSupportingNativePaymentCalldata(params);
    const hash = await deployer.sendTransaction({
      to: env.simpleRouter.address,
      data,
      value: amountIn,
    });
    assert.equal((await env.publicClient.waitForTransactionReceipt({ hash })).status, "success");

    const token1After = await erc20Balance(env.publicClient, swapToken1.address, swapper);
    const ethAfter = await env.publicClient.getBalance({ address: swapper });
    assert.ok(token1After > token1Before, "recipient should receive token1");
    assert.ok(ethBefore > ethAfter, "swapper should spend ETH");
    await assertRouterEmpty(env);
  });

  it("single hop: token1 → ETH via multicall unwrap", async () => {
    const ctx = await networkHelpers.loadFixture(nativeFixture);
    const { env, poolWethToken1, ethRecipient, deadline, wrappedNative } = ctx;
    const amountIn = 1_000_000n;

    const ethBefore = await env.publicClient.getBalance({ address: ethRecipient });

    const params = await buildManualExactInputSingle(
      env.publicClient,
      poolWethToken1,
      env.token1.address,
      wrappedNative,
      amountIn,
      ethRecipient,
      deadline,
    );

    const data = sdk.prepareExactInputSingleAndUnwrapCalldata(params, env.simpleRouter.address);
    const hash = await deployer.sendTransaction({
      to: env.simpleRouter.address,
      data,
    });
    assert.equal((await env.publicClient.waitForTransactionReceipt({ hash })).status, "success");

    const ethAfter = await env.publicClient.getBalance({ address: ethRecipient });
    assert.ok(ethAfter > ethBefore, "recipient should receive ETH");
    await assertRouterEmpty(env);
  });

  it("multihop: ETH → token1 → token2 via multicall", async () => {
    const ctx = await networkHelpers.loadFixture(nativeFixture);
    const {
      env,
      token2,
      poolWethSwapToken1,
      poolSwapToken1Token2,
      swapper,
      deadline,
      wrappedNative,
    } = ctx;
    const amountIn = 5_000n;

    const token2Before = await erc20Balance(env.publicClient, token2.address, swapper);
    const ethBefore = await env.publicClient.getBalance({ address: swapper });

    const pathParams = await buildManualExactInputPath(
      env.publicClient,
      wrappedNative,
      token2.address,
      [poolWethSwapToken1, poolSwapToken1Token2],
      amountIn,
      swapper,
      deadline,
    );

    const data = sdk.prepareExactInputSupportingNativePaymentCalldata(pathParams);
    const hash = await deployer.sendTransaction({
      to: env.simpleRouter.address,
      data,
      value: amountIn,
    });
    assert.equal((await env.publicClient.waitForTransactionReceipt({ hash })).status, "success");

    const token2After = await erc20Balance(env.publicClient, token2.address, swapper);
    const ethAfter = await env.publicClient.getBalance({ address: swapper });
    assert.ok(token2After > token2Before, "recipient should receive token2");
    assert.ok(ethBefore > ethAfter, "swapper should spend ETH");
    await assertRouterEmpty(env);
  });

  it("multihop: token0 → token1 → WETH → ETH via multicall unwrap", async () => {
    const ctx = await networkHelpers.loadFixture(nativeFixture);
    const { env, poolToken0Token1, poolWethToken1, ethRecipient, deadline, wrappedNative } = ctx;
    const amountIn = 2_000_000_000_000n;

    const ethBefore = await env.publicClient.getBalance({ address: ethRecipient });

    const pathParams = await buildManualExactInputPath(
      env.publicClient,
      env.token0.address,
      wrappedNative,
      [poolToken0Token1, poolWethToken1],
      amountIn,
      ethRecipient,
      deadline,
    );

    const data = sdk.prepareExactInputAndUnwrapCalldata(pathParams, env.simpleRouter.address);
    const hash = await deployer.sendTransaction({
      to: env.simpleRouter.address,
      data,
    });
    assert.equal((await env.publicClient.waitForTransactionReceipt({ hash })).status, "success");

    const ethAfter = await env.publicClient.getBalance({ address: ethRecipient });
    assert.ok(ethAfter > ethBefore, "recipient should receive ETH");
    await assertRouterEmpty(env);
  });
});
