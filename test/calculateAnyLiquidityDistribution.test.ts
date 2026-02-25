import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits, getContract, type Address } from "viem";
import * as sdk from "../index.js";
import MockOracleArtifact from "../artifacts/@metric/core/contracts/mocks/MockOracle.sol/MockOracle.json";
import MockERC20Artifact from "../artifacts/@metric/core/contracts/mocks/MockERC20.sol/MockERC20.json";
import MetricOmmPoolStateViewArtifact from "../artifacts/@metric/core/contracts/MetricOmmPoolStateView.sol/MetricOmmPoolStateView.json";
import MetricOmmPoolArtifact from "../artifacts/@metric/core/contracts/MetricOmmPool.sol/MetricOmmPool.json";

describe("buildModifyLiquidityArgsForAddition", async function () {
  const { viem, networkHelpers } = await network.connect("hardhat");
  const [deployer] = await viem.getWalletClients();
  let saltCounter = 0n;

  const argsToPlan = (args: sdk.ModifyLiquidityArgs) => ({
    salt: args[0],
    deltas: args[1],
    specAmount0: args[2],
    specAmount1: args[3],
  });

  const buildModifyLiquidityArgsForAdditionPlan = async (
    publicClient: any,
    stateViewAddress: Address,
    poolAddress: Address,
    params: sdk.CalculateAnyLiquidityParams,
    salt: bigint = 0n,
    specAmountBufferPercent: number = 0,
  ) =>
    argsToPlan(
      await sdk.buildModifyLiquidityArgsForAddition({
        publicClient,
        stateViewAddress,
        poolAddress,
        bins: params.bins,
        currentPrice: params.currentPrice,
        salt,
        specAmountBufferPercent,
      }),
    );

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

    const q64Price = sdk.priceToQ64(1);
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

    await token0.write.approve([
      pool.address,
      parseUnits("1000000000000", decimals0),
    ]);
    await token1.write.approve([
      pool.address,
      parseUnits("1000000000000", decimals1),
    ]);

    return {
      publicClient,
      pool,
      stateView,
      token0,
      token1,
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

  const amountForSide = (
    amountInToken0: boolean,
    decimals0: number,
    decimals1: number,
    price: number,
  ): bigint => {
    const decimals = amountInToken0 ? decimals0 : decimals1;

    if (amountInToken0 && decimals0 <= 6 && decimals1 <= 6) {
      if (price <= 1e-5 || price >= 1e5) return parseUnits("1000000", decimals);
      return parseUnits("100000", decimals);
    }
    if (decimals <= 6 && (price <= 1e-5 || price >= 1e5)) {
      return parseUnits("100000", decimals);
    }
    return parseUnits("1000", decimals);
  };

  const planAndExecuteAny = async (
    publicClient: any,
    pool: Address,
    stateView: Address,
    token0: any,
    token1: any,
    params: sdk.CalculateAnyLiquidityParams,
    valueTolerancePpm: bigint,
  ) => {
    const before0 = (await token0.read.balanceOf([pool])) as bigint;
    const before1 = (await token1.read.balanceOf([pool])) as bigint;

    const salt = saltCounter++;
    const result = await buildModifyLiquidityArgsForAdditionPlan(
      publicClient,
      stateView,
      pool,
      params,
      salt,
    );
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

    assert.ok(spent0 >= 0n && spent0 <= result.specAmount0);
    assert.ok(spent1 >= 0n && spent1 <= result.specAmount1);

    if (result.specAmount0 > 0n) {
      const shortfall0 = result.specAmount0 - spent0;
      const allowedShortfall0 = result.specAmount0 / 100n + 1n;
      assert.ok(
        shortfall0 <= allowedShortfall0,
        `spec/spent mismatch token0: spec=${result.specAmount0}, spent=${spent0}, shortfall=${shortfall0}, allowed=${allowedShortfall0}`,
      );
    }
    if (result.specAmount1 > 0n) {
      const shortfall1 = result.specAmount1 - spent1;
      const allowedShortfall1 = result.specAmount1 / 100n + 1n;
      assert.ok(
        shortfall1 <= allowedShortfall1,
        `spec/spent mismatch token1: spec=${result.specAmount1}, spent=${spent1}, shortfall=${shortfall1}, allowed=${allowedShortfall1}`,
      );
    }

    const binsCount = BigInt(result.deltas.length);
    const headroom0 = result.specAmount0 - spent0;
    const headroom1 = result.specAmount1 - spent1;
    assert.ok(
      headroom0 <= binsCount,
      `specAmount0 headroom too large: ${headroom0} > ${binsCount}`,
    );
    assert.ok(
      headroom1 <= binsCount,
      `specAmount1 headroom too large: ${headroom1} > ${binsCount}`,
    );

    const immutables = await sdk.getPoolImmutables(publicClient, pool);
    const priceX18 = BigInt(Math.round(params.currentPrice * 1e18));

    let targetTotalInToken1 = 0n;
    for (const entry of params.bins) {
      targetTotalInToken1 += entry.amountInToken0
        ? toToken1Value(entry.amountInToken, immutables, priceX18)
        : entry.amountInToken;
    }

    const actualTotalInToken1 =
      spent1 + toToken1Value(spent0, immutables, priceX18);
    if (targetTotalInToken1 > 0n) {
      const diff =
        actualTotalInToken1 > targetTotalInToken1
          ? actualTotalInToken1 - targetTotalInToken1
          : targetTotalInToken1 - actualTotalInToken1;
      const allowed =
        (targetTotalInToken1 * valueTolerancePpm) / 1_000_000n + 1n;
      assert.ok(
        diff <= allowed,
        `value mismatch: provided ${actualTotalInToken1}, target ${targetTotalInToken1}, tol ppm ${valueTolerancePpm}`,
      );
    }

    return {
      spent0,
      spent1,
      headroom0,
      headroom1,
      result,
    };
  };

  async function setupEnv6_6() {
    saltCounter = 0n;
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

  const decimalPairs = [
    { label: "dec6/6", decimals0: 6, decimals1: 6 },
    { label: "dec18/6", decimals0: 18, decimals1: 6 },
    { label: "dec18/18", decimals0: 18, decimals1: 18 },
  ] as const;
  type DecimalLabel = (typeof decimalPairs)[number]["label"];
  const fixtureMap: Record<
    DecimalLabel,
    () => Promise<Awaited<ReturnType<typeof setupEnv>>>
  > = {
    "dec6/6": setupEnv6_6,
    "dec18/6": setupEnv18_6,
    "dec18/18": setupEnv18_18,
  };

  const prices = [1e-6, 1, 1_000_000];
  const amountModes = [true, false];
  const binCases = [
    { label: "below", bin: -1, expect: "token1" },
    { label: "current", bin: 0, expect: "mixed" },
    { label: "above", bin: 1, expect: "token0" },
  ];
  const poolStates = ["empty", "seeded"] as const;

  for (const decimals of decimalPairs) {
    for (const amountInToken0 of amountModes) {
      describe(`${decimals.label} / amountIn=${amountInToken0 ? "token0" : "token1"}`, () => {
        for (const price of prices) {
          for (const state of poolStates) {
            for (const binCase of binCases) {
              it(`${state} pool, price=${price}, bin=${binCase.label}`, async () => {
                const fixture = (await networkHelpers.loadFixture(
                  fixtureMap[decimals.label],
                )) as Awaited<ReturnType<typeof setupEnv>>;

                const {
                  publicClient,
                  pool,
                  stateView,
                  token0,
                  token1,
                  priceProvider,
                } = fixture;

                const q64Price = sdk.priceToQ64(price);
                await priceProvider.write.setBidAndAskPrice([
                  q64Price,
                  q64Price,
                ]);

                if (state === "seeded") {
                  const seedParams: sdk.CalculateAnyLiquidityParams = {
                    bins: [
                      {
                        bin: 0,
                        amountInToken: amountForSide(
                          true,
                          decimals.decimals0,
                          decimals.decimals1,
                          price,
                        ),
                        amountInToken0: true,
                      },
                    ],
                    currentPrice: price,
                  };
                  await planAndExecuteAny(
                    publicClient,
                    pool.address,
                    stateView.address,
                    token0,
                    token1,
                    seedParams,
                    10_000n,
                  );
                }

                const params: sdk.CalculateAnyLiquidityParams = {
                  bins: [
                    {
                      bin: binCase.bin,
                      amountInToken: amountForSide(
                        amountInToken0,
                        decimals.decimals0,
                        decimals.decimals1,
                        price,
                      ),
                      amountInToken0,
                    },
                  ],
                  currentPrice: price,
                };

                const { spent0, spent1, result } = await planAndExecuteAny(
                  publicClient,
                  pool.address,
                  stateView.address,
                  token0,
                  token1,
                  params,
                  10_000n,
                );

                assert.equal(result.deltas.length, 1);
                assert.ok(result.deltas[0].deltaShares > 0n);
                if (binCase.expect === "token1") {
                  assert.equal(spent0, 0n);
                  assert.ok(spent1 > 0n);
                } else if (binCase.expect === "token0") {
                  assert.ok(spent0 > 0n);
                  assert.equal(spent1, 0n);
                } else {
                  assert.ok(spent0 + spent1 > 0n);
                }
              });
            }
          }
        }
      });
    }
  }

  it("multi-bin plan equals sum of single-bin plans on same state", async () => {
    const { publicClient, pool, stateView, token0, token1, priceProvider } =
      await networkHelpers.loadFixture(setupEnv18_6);

    const price = 2000;
    const q64Price = sdk.priceToQ64(price);
    await priceProvider.write.setBidAndAskPrice([q64Price, q64Price]);

    const bins: sdk.AnyLiquidityBinInput[] = [
      { bin: -1, amountInToken: parseUnits("300", 6), amountInToken0: false },
      { bin: 0, amountInToken: parseUnits("1", 18), amountInToken0: true },
      { bin: 1, amountInToken: parseUnits("2", 18), amountInToken0: true },
    ];

    const multiPlan = await buildModifyLiquidityArgsForAdditionPlan(
      publicClient,
      stateView.address,
      pool.address,
      {
        bins,
        currentPrice: price,
      },
    );

    let sumSpec0 = 0n;
    let sumSpec1 = 0n;
    const singleDeltaByBin = new Map<number, bigint>();

    for (const entry of bins) {
      const singlePlan = await buildModifyLiquidityArgsForAdditionPlan(
        publicClient,
        stateView.address,
        pool.address,
        {
          bins: [entry],
          currentPrice: price,
        },
      );
      assert.equal(singlePlan.deltas.length, 1);
      singleDeltaByBin.set(entry.bin, singlePlan.deltas[0].deltaShares);
      sumSpec0 += singlePlan.specAmount0;
      sumSpec1 += singlePlan.specAmount1;
    }

    assert.equal(multiPlan.specAmount0, sumSpec0);
    assert.equal(multiPlan.specAmount1, sumSpec1);
    for (const delta of multiPlan.deltas) {
      assert.equal(delta.deltaShares, singleDeltaByBin.get(delta.bin));
    }

    const executed = await planAndExecuteAny(
      publicClient,
      pool.address,
      stateView.address,
      token0,
      token1,
      { bins, currentPrice: price },
      10_000n,
    );
    assert.equal(executed.result.deltas.length, 3);
  });

  it("throws when bins contain duplicates", async () => {
    const { publicClient, pool, stateView } =
      await networkHelpers.loadFixture(setupEnv18_6);

    await assert.rejects(
      buildModifyLiquidityArgsForAdditionPlan(
        publicClient,
        stateView.address,
        pool.address,
        {
          bins: [
            {
              bin: -1,
              amountInToken: parseUnits("100", 6),
              amountInToken0: false,
            },
            {
              bin: -1,
              amountInToken: parseUnits("200", 6),
              amountInToken0: false,
            },
          ],
          currentPrice: 1,
        },
      ),
      /duplicate bin -1 is not supported/,
    );
  });

  it("rejects invalid currentPrice", async () => {
    const { publicClient, pool, stateView } =
      await networkHelpers.loadFixture(setupEnv18_6);

    await assert.rejects(
      buildModifyLiquidityArgsForAdditionPlan(
        publicClient,
        stateView.address,
        pool.address,
        {
          bins: [
            {
              bin: 0,
              amountInToken: parseUnits("1", 18),
              amountInToken0: true,
            },
          ],
          currentPrice: 0,
        },
      ),
      /currentPrice must be a positive finite number/,
    );
  });
});
