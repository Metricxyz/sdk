import { parseUnits, type Address } from "viem";
import * as sdk from "../../src/index.js";
import { getPoolAddressFromCreateReceipt } from "./getPoolAddressFromCreateReceipt.js";

/** v0 adminFeePercent (e.g. 0.5 = 0.5%) → v1 adminSpreadFeeE6 */
export function adminSpreadFeeE6FromPercent(adminFeePercent: number): number {
  return Math.round(adminFeePercent * 10_000);
}

export async function deployLinkedPoolDeployer(viem: any, factoryAddress: Address) {
  const liquidityLib = await viem.deployContract("LiquidityLib", []);
  return viem.deployContract("MetricOmmPoolDeployer", [factoryAddress], {
    libraries: { LiquidityLib: liquidityLib.address },
  });
}

export type MetricTestEnv = {
  publicClient: any;
  deployer: any;
  token0: any;
  token1: any;
  weth: any;
  priceProvider: any;
  factory: any;
  poolDeployer: any;
  dataProvider: { address: Address };
  liquidityAdder: any;
  simpleRouter: any;
  quoter: any;
};

/** Pool swaps require bid < ask (strict). Returns a tight Q64 spread around `midPrice`. */
export function testBidAskPriceQ64(midPrice: number = 1): readonly [bigint, bigint] {
  const mid = sdk.priceToQ64(midPrice);
  return [mid - 1n, mid + 1n];
}

/** Same as {@link testBidAskPriceQ64} when mid is already in Q64. */
export function testBidAskPriceQ64FromMid(midQ64: bigint): readonly [bigint, bigint] {
  return [midQ64 - 1n, midQ64 + 1n];
}

/** Set MockOracle bid/ask around `midPrice` and return the Q64.64 pair used. */
export async function setOracleMid(
  env: MetricTestEnv,
  midPrice: number,
): Promise<readonly [bigint, bigint]> {
  const [bid, ask] = testBidAskPriceQ64(midPrice);
  await env.priceProvider.write.setBidAndAskPrice([bid, ask]);
  return [bid, ask];
}

export async function deployMetricTestEnv(viem: any, deployer: any): Promise<MetricTestEnv> {
  const publicClient = await viem.getPublicClient();

  const token0 = await viem.deployContract("MockERC20", ["Token 0", "TKN0", 18]);
  const token1 = await viem.deployContract("MockERC20", ["Token 1", "TKN1", 6]);
  const weth = await viem.deployContract("MockWETH9", []);

  const priceProvider = await viem.deployContract("MockOracle", []);
  await priceProvider.write.setTokens([token0.address, token1.address]);
  await priceProvider.write.setBidAndAskPrice([...testBidAskPriceQ64(1)]);

  const factory = await viem.deployContract("MetricOmmPoolFactory", [deployer.account.address]);
  const poolDeployer = await deployLinkedPoolDeployer(viem, factory.address);
  await factory.write.setPoolDeployer([poolDeployer.address]);

  const dataProvider = await viem.deployContract("MetricOmmPoolDataProvider", [factory.address]);

  const liquidityAdder = await viem.deployContract("MetricOmmPoolLiquidityAdder", [weth.address]);
  const simpleRouter = await viem.deployContract("MetricOmmSimpleRouter", [
    weth.address,
    factory.address,
  ]);
  const quoter = await viem.deployContract("MetricOmmSwapQuoter", []);

  return {
    publicClient,
    deployer,
    token0,
    token1,
    weth,
    priceProvider,
    factory,
    poolDeployer,
    dataProvider,
    liquidityAdder,
    simpleRouter,
    quoter,
  };
}

export async function createPoolViaFactory(
  env: MetricTestEnv,
  wallet: any,
  overrides: Partial<sdk.CreatePoolFactoryParams> = {},
): Promise<Address> {
  const params: sdk.CreatePoolFactoryParams = {
    token0: env.token0.address,
    token1: env.token1.address,
    priceProvider: env.priceProvider.address,
    admin: wallet.account.address,
    adminFeeDestination: wallet.account.address,
    adminSpreadFeeE6: adminSpreadFeeE6FromPercent(0.5),
    adminNotionalFeeE8: 0,
    curBinDistFromProvidedPricePercent: 0,
    initialScaledToken0PerShareE18: parseUnits("1", 18),
    initialScaledToken1PerShareE18: parseUnits("1", 18),
    minimalMintableLiquidity: 1000n,
    nonNegativeBins: sdk.createUniformBins(10, 10000),
    negativeBins: sdk.createUniformBins(10, 10000),
    ...overrides,
  };

  const hash = await wallet.sendTransaction({
    to: env.factory.address,
    data: sdk.encodeCreatePoolCalldata(params),
  });
  const receipt = await env.publicClient.waitForTransactionReceipt({ hash });
  return getPoolAddressFromCreateReceipt(receipt.logs);
}

export async function approveTokensForLiquidityAdder(
  env: MetricTestEnv,
  wallet: any,
  amount0: bigint,
  amount1: bigint,
) {
  await env.token0.write.mint([wallet.account.address, amount0]);
  await env.token1.write.mint([wallet.account.address, amount1]);
  await env.token0.write.approve([env.liquidityAdder.address, amount0]);
  await env.token1.write.approve([env.liquidityAdder.address, amount1]);
}

export async function approveTokensForSimpleRouter(
  env: MetricTestEnv,
  wallet: any,
  amount0: bigint,
  amount1: bigint,
) {
  await env.token0.write.approve([env.simpleRouter.address, amount0]);
  await env.token1.write.approve([env.simpleRouter.address, amount1]);
}

export function buildExactInputSingleTestParams(
  env: MetricTestEnv,
  pool: Address,
  params: {
    recipient: Address;
    zeroForOne: boolean;
    amountIn: bigint;
    amountOutMinimum?: bigint;
    deadline: bigint;
    priceLimitX64?: bigint;
  },
): sdk.ExactInputSingleParams {
  return {
    pool,
    tokenIn: params.zeroForOne ? env.token0.address : env.token1.address,
    tokenOut: params.zeroForOne ? env.token1.address : env.token0.address,
    zeroForOne: params.zeroForOne,
    amountIn: params.amountIn,
    amountOutMinimum: params.amountOutMinimum ?? 0n,
    recipient: params.recipient,
    deadline: params.deadline,
    priceLimitX64: params.priceLimitX64 ?? (params.zeroForOne ? 0n : sdk.MAX_UINT128),
  };
}

export function buildExactOutputSingleTestParams(
  env: MetricTestEnv,
  pool: Address,
  params: {
    recipient: Address;
    zeroForOne: boolean;
    amountOut: bigint;
    amountInMaximum?: bigint;
    deadline: bigint;
    priceLimitX64?: bigint;
  },
): sdk.ExactOutputSingleParams {
  return {
    pool,
    tokenIn: params.zeroForOne ? env.token0.address : env.token1.address,
    tokenOut: params.zeroForOne ? env.token1.address : env.token0.address,
    zeroForOne: params.zeroForOne,
    amountOut: params.amountOut,
    amountInMaximum: params.amountInMaximum ?? sdk.MAX_UINT128,
    recipient: params.recipient,
    deadline: params.deadline,
    priceLimitX64: params.priceLimitX64 ?? (params.zeroForOne ? 0n : sdk.MAX_UINT128),
  };
}
