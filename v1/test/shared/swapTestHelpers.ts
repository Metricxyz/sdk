import assert from "node:assert/strict";
import { erc20Abi, type Address } from "viem";
import * as sdk from "../../src/index.js";
import { resolveSwapPath } from "../../src/swap/path.js";
import type { MetricTestEnv } from "./testEnv.js";

export async function erc20Balance(
  publicClient: any,
  token: Address,
  account: Address,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
}

export async function assertRouterEmpty(env: MetricTestEnv): Promise<void> {
  const ethBalance = await env.publicClient.getBalance({ address: env.simpleRouter.address });
  assert.equal(ethBalance, 0n, "router should hold no ETH");
  const wethBalance = await erc20Balance(
    env.publicClient,
    env.weth.address,
    env.simpleRouter.address,
  );
  assert.equal(wethBalance, 0n, "router should hold no WETH");
}

export async function executeExactInputSingle(
  env: MetricTestEnv,
  deployer: any,
  params: sdk.ExactInputSingleParams,
): Promise<void> {
  const hash = await deployer.sendTransaction({
    to: env.simpleRouter.address,
    data: sdk.encodeExactInputSingleCalldata(params),
  });
  assert.equal((await env.publicClient.waitForTransactionReceipt({ hash })).status, "success");
}

export async function executeExactOutputSingle(
  env: MetricTestEnv,
  deployer: any,
  params: sdk.ExactOutputSingleParams,
): Promise<void> {
  const hash = await deployer.sendTransaction({
    to: env.simpleRouter.address,
    data: sdk.encodeExactOutputSingleCalldata(params),
  });
  assert.equal((await env.publicClient.waitForTransactionReceipt({ hash })).status, "success");
}

export async function buildManualExactInputSingle(
  publicClient: any,
  pool: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  recipient: Address,
  deadline: bigint,
): Promise<sdk.ExactInputSingleParams> {
  const { zeroForOnes } = await resolveSwapPath(publicClient, tokenIn, tokenOut, [pool]);
  const zeroForOne = zeroForOnes[0]!;
  return {
    pool,
    tokenIn,
    tokenOut,
    zeroForOne,
    amountIn,
    amountOutMinimum: 0n,
    recipient,
    deadline,
    priceLimitX64: zeroForOne ? 0n : sdk.MAX_UINT128,
  };
}

export async function buildManualExactInputPath(
  publicClient: any,
  tokenIn: Address,
  tokenOut: Address,
  pools: readonly Address[],
  amountIn: bigint,
  recipient: Address,
  deadline: bigint,
): Promise<sdk.ExactInputParams> {
  const { tokens, extensionDatas, zeroForOneBitMap } = await resolveSwapPath(
    publicClient,
    tokenIn,
    tokenOut,
    pools,
  );
  return {
    tokens,
    pools: [...pools],
    extensionDatas,
    zeroForOneBitMap,
    amountIn,
    amountOutMinimum: 0n,
    recipient,
    deadline,
  };
}
