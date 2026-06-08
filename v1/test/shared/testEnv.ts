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
  swapper: any;
};

export async function deployMetricTestEnv(viem: any, deployer: any): Promise<MetricTestEnv> {
  const publicClient = await viem.getPublicClient();

  const token0 = await viem.deployContract("MockERC20", ["Token 0", "TKN0", 18]);
  const token1 = await viem.deployContract("MockERC20", ["Token 1", "TKN1", 6]);
  const weth = await viem.deployContract("MockWETH9", []);

  const priceProvider = await viem.deployContract("MockOracle", []);
  await priceProvider.write.setTokens([token0.address, token1.address]);
  const midPriceX64 = sdk.priceToQ64(1);
  await priceProvider.write.setBidAndAskPrice([midPriceX64, midPriceX64]);

  const factory = await viem.deployContract("MetricOmmPoolFactory", [deployer.account.address]);
  const poolDeployer = await deployLinkedPoolDeployer(viem, factory.address);
  await factory.write.setPoolDeployer([poolDeployer.address]);

  const dataProvider = await viem.deployContract("MetricOmmPoolDataProvider", [factory.address]);

  const liquidityAdder = await viem.deployContract("MetricOmmPoolLiquidityAdder", []);
  const swapper = await viem.deployContract("MetricOmmPoolSwapper", [weth.address]);

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
    swapper,
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
