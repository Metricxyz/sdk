import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { decodeFunctionResult, encodeFunctionData, parseUnits, type Hex } from "viem";
import * as sdk from "../src/index.js";
import { deployMetricTestEnv, createPoolViaFactory } from "./shared/testEnv.js";
import { seedPoolLiquidity } from "./shared/poolLiquidity.js";
import { buildManualExactInputSingle } from "./shared/swapTestHelpers.js";

async function setup() {
  const { viem } = await network.connect();
  const [payer, recipient] = await viem.getWalletClients();
  const client = await viem.getPublicClient();
  const weth = await viem.deployContract("MockWETH9", []);
  const token = await viem.deployContract("MockERC20", ["Token", "TKN", 18]);
  const router = await viem.deployContract("MetricOmmSimpleRouter", [
    weth.address,
    payer.account.address,
  ]);
  const executor = await viem.deployContract("ExternalSwapExecutor", [router.address]);
  const target = await viem.deployContract("MockExternalSwapTarget", []);
  const deadline = (await client.getBlock()).timestamp + 1000n;
  return { payer, recipient, client, weth, token, router, executor, target, deadline };
}

describe("external swap fallback execution", () => {
  for (const mode of ["input", "output"] as const) {
    for (const variant of ["erc20", "native", "unwrap"] as const) {
      it(`${mode}: failed primary falls back with ${variant} settlement`, async () => {
        const { payer, recipient, client, weth, token, router, executor, target, deadline } =
          await setup();
        const unwrap = variant === "unwrap";
        const tokenIn = unwrap ? token : weth;
        const tokenOut = unwrap ? weth : token;
        await weth.write.deposit({ value: 1000n });
        await token.write.mint([payer.account.address, 1000n]);
        await tokenOut.write.transfer([target.address, 200n]);
        await tokenIn.write.approve([router.address, 100n]);
        const params = {
          pool: payer.account.address,
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          zeroForOne: true,
          priceLimitX64: 0n,
          recipient: recipient.account.address,
          deadline,
          amountIn: 100n,
          amountOutMinimum: 80n,
          amountInMaximum: 100n,
          amountOut: 80n,
        };
        const fallback = {
          executor: executor.address,
          externalRouter: target.address,
          externalRouterCalldata: encodeFunctionData({
            abi: target.abi,
            functionName: "swap",
            args: [tokenIn.address, tokenOut.address, 90n, 80n],
          }),
        };
        const builders =
          mode === "input"
            ? {
                erc20: () =>
                  sdk.prepareExactInputSingleWithExternalSwapFallbackCalldata(params, fallback),
                native: () =>
                  sdk.prepareExactInputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata(
                    params,
                    fallback,
                    null,
                    weth.address,
                  ),
                unwrap: () =>
                  sdk.prepareExactInputSingleAndUnwrapWithExternalSwapFallbackCalldata(
                    params,
                    fallback,
                    router.address,
                    null,
                    weth.address,
                  ),
              }
            : {
                erc20: () =>
                  sdk.prepareExactOutputSingleWithExternalSwapFallbackCalldata(params, fallback),
                native: () =>
                  sdk.prepareExactOutputSingleSupportingNativePaymentWithExternalSwapFallbackCalldata(
                    params,
                    fallback,
                    null,
                    weth.address,
                  ),
                unwrap: () =>
                  sdk.prepareExactOutputSingleAndUnwrapWithExternalSwapFallbackCalldata(
                    params,
                    fallback,
                    router.address,
                    null,
                    weth.address,
                  ),
              };
        const inputBefore = await tokenIn.read.balanceOf([payer.account.address]);
        const outputBefore = unwrap
          ? await client.getBalance({ address: recipient.account.address })
          : await tokenOut.read.balanceOf([recipient.account.address]);
        const data = builders[variant]();
        const value = variant === "native" ? 110n : 0n;
        const simulation = await client.call({
          account: payer.account.address,
          to: router.address,
          data,
          value,
        });
        const [, successes] = decodeFunctionResult({
          abi: sdk.MetricOmmSimpleRouterAbi,
          functionName: "sequence",
          data: simulation.data as Hex,
        });
        assert.deepEqual(successes, [false, true]);
        const hash = await payer.sendTransaction({ to: router.address, data, value });
        assert.equal((await client.waitForTransactionReceipt({ hash })).status, "success");
        const outputAfter = unwrap
          ? await client.getBalance({ address: recipient.account.address })
          : await tokenOut.read.balanceOf([recipient.account.address]);
        assert.equal(outputAfter - outputBefore, 80n);
        assert.equal(
          await tokenIn.read.balanceOf([payer.account.address]),
          inputBefore + (variant === "native" ? 10n : -90n),
        );
        assert.equal(await client.getBalance({ address: router.address }), 0n);
        assert.equal(await weth.read.balanceOf([router.address]), 0n);
        assert.equal(await tokenIn.read.balanceOf([executor.address]), 0n);
      });
    }
  }

  it("stops after a successful pool swap without calling an invalid fallback", async () => {
    const { viem } = await network.connect();
    const [payer] = await viem.getWalletClients();
    const env = await deployMetricTestEnv(viem, payer);
    const pool = await createPoolViaFactory(env, payer);
    await seedPoolLiquidity(env, payer, pool, env.token0.address, env.token1.address, 1n);
    const amountIn = parseUnits("1", 18);
    await env.token0.write.mint([payer.account.address, amountIn]);
    await env.token0.write.approve([env.simpleRouter.address, amountIn]);
    const params = await buildManualExactInputSingle(
      env.publicClient,
      pool,
      env.token0.address,
      env.token1.address,
      amountIn,
      payer.account.address,
      (await env.publicClient.getBlock()).timestamp + 1000n,
    );
    const before = await env.token1.read.balanceOf([payer.account.address]);
    const data = sdk.prepareExactInputSingleWithExternalSwapFallbackCalldata(params, {
      executor: payer.account.address,
      externalRouter: payer.account.address,
      externalRouterCalldata: "0x",
    });
    const result = await env.publicClient.call({
      account: payer.account.address,
      to: env.simpleRouter.address,
      data,
    });
    const [, successes] = decodeFunctionResult({
      abi: sdk.MetricOmmSimpleRouterAbi,
      functionName: "sequence",
      data: result.data,
    });
    assert.deepEqual(successes, [true, false]);
    const hash = await payer.sendTransaction({ to: env.simpleRouter.address, data });
    assert.equal((await env.publicClient.waitForTransactionReceipt({ hash })).status, "success");
    assert.ok((await env.token1.read.balanceOf([payer.account.address])) > before);
  });

  it("rolls back external transfers when both branches fail", async () => {
    const { payer, recipient, client, weth, token, router, executor, target, deadline } =
      await setup();
    await weth.write.deposit({ value: 100n });
    await weth.write.approve([router.address, 100n]);
    await token.write.mint([target.address, 100n]);
    const data = sdk.prepareExactInputSingleWithExternalSwapFallbackCalldata(
      {
        pool: payer.account.address,
        tokenIn: weth.address,
        tokenOut: token.address,
        zeroForOne: true,
        priceLimitX64: 0n,
        amountIn: 100n,
        amountOutMinimum: 80n,
        recipient: recipient.account.address,
        deadline,
      },
      {
        executor: executor.address,
        externalRouter: target.address,
        externalRouterCalldata: encodeFunctionData({
          abi: target.abi,
          functionName: "swap",
          args: [weth.address, token.address, 90n, 79n],
        }),
      },
    );
    await assert.rejects(payer.sendTransaction({ to: router.address, data }), /StepFailed/);
    assert.equal(await weth.read.balanceOf([payer.account.address]), 100n);
    assert.equal(await token.read.balanceOf([target.address]), 100n);
    assert.equal(await token.read.balanceOf([recipient.account.address]), 0n);
    assert.equal(await client.getBalance({ address: router.address }), 0n);
  });
});
