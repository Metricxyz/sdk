import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits, type Address, getContract } from "viem";
import * as sdk from "../index.js";
import MockOracleArtifact from "../artifacts/@metric/core/contracts/mocks/MockOracle.sol/MockOracle.json";
import MockERC20Artifact from "../artifacts/@metric/core/contracts/mocks/MockERC20.sol/MockERC20.json";
import MetricOmmPoolStateViewArtifact from "../artifacts/@metric/core/contracts/MetricOmmPoolStateView.sol/MetricOmmPoolStateView.json";
import MetricOmmPoolArtifact from "../artifacts/@metric/core/contracts/MetricOmmPool.sol/MetricOmmPool.json";

describe("buildModifyLiquidityArgsForUniformAddition (simplified matrix)", async function () {
  const { viem, networkHelpers } = await network.connect("hardhat");
  const [deployer] = await viem.getWalletClients();

  async function setupEnv(config?: { decimals0?: number; decimals1?: number }) {
    const decimals0 = config?.decimals0 ?? 18;
    const decimals1 = config?.decimals1 ?? 6;
    const publicClient = await viem.getPublicClient();

    const token0Deployment = await viem.deployContract("MockERC20", [
      "Token0",
      "TK0",
      decimals0,
    ]);
    const token1Deployment = await viem.deployContract("MockERC20", [
      "Token1",
      "TK1",
      decimals1,
    ]);

    const token0 = getContract({
      address: token0Deployment.address,
      abi: MockERC20Artifact.abi,
      client: { public: publicClient, wallet: deployer },
    });
    const token1 = getContract({
      address: token1Deployment.address,
      abi: MockERC20Artifact.abi,
      client: { public: publicClient, wallet: deployer },
    });

    // Mint ample balances to avoid allowance/supply issues in edge cases
    await token0.write.mint([
      deployer.account.address,
      parseUnits("1000000000000", decimals0),
    ]);
    await token1.write.mint([
      deployer.account.address,
      parseUnits("1000000000000", decimals1),
    ]);

    const stateViewDeployment = await viem.deployContract(
      "MetricOmmPoolStateView",
      [],
    );
    const stateView = getContract({
      address: stateViewDeployment.address,
      abi: MetricOmmPoolStateViewArtifact.abi,
      client: { public: publicClient, wallet: deployer },
    });

    const priceProviderDeployment = await viem.deployContract("MockOracle", []);
    const priceProvider = getContract({
      address: priceProviderDeployment.address,
      abi: MockOracleArtifact.abi,
      client: { public: publicClient, wallet: deployer },
    });

    const q64Price = sdk.priceToQ64(1.0);
    await priceProvider.write.setBidAndAskPrice([q64Price, q64Price]);

    const positiveBins = sdk.createUniformBins(20, 10000, 0, 0);
    const negativeBins = sdk.createUniformBins(20, 10000, 0, 0);
    const poolDeployment = await viem.deployContract("MetricOmmPool", [
      deployer.account.address,
      deployer.account.address,
      token0.address,
      token1.address,
      priceProvider.address,
      parseUnits("1", 18),
      parseUnits("1", 18),
      1000n,
      false,
      50000n,
      1n,
      10000,
      0,
      deployer.account.address,
      0,
      positiveBins,
      negativeBins,
    ]);

    const pool = getContract({
      address: poolDeployment.address,
      abi: MetricOmmPoolArtifact.abi,
      client: { public: publicClient, wallet: deployer },
    });

    const maxApprove0 = parseUnits("1000000000000", decimals0);
    const maxApprove1 = parseUnits("1000000000000", decimals1);

    await token0.write.approve([pool.address, maxApprove0]);
    await token1.write.approve([pool.address, maxApprove1]);

    return {
      publicClient,
      pool,
      stateView,
      token0,
      token1,
      deployer,
      priceProvider,
    };
  }

  const toToken1Value = (
    amount0: bigint,
    immutables: sdk.PoolImmutables,
    priceX18: bigint,
  ) =>
    (amount0 * immutables.token0ScaleMultiplier * priceX18) /
    (immutables.token1ScaleMultiplier * 1_000_000_000_000_000_000n);

  // Track salt per pool to avoid position collisions
  let saltCounter = 0n;

  const mintOnce = async (
    publicClient: any,
    pool: Address,
    stateView: Address,
    token0: any,
    token1: any,
    params: sdk.CalculateUniformLiquidityParams,
    valueTolerancePpm: bigint,
  ) => {
    const before0 = (await token0.read.balanceOf([pool])) as bigint;
    const before1 = (await token1.read.balanceOf([pool])) as bigint;

    const salt = saltCounter++;
    const result = await sdk.buildModifyLiquidityArgsForUniformAddition({
      publicClient,
      stateViewAddress: stateView,
      poolAddress: pool,
      amountInTokensPerBin: params.amountInTokensPerBin,
      amountIsInToken0: params.amountIsInToken0,
      currentPrice: params.currentPrice,
      lowerBin: params.lowerBin,
      upperBin: params.upperBin,
      salt,
    });

    const deltas = result[1];
    const specAmount0 = result[2];
    const specAmount1 = result[3];

    // Use direct pool modifyLiquidity calldata

    const hash = await deployer.sendTransaction({
      to: pool,
      data: sdk.encodeModifyLiquidityCalldata(result),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");

    const after0 = (await token0.read.balanceOf([pool])) as bigint;
    const after1 = (await token1.read.balanceOf([pool])) as bigint;
    const spent0 = after0 - before0;
    const spent1 = after1 - before1;
    assert.ok(spent0 >= 0n && spent0 <= specAmount0);
    assert.ok(spent1 >= 0n && spent1 <= specAmount1);

    if (specAmount0 > 0n) {
      const shortfall0 = specAmount0 - spent0;
      const allowedShortfall0 = specAmount0 / 100n + 1n;
      assert.ok(
        shortfall0 <= allowedShortfall0,
        `spec/spent mismatch token0: spec=${specAmount0}, spent=${spent0}, shortfall=${shortfall0}, allowed=${allowedShortfall0}`,
      );
    }
    if (specAmount1 > 0n) {
      const shortfall1 = specAmount1 - spent1;
      const allowedShortfall1 = specAmount1 / 100n + 1n;
      assert.ok(
        shortfall1 <= allowedShortfall1,
        `spec/spent mismatch token1: spec=${specAmount1}, spent=${spent1}, shortfall=${shortfall1}, allowed=${allowedShortfall1}`,
      );
    }

    const binsCount = BigInt(deltas.length);
    const headroom0 = specAmount0 - spent0;
    const headroom1 = specAmount1 - spent1;
    assert.ok(
      headroom0 <= binsCount,
      `specAmount0 headroom too large: ${headroom0} > ${binsCount}`,
    );
    assert.ok(
      headroom1 <= binsCount,
      `specAmount1 headroom too large: ${headroom1} > ${binsCount}`,
    );

    const immutables = await sdk.getPoolImmutables(publicClient, pool);

    // Convert price to X18 format more carefully for large prices
    let priceX18: bigint;
    if (params.currentPrice >= 1e9) {
      // For very large prices, split the multiplication to avoid precision loss
      const priceInt = Math.floor(params.currentPrice);
      const priceFrac = params.currentPrice - priceInt;
      priceX18 =
        BigInt(priceInt) * 1_000_000_000_000_000_000n +
        BigInt(Math.round(priceFrac * 1e18));
    } else {
      priceX18 = BigInt(Math.round(params.currentPrice * 1e18));
    }

    const value1 = spent1 + toToken1Value(spent0, immutables, priceX18);
    const targetPerBinToken1 = params.amountIsInToken0
      ? toToken1Value(params.amountInTokensPerBin, immutables, priceX18)
      : params.amountInTokensPerBin;
    const activeBins = BigInt(
      deltas.filter((d) => d.deltaShares !== 0n).length,
    );
    const target1 = targetPerBinToken1 * activeBins;

    if (target1 > 0n) {
      const diff = value1 > target1 ? value1 - target1 : target1 - value1;
      const allowed = (target1 * valueTolerancePpm) / 1_000_000n + 1n; // ppm, 10_000 = 1%
      assert.ok(
        diff <= allowed,
        `value mismatch: provided ${value1}, target ${target1}, tol ppm ${valueTolerancePpm}`,
      );
    }

    return { spent0, spent1, headroom0, headroom1 };
  };

  const decimalPairs = [
    { label: "dec6/6", decimals0: 6, decimals1: 6 },
    { label: "dec18/6", decimals0: 18, decimals1: 6 },
    { label: "dec18/18", decimals0: 18, decimals1: 18 },
  ];

  const prices = [1e-6, 1, 1_000_000];
  const amountModes = [true, false];
  const binCases = [
    { label: "below", bin: -1, expect: "token1" },
    { label: "current", bin: 0, expect: "mixed" },
    { label: "above", bin: 1, expect: "token0" },
  ];
  const poolStates = ["empty", "seeded"] as const;

  const pickAmount = (
    decimals0: number,
    decimals1: number,
    amountIsInToken0: boolean,
    price: number,
  ): bigint => {
    const decimals = amountIsInToken0 ? decimals0 : decimals1;

    // For 6 decimal tokens depositing in token0, we need much larger amounts
    // to avoid precision/rounding issues in the contracts
    if (amountIsInToken0 && decimals0 <= 6 && decimals1 <= 6) {
      if (price <= 1e-5 || price >= 1e5) {
        return parseUnits("1000000", decimals);
      }
      return parseUnits("100000", decimals);
    }

    // Use larger amounts for extreme prices with low decimals
    if (decimals <= 6 && (price <= 1e-5 || price >= 1e5)) {
      return parseUnits("100000", decimals);
    }
    return parseUnits("1000", decimals);
  };

  // Create named fixture functions for each decimal configuration
  async function setupEnv6_6() {
    saltCounter = 0n; // Reset salt counter for each fixture
    return setupEnv({ decimals0: 6, decimals1: 6 });
  }
  async function setupEnv18_6() {
    saltCounter = 0n;
    return setupEnv({ decimals0: 18, decimals1: 6 });
  }
  async function setupEnv18_18() {
    saltCounter = 0n;
    return setupEnv({ decimals0: 18, decimals1: 18 });
  }

  const fixtureMap: Record<string, () => Promise<any>> = {
    "dec6/6": setupEnv6_6,
    "dec18/6": setupEnv18_6,
    "dec18/18": setupEnv18_18,
  };

  for (const decimals of decimalPairs) {
    for (const amountIsInToken0 of amountModes) {
      describe(`${decimals.label} / amountIn=${amountIsInToken0 ? "token0" : "token1"}`, () => {
        for (const price of prices) {
          for (const state of poolStates) {
            for (const binCase of binCases) {
              it(`${state} pool, price=${price}, bin=${binCase.label}`, async () => {
                const {
                  publicClient,
                  pool,
                  stateView,
                  token0,
                  token1,
                  priceProvider,
                } = (await networkHelpers.loadFixture(
                  fixtureMap[decimals.label],
                )) as any;

                // Set the oracle price for this test
                const q64Price = sdk.priceToQ64(price);
                await priceProvider.write.setBidAndAskPrice([
                  q64Price,
                  q64Price,
                ]);

                // Optionally seed the pool at current bin with a tiny mint
                if (state === "seeded") {
                  // Use appropriate seed amount based on price and decimals
                  let seedAmount: bigint;
                  if (decimals.decimals0 <= 6 && decimals.decimals1 <= 6) {
                    if (price <= 1e-5 || price >= 1e5) {
                      seedAmount = parseUnits("1000000", decimals.decimals0);
                    } else {
                      seedAmount = parseUnits("100000", decimals.decimals0);
                    }
                  } else if (
                    decimals.decimals0 <= 6 &&
                    (price <= 1e-5 || price >= 1e5)
                  ) {
                    seedAmount = parseUnits("100000", decimals.decimals0);
                  } else {
                    seedAmount = parseUnits("100", decimals.decimals0);
                  }

                  const seedParams: sdk.CalculateUniformLiquidityParams = {
                    amountInTokensPerBin: seedAmount,
                    amountIsInToken0: true,
                    currentPrice: price,
                    lowerBin: 0,
                    upperBin: 0,
                  };
                  await mintOnce(
                    publicClient,
                    pool.address,
                    stateView.address,
                    token0,
                    token1,
                    seedParams,
                    10_000n,
                  );
                }

                const params: sdk.CalculateUniformLiquidityParams = {
                  amountInTokensPerBin: pickAmount(
                    decimals.decimals0,
                    decimals.decimals1,
                    amountIsInToken0,
                    price,
                  ),
                  amountIsInToken0,
                  currentPrice: price,
                  lowerBin: binCase.bin,
                  upperBin: binCase.bin,
                };

                const spent = await mintOnce(
                  publicClient,
                  pool.address,
                  stateView.address,
                  token0,
                  token1,
                  params,
                  10_000n,
                );

                if (binCase.expect === "token1") {
                  assert.equal(spent.spent0, 0n);
                  assert.ok(spent.spent1 > 0n);
                } else if (binCase.expect === "token0") {
                  assert.ok(spent.spent0 > 0n);
                  assert.equal(spent.spent1, 0n);
                } else {
                  assert.ok(spent.spent0 + spent.spent1 > 0n);
                }
              });
            }
          }
        }
      });
    }
  }
});
