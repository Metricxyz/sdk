import assert from "node:assert/strict";
import { getAddress, parseUnits, type Address, type Hex } from "viem";
import * as sdk from "../../src/index.js";
import { getPoolAddressFromCreateReceipt } from "./getPoolAddressFromCreateReceipt.js";
import type { MetricTestEnv } from "./testEnv.js";
import { testBidAskPriceQ64 } from "./testEnv.js";

export function sortTokens(tokenA: Address, tokenB: Address): [Address, Address] {
  return getAddress(tokenA) < getAddress(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
}

/** One whole token per 1e18 shares in the pool's internal scaled precision. */
export const INITIAL_SCALED_AMOUNT_PER_E18_SHARES = parseUnits("1", 18);

export function createBinRangeLiquidityDeltas(
  fromBin: bigint,
  toBin: bigint,
  sharesPerBin: bigint,
): sdk.PoolLiquidityDelta {
  const binIdxs: bigint[] = [];
  const shares: bigint[] = [];
  for (let bin = fromBin; bin <= toBin; bin++) {
    binIdxs.push(bin);
    shares.push(sharesPerBin);
  }
  return { binIdxs, shares };
}

/** Default liquidity shape used by path-swap and sdk-e2e tests. */
export const PATH_SWAP_LIQUIDITY_DELTAS: sdk.PoolLiquidityDelta = {
  binIdxs: [-2n, -1n, 0n, 1n, 2n],
  shares: [5n * 10n ** 18n, 5n * 10n ** 18n, 10n * 10n ** 18n, 5n * 10n ** 18n, 5n * 10n ** 18n],
};

/** Deeper book used by oracle stop-loss E2E (same bins, larger shares). */
export const STOP_LOSS_LIQUIDITY_DELTAS: sdk.PoolLiquidityDelta = {
  binIdxs: [-2n, -1n, 0n, 1n, 2n],
  shares: [
    100n * 10n ** 18n,
    100n * 10n ** 18n,
    200n * 10n ** 18n,
    100n * 10n ** 18n,
    100n * 10n ** 18n,
  ],
};

/** Wider bin range used by native-swap E2E tests. */
export const WIDE_LIQUIDITY_DELTAS: sdk.PoolLiquidityDelta = createBinRangeLiquidityDeltas(
  -4n,
  4n,
  100n * 10n ** 18n,
);

export async function deployOracleForPair(viem: any, tokenA: Address, tokenB: Address) {
  const oracle = await viem.deployContract("MockOracle", []);
  const [token0, token1] = sortTokens(tokenA, tokenB);
  await oracle.write.setTokens([token0, token1]);
  await oracle.write.setBidAndAskPrice([...testBidAskPriceQ64(1)]);
  return oracle;
}

export async function createPoolForPair(
  env: MetricTestEnv,
  wallet: any,
  tokenA: Address,
  tokenB: Address,
  oracle: { address: Address },
  salt: Hex,
): Promise<Address> {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  const hash = await wallet.sendTransaction({
    to: env.factory.address,
    data: sdk.encodeCreatePoolCalldata({
      token0,
      token1,
      priceProvider: oracle.address,
      admin: wallet.account.address,
      adminFeeDestination: wallet.account.address,
      protocolSpreadFeeE6: 0,
      adminSpreadFeeE6: 5000,
      protocolNotionalFeeE8: 0,
      adminNotionalFeeE8: 0,
      curBinDistFromProvidedPricePercent: 0,
      initialScaledAmount0PerE18Shares: INITIAL_SCALED_AMOUNT_PER_E18_SHARES,
      initialScaledAmount1PerE18Shares: INITIAL_SCALED_AMOUNT_PER_E18_SHARES,
      minimalOperationalLiquidity: 1_000_000n,
      bidAskRefAsymmetryX8: sdk.DISABLED_BID_ASK_REF_ASYMMETRY_X8,
      nonNegativeBins: sdk.createUniformBins(10, 10_000),
      negativeBins: sdk.createUniformBins(10, 10_000),
      salt,
    }),
  });
  const receipt = await env.publicClient.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
  return getPoolAddressFromCreateReceipt(receipt.logs);
}

export async function addLiquidityToPool(
  env: MetricTestEnv,
  deployer: any,
  pool: Address,
  salt: bigint,
  deltas: sdk.PoolLiquidityDelta = PATH_SWAP_LIQUIDITY_DELTAS,
): Promise<void> {
  const hash = await deployer.sendTransaction({
    to: env.liquidityAdder.address,
    data: sdk.encodeAddLiquidityExactSharesSelfCalldata({
      pool,
      salt,
      deltas,
      maxAmountToken0: sdk.NO_SLIPPAGE_LIMIT,
      maxAmountToken1: sdk.NO_SLIPPAGE_LIMIT,
    }),
  });
  assert.equal((await env.publicClient.waitForTransactionReceipt({ hash })).status, "success");
}

export type ExtraTestToken = {
  address: Address;
  write: {
    mint: (args: [Address, bigint], options?: { account?: Address }) => Promise<unknown>;
    approve: (args: [Address, bigint], options?: { account?: Address }) => Promise<unknown>;
  };
  decimals: number;
};

export async function fundTokenForLiquidity(
  env: MetricTestEnv,
  wallet: any,
  token: Address,
  spender: Address,
  extraTokens: ExtraTestToken[] = [],
): Promise<void> {
  const account = wallet.account.address;
  const normalized = token.toLowerCase();

  if (normalized === env.weth.address.toLowerCase()) {
    const amount = parseUnits("1000", 18);
    await env.weth.write.deposit({ value: amount, account });
    await env.weth.write.approve([spender, amount], { account });
    return;
  }
  if (normalized === env.token0.address.toLowerCase()) {
    const amount = parseUnits("1000000", 18);
    await env.token0.write.mint([account, amount]);
    await env.token0.write.approve([spender, amount], { account });
    return;
  }
  if (normalized === env.token1.address.toLowerCase()) {
    const amount = parseUnits("1000000", 6);
    await env.token1.write.mint([account, amount]);
    await env.token1.write.approve([spender, amount], { account });
    return;
  }

  const extra = extraTokens.find((t) => t.address.toLowerCase() === normalized);
  if (extra) {
    const amount = parseUnits("1000000", extra.decimals);
    await extra.write.mint([account, amount], { account });
    await extra.write.approve([spender, amount], { account });
    return;
  }

  throw new Error(`unknown token ${token}`);
}

export async function seedPoolLiquidity(
  env: MetricTestEnv,
  deployer: any,
  pool: Address,
  tokenA: Address,
  tokenB: Address,
  salt: bigint,
  options: {
    deltas?: sdk.PoolLiquidityDelta;
    extraTokens?: ExtraTestToken[];
  } = {},
): Promise<void> {
  const { deltas = WIDE_LIQUIDITY_DELTAS, extraTokens = [] } = options;
  await fundTokenForLiquidity(env, deployer, tokenA, env.liquidityAdder.address, extraTokens);
  await fundTokenForLiquidity(env, deployer, tokenB, env.liquidityAdder.address, extraTokens);
  await addLiquidityToPool(env, deployer, pool, salt, deltas);
}
