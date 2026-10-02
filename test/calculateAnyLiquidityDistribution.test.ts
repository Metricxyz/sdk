import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits, getContract, type Address } from "viem";
import * as sdk from "../src/index.js";
import { deployLinkedPoolDeployer, testBidAskPriceQ64FromMid } from "./shared/testEnv.js";
import { encodeAddLiquidityCalldata } from "./shared/liquidityTx.js";
import { getPoolAddressFromCreateReceipt } from "./shared/getPoolAddressFromCreateReceipt.js";
import MockOracleArtifact from "../artifacts/@metric/core/test/mocks/MockOracle.sol/MockOracle.json";
import MockERC20Artifact from "../artifacts/@metric/core/test/mocks/MockERC20.sol/MockERC20.json";
import { MetricOmmPoolDataProviderAbi } from "../src/abis/MetricOmmPoolDataProvider.js";
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
    factoryAddress: Address,
    dataProviderAddress: Address,
    poolAddress: Address,
    params: sdk.CalculateAnyLiquidityParams,
    salt: bigint = 0n,
    specAmountBufferPercent: number = 0,
  ) =>
    argsToPlan(
      await sdk.buildModifyLiquidityArgsForAddition({
        publicClient,
        factoryAddress,
        dataProviderAddress,
        poolAddress,
        bins: params.bins,
        currentPrice: params.currentPrice,
        salt,
        specAmountBufferPercent,
      }),
    );

  async function setupEnv(config?: {
    decimals0?: number;
    decimals1?: number;
    maxDriftE8?: bigint;
    curBinDistFromProvidedPriceE6?: number;
  }) {
    const decimals0 = config?.decimals0 ?? 18;
    const decimals1 = config?.decimals1 ?? 6;
    const _maxDriftE8 = config?.maxDriftE8 ?? 50000n;
    const _curBinDistFromProvidedPriceE6 = config?.curBinDistFromProvidedPriceE6 ?? 0;
    void _maxDriftE8;
    void _curBinDistFromProvidedPriceE6;
    const publicClient = await viem.getPublicClient();

    const token0Deployment = await viem.deployContract("MockERC20", ["Token0", "TK0", decimals0]);
    const token1Deployment = await viem.deployContract("MockERC20", ["Token1", "TK1", decimals1]);

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

    await token0.write.mint([deployer.account.address, parseUnits("1000000000000", decimals0)]);
    await token1.write.mint([deployer.account.address, parseUnits("1000000000000", decimals1)]);

    const factory = await viem.deployContract("MetricOmmPoolFactory", [
      deployer.account.address,
      deployer.account.address,
      0,
      0,
      65_535,
    ]);
    const poolDeployer = await deployLinkedPoolDeployer(viem, factory.address);
    await factory.write.setPoolDeployer([poolDeployer.address]);

    const dataProviderDeployment = await viem.deployContract("MetricOmmPoolDataProvider", [
      factory.address,
    ]);
    const dataProvider = getContract({
      address: dataProviderDeployment.address,
      abi: MetricOmmPoolDataProviderAbi,
      client: { public: publicClient, wallet: deployer },
    });

    const wethDeployment = await viem.deployContract("MockWETH9", []);
    const liquidityAdder = (
      await viem.deployContract("MetricOmmPoolLiquidityAdder", [
        factory.address,
        wethDeployment.address,
      ])
    ).address;

    const priceProviderDeployment = await viem.deployContract("MockOracle", []);
    const priceProvider = getContract({
      address: priceProviderDeployment.address,
      abi: MockOracleArtifact.abi,
      client: { public: publicClient, wallet: deployer },
    });

    await priceProvider.write.setTokens([token0.address, token1.address]);
    const q64Price = sdk.priceToQ64(1);
    await priceProvider.write.setBidAndAskPrice([...testBidAskPriceQ64FromMid(q64Price)]);

    const createHash = await deployer.sendTransaction({
      to: factory.address,
      data: sdk.encodeCreatePoolCalldata({
        token0: token0.address,
        token1: token1.address,
        priceProvider: priceProvider.address,
        admin: deployer.account.address,
        adminFeeDestination: deployer.account.address,
        adminSpreadFeeE6: 5000,
        adminNotionalFeeE8: 0,
        protocolSpreadFeeE6: 0,
        protocolNotionalFeeE8: 0,
        bidAskRefAsymmetryX8: 65_535,
        curBinDistFromProvidedPricePercent: 0,
        initialScaledAmount0PerE18Shares: parseUnits("1", 18),
        initialScaledAmount1PerE18Shares: parseUnits("1", 18),
        minimalOperationalLiquidity: 1_000_000n,
        nonNegativeBins: sdk.createUniformBins(20, 10000, 0, 0),
        negativeBins: sdk.createUniformBins(20, 10000, 0, 0),
      }),
    });
    const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
    const poolAddress = getPoolAddressFromCreateReceipt(createReceipt.logs);

    const pool = getContract({
      address: poolAddress,
      abi: MetricOmmPoolArtifact.abi,
      client: { public: publicClient, wallet: deployer },
    });

    await token0.write.approve([liquidityAdder, parseUnits("1000000000000", decimals0)]);
    await token1.write.approve([liquidityAdder, parseUnits("1000000000000", decimals1)]);

    return {
      publicClient,
      pool,
      poolAddress,
      factory,
      dataProvider,
      liquidityAdder,
      token0,
      token1,
      priceProvider,
    };
  }

  const toToken1Value = (amount0: bigint, immutables: sdk.PoolImmutables, priceX18: bigint) =>
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
    factory: Address,
    dataProvider: Address,
    liquidityAdder: Address,
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
      factory,
      dataProvider,
      pool,
      params,
      salt,
    );
    const hash = await deployer.sendTransaction({
      to: liquidityAdder,
      data: encodeAddLiquidityCalldata(pool, [
        result.salt,
        result.deltas,
        result.specAmount0,
        result.specAmount1,
      ]),
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

    const immutables = await sdk.getPoolImmutables(publicClient, factory, pool);
    const priceX18 = BigInt(Math.round(params.currentPrice * 1e18));

    let targetTotalInToken1 = 0n;
    for (const entry of params.bins) {
      targetTotalInToken1 += entry.targetValueInToken0
        ? toToken1Value(entry.targetValueInToken, immutables, priceX18)
        : entry.targetValueInToken;
    }

    const actualTotalInToken1 = spent1 + toToken1Value(spent0, immutables, priceX18);
    if (targetTotalInToken1 > 0n) {
      const diff =
        actualTotalInToken1 > targetTotalInToken1
          ? actualTotalInToken1 - targetTotalInToken1
          : targetTotalInToken1 - actualTotalInToken1;
      const allowed = (targetTotalInToken1 * valueTolerancePpm) / 1_000_000n + 1n;
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
  async function setupEnv18_6HighDrift() {
    saltCounter = 0n;
    return setupEnv({
      decimals0: 18,
      decimals1: 6,
      maxDriftE8: 1_000_000n,
    });
  }

  const decimalPairs = [
    { label: "dec6/6", decimals0: 6, decimals1: 6 },
    { label: "dec18/6", decimals0: 18, decimals1: 6 },
    { label: "dec18/18", decimals0: 18, decimals1: 18 },
  ] as const;
  type DecimalLabel = (typeof decimalPairs)[number]["label"];
  const fixtureMap: Record<DecimalLabel, () => Promise<Awaited<ReturnType<typeof setupEnv>>>> = {
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
                  factory,
                  dataProvider,
                  liquidityAdder,
                  token0,
                  token1,
                  priceProvider,
                } = fixture;

                const q64Price = sdk.priceToQ64(price);
                await priceProvider.write.setBidAndAskPrice([
                  ...testBidAskPriceQ64FromMid(q64Price),
                ]);

                if (state === "seeded") {
                  const seedParams: sdk.CalculateAnyLiquidityParams = {
                    bins: [
                      {
                        bin: 0,
                        targetValueInToken: amountForSide(
                          true,
                          decimals.decimals0,
                          decimals.decimals1,
                          price,
                        ),
                        targetValueInToken0: true,
                      },
                    ],
                    currentPrice: price,
                  };
                  await planAndExecuteAny(
                    publicClient,
                    pool.address,
                    factory.address,
                    dataProvider.address,
                    liquidityAdder,
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
                      targetValueInToken: amountForSide(
                        amountInToken0,
                        decimals.decimals0,
                        decimals.decimals1,
                        price,
                      ),
                      targetValueInToken0: amountInToken0,
                    },
                  ],
                  currentPrice: price,
                };

                const { spent0, spent1, result } = await planAndExecuteAny(
                  publicClient,
                  pool.address,
                  factory.address,
                  dataProvider.address,
                  liquidityAdder,
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
    const {
      publicClient,
      pool,
      factory,
      dataProvider,
      liquidityAdder,
      token0,
      token1,
      priceProvider,
    } = await networkHelpers.loadFixture(setupEnv18_6);

    const price = 2000;
    const q64Price = sdk.priceToQ64(price);
    await priceProvider.write.setBidAndAskPrice([...testBidAskPriceQ64FromMid(q64Price)]);

    const bins: sdk.LiquidityBinValueInput[] = [
      {
        bin: -1,
        targetValueInToken: parseUnits("300", 6),
        targetValueInToken0: false,
      },
      {
        bin: 0,
        targetValueInToken: parseUnits("1", 18),
        targetValueInToken0: true,
      },
      {
        bin: 1,
        targetValueInToken: parseUnits("2", 18),
        targetValueInToken0: true,
      },
    ];

    const multiPlan = await buildModifyLiquidityArgsForAdditionPlan(
      publicClient,
      factory.address,
      dataProvider.address,
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
        factory.address,
        dataProvider.address,
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
      factory.address,
      dataProvider.address,
      liquidityAdder,
      token0,
      token1,
      { bins, currentPrice: price },
      10_000n,
    );
    assert.equal(executed.result.deltas.length, 3);
  });

  it("handles current-bin addition when curPosInBin is near an edge", async () => {
    const {
      publicClient,
      pool,
      factory,
      dataProvider,
      liquidityAdder,
      token0,
      token1,
      priceProvider,
    } = await networkHelpers.loadFixture(setupEnv18_6HighDrift);

    const maxUint104 = (1n << 104n) - 1n;
    const minTargetPos = (maxUint104 * 90n) / 100n;
    const maxLowerEdgePos = (maxUint104 * 10n) / 100n;

    await priceProvider.write.setTokens([token0.address, token1.address]);
    const q64Price = sdk.priceToQ64(1);
    await priceProvider.write.setBidAndAskPrice([...testBidAskPriceQ64FromMid(q64Price)]);

    const seedHash = await deployer.sendTransaction({
      to: liquidityAdder,
      data: encodeAddLiquidityCalldata(pool.address, [
        42n,
        [{ bin: 0, deltaShares: 10_000_000n }],
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      ]),
    });
    await publicClient.waitForTransactionReceipt({ hash: seedHash });

    const immutables = await sdk.getPoolImmutables(publicClient, factory.address, pool.address);
    const weth = await viem.deployContract("MockWETH9", []);
    const simpleRouter = await viem.deployContract("MetricOmmSimpleRouter", [
      weth.address,
      factory.address,
    ]);
    await token0.write.approve([simpleRouter.address, parseUnits("1000000", 18)]);
    await token1.write.approve([simpleRouter.address, parseUnits("1000000", 6)]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    let selectedSlot0 = await sdk.getSlot0(publicClient, dataProvider.address, pool.address);

    for (let i = 0; i < 20; i++) {
      if (selectedSlot0.curPosInBin >= minTargetPos) break;

      const posBefore = selectedSlot0.curPosInBin;
      let swapApplied = false;
      const candidates = [
        {
          zeroForOne: true,
          amountIn: parseUnits("100", 18),
          priceLimitX64: 1n,
        },
        {
          zeroForOne: true,
          amountIn: parseUnits("10", 18),
          priceLimitX64: 1n,
        },
        {
          zeroForOne: true,
          amountIn: parseUnits("1", 18),
          priceLimitX64: 1n,
        },
      ];

      for (const candidate of candidates) {
        try {
          await simpleRouter.write.exactInputSingle([
            {
              pool: pool.address,
              tokenIn: candidate.zeroForOne ? token0.address : token1.address,
              tokenOut: candidate.zeroForOne ? token1.address : token0.address,
              zeroForOne: candidate.zeroForOne,
              amountIn: candidate.amountIn,
              amountOutMinimum: 0n,
              recipient: deployer.account.address,
              deadline,
              priceLimitX64: candidate.priceLimitX64,
              extensionData: "0x",
            },
          ]);
          selectedSlot0 = await sdk.getSlot0(publicClient, dataProvider.address, pool.address);
          if (selectedSlot0.curPosInBin > posBefore) {
            swapApplied = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!swapApplied) {
        break;
      }
    }

    assert.ok(
      (selectedSlot0.curPosInBin >= minTargetPos && selectedSlot0.curPosInBin < maxUint104) ||
        selectedSlot0.curPosInBin <= maxLowerEdgePos,
      `failed to move curPosInBin near an edge with specified-in setup; got ${selectedSlot0.curPosInBin}`,
    );

    const params: sdk.CalculateAnyLiquidityParams = {
      bins: [
        {
          bin: selectedSlot0.curBinIdx,
          targetValueInToken: parseUnits("2", 6),
          targetValueInToken0: false,
        },
      ],
      currentPrice: 1,
    };

    const beforeAddBinState = await sdk.getBinStatesScaled(
      publicClient,
      dataProvider.address,
      pool.address,
      [selectedSlot0.curBinIdx],
    );

    const { result, spent0, spent1 } = await planAndExecuteAny(
      publicClient,
      pool.address,
      factory.address,
      dataProvider.address,
      liquidityAdder,
      token0,
      token1,
      params,
      30_000n,
    );

    const ceilDivLocal = (a: bigint, b: bigint) => (a + b - 1n) / b;

    const specDiff0 =
      result.specAmount0 >= spent0 ? result.specAmount0 - spent0 : spent0 - result.specAmount0;
    const specDiff1 =
      result.specAmount1 >= spent1 ? result.specAmount1 - spent1 : spent1 - result.specAmount1;
    const allowedSpecDiff0 = 1n;
    const allowedSpecDiff1 = 1n;

    const beforeToken0Scaled = beforeAddBinState.token0BalancesScaled[0];
    const beforeToken1Scaled = beforeAddBinState.token1BalancesScaled[0];
    const beforeTotalShares = beforeAddBinState.totalShares[0];
    assert.ok(beforeTotalShares > 0n, "expected non-empty current bin");

    const expectedAmount0Scaled = ceilDivLocal(
      result.deltas[0].deltaShares * beforeToken0Scaled,
      beforeTotalShares,
    );
    const expectedAmount1Scaled = ceilDivLocal(
      result.deltas[0].deltaShares * beforeToken1Scaled,
      beforeTotalShares,
    );
    const expectedSpent0 = ceilDivLocal(expectedAmount0Scaled, immutables.token0ScaleMultiplier);
    const expectedSpent1 = ceilDivLocal(expectedAmount1Scaled, immutables.token1ScaleMultiplier);

    assert.equal(result.deltas.length, 1);
    assert.equal(result.deltas[0].bin, selectedSlot0.curBinIdx);
    assert.ok(result.deltas[0].deltaShares > 0n);
    assert.ok(spent0 > 0n || spent1 > 0n);
    assert.ok(
      specDiff0 <= allowedSpecDiff0,
      `specAmount0 not close to spent0; spec=${result.specAmount0}, spent=${spent0}, diff=${specDiff0}`,
    );
    assert.ok(
      specDiff1 <= allowedSpecDiff1,
      `specAmount1 not close to spent1; spec=${result.specAmount1}, spent=${spent1}, diff=${specDiff1}`,
    );
    assert.equal(
      spent0,
      expectedSpent0,
      `token0 spent is not proportional to minted shares; expected=${expectedSpent0}, got=${spent0}`,
    );
    assert.equal(
      spent1,
      expectedSpent1,
      `token1 spent is not proportional to minted shares; expected=${expectedSpent1}, got=${spent1}`,
    );
    assert.ok(
      result.specAmount1 < parseUnits("50", 6),
      `specAmount1 looks inflated near high curPosInBin: ${result.specAmount1}`,
    );
  });

  const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

  async function setupSeededEnv18_6HighDrift() {
    const env = await setupEnv18_6HighDrift();
    const seedHash = await deployer.sendTransaction({
      to: env.liquidityAdder,
      data: encodeAddLiquidityCalldata(env.pool.address, [
        777n,
        [
          { bin: -1, deltaShares: 10_000_000n },
          { bin: 0, deltaShares: 10_000_000n },
          { bin: 1, deltaShares: 10_000_000n },
        ],
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      ]),
    });
    await env.publicClient.waitForTransactionReceipt({ hash: seedHash });
    return env;
  }

  async function swapHalfOfCurrentBin(
    env: Awaited<ReturnType<typeof setupSeededEnv18_6HighDrift>>,
  ) {
    const { publicClient, pool, factory, dataProvider, token0, token1 } = env;
    const slot0BeforeSwap = await sdk.getSlot0(publicClient, dataProvider.address, pool.address);
    const immutables = await sdk.getPoolImmutables(publicClient, factory.address, pool.address);
    const bin0StateBeforeSwap = await sdk.getBinStatesScaled(
      publicClient,
      dataProvider.address,
      pool.address,
      [slot0BeforeSwap.curBinIdx],
    );

    const token0AvailableExternal =
      bin0StateBeforeSwap.token0BalancesScaled[0] / immutables.token0ScaleMultiplier;
    const token1AvailableExternal =
      bin0StateBeforeSwap.token1BalancesScaled[0] / immutables.token1ScaleMultiplier;

    const swapOutToken0 = token0AvailableExternal >= token1AvailableExternal;
    const availableOutExternal = swapOutToken0 ? token0AvailableExternal : token1AvailableExternal;
    const amountOutDesired = availableOutExternal > 1n ? availableOutExternal / 2n : 1n;
    assert.ok(
      availableOutExternal > 0n,
      "current bin has no available token balance for specified-out setup",
    );

    const weth = await viem.deployContract("MockWETH9", []);
    const simpleRouter = await viem.deployContract("MetricOmmSimpleRouter", [
      weth.address,
      factory.address,
    ]);
    await token0.write.approve([simpleRouter.address, parseUnits("1000000", 18)]);
    await token1.write.approve([simpleRouter.address, parseUnits("1000000", 6)]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const maxUint128 = (1n << 128n) - 1n;
    await simpleRouter.write.exactOutputSingle([
      {
        pool: pool.address,
        tokenIn: swapOutToken0 ? token1.address : token0.address,
        tokenOut: swapOutToken0 ? token0.address : token1.address,
        zeroForOne: swapOutToken0 ? false : true,
        amountOut: amountOutDesired,
        amountInMaximum: swapOutToken0 ? parseUnits("1000000", 6) : parseUnits("1000000", 18),
        recipient: deployer.account.address,
        deadline,
        priceLimitX64: maxUint128,
        extensionData: "0x",
      },
    ]);

    const slot0AfterSwap = await sdk.getSlot0(publicClient, dataProvider.address, pool.address);
    assert.ok(
      slot0AfterSwap.curBinIdx !== slot0BeforeSwap.curBinIdx ||
        slot0AfterSwap.curPosInBin !== slot0BeforeSwap.curPosInBin,
      "expected current bin position to move after specified-out swap",
    );
  }

  it("buildAddLiquidityWeightedParams deposits an exact token1 wallet balance after the cursor moved", async () => {
    const env = await networkHelpers.loadFixture(setupSeededEnv18_6HighDrift);
    const { publicClient, pool, factory, dataProvider, liquidityAdder, token0, token1 } = env;
    const q64Price = sdk.priceToQ64(1);

    await swapHalfOfCurrentBin(env);

    const totalValueToAddInToken = parseUnits("9", 6);
    const balance1 = (await token1.read.balanceOf([deployer.account.address])) as bigint;
    await token1.write.transfer([DEAD_ADDRESS, balance1 - totalValueToAddInToken]);
    const balance0 = (await token0.read.balanceOf([deployer.account.address])) as bigint;

    const params = await sdk.buildAddLiquidityWeightedParams({
      publicClient,
      factoryAddress: factory.address,
      dataProviderAddress: dataProvider.address,
      poolAddress: pool.address,
      bins: [-3, -1, 0, 1, 3],
      weights: [1, 2, 3, 2, 1],
      currentPriceX64: q64Price,
      maxAmountToken0: balance0,
      maxAmountToken1: totalValueToAddInToken,
      maxOracleDistanceChangePercent: 0.5,
      salt: 888n,
    });

    const hash = await deployer.sendTransaction({
      to: liquidityAdder,
      data: sdk.encodeAddLiquidityWeightedSelfCalldata({ pool: pool.address, ...params }),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");

    const spent1 =
      totalValueToAddInToken -
      ((await token1.read.balanceOf([deployer.account.address])) as bigint);
    assert.ok(
      spent1 * 1000n >= totalValueToAddInToken * 999n,
      `spent ${spent1} far below budget ${totalValueToAddInToken}`,
    );
  });

  it("buildAddLiquidityWeightedParams reverts once the pool moved further from the oracle than allowed", async () => {
    const env = await networkHelpers.loadFixture(setupSeededEnv18_6HighDrift);
    const { publicClient, pool, factory, dataProvider, liquidityAdder, token0, token1 } = env;
    const buildWithBound = async (maxOracleDistanceChangePercent: number) =>
      sdk.buildAddLiquidityWeightedParams({
        publicClient,
        factoryAddress: factory.address,
        dataProviderAddress: dataProvider.address,
        poolAddress: pool.address,
        bins: [-3, -1, 0, 1, 3],
        currentPriceX64: sdk.priceToQ64(1),
        maxAmountToken0: (await token0.read.balanceOf([deployer.account.address])) as bigint,
        maxAmountToken1: parseUnits("9", 6),
        maxOracleDistanceChangePercent,
      });
    const tight = await buildWithBound(0.0001);
    const loose = await buildWithBound(5);

    await swapHalfOfCurrentBin(env);

    await assert.rejects(
      deployer.sendTransaction({
        to: liquidityAdder,
        data: sdk.encodeAddLiquidityWeightedSelfCalldata({ pool: pool.address, ...tight }),
      }),
      /BinPositionOutOfBounds/,
    );
    const hash = await deployer.sendTransaction({
      to: liquidityAdder,
      data: sdk.encodeAddLiquidityWeightedSelfCalldata({ pool: pool.address, ...loose }),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");
  });

  it("buildAddLiquidityWeightedParams stops at the token0 cap when token0 binds first", async () => {
    const { publicClient, pool, factory, dataProvider, liquidityAdder, token0, token1 } =
      await networkHelpers.loadFixture(setupEnv18_6);
    const seedHash = await deployer.sendTransaction({
      to: liquidityAdder,
      data: encodeAddLiquidityCalldata(pool.address, [
        777n,
        [
          { bin: -1, deltaShares: 10_000_000n },
          { bin: 0, deltaShares: 10_000_000n },
          { bin: 1, deltaShares: 10_000_000n },
        ],
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      ]),
    });
    await publicClient.waitForTransactionReceipt({ hash: seedHash });

    const budget0 = parseUnits("2", 18);
    const balance0Before = (await token0.read.balanceOf([deployer.account.address])) as bigint;
    const params = await sdk.buildAddLiquidityWeightedParams({
      publicClient,
      factoryAddress: factory.address,
      dataProviderAddress: dataProvider.address,
      poolAddress: pool.address,
      bins: [-3, -1, 0, 1, 3],
      currentPriceX64: sdk.priceToQ64(1),
      maxAmountToken0: budget0,
      maxAmountToken1: (await token1.read.balanceOf([deployer.account.address])) as bigint,
      maxOracleDistanceChangePercent: 0.5,
    });
    const hash = await deployer.sendTransaction({
      to: liquidityAdder,
      data: sdk.encodeAddLiquidityWeightedSelfCalldata({ pool: pool.address, ...params }),
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const spent0 =
      balance0Before - ((await token0.read.balanceOf([deployer.account.address])) as bigint);
    assert.ok(spent0 <= budget0, `spent ${spent0} exceeds budget ${budget0}`);
    assert.ok(spent0 * 1000n >= budget0 * 999n, `spent ${spent0} far below budget ${budget0}`);
  });

  for (const token0Only of [true, false]) {
    it(`preserves a 1:9 one-sided distribution with dust in the unused token (${token0Only ? "token0" : "token1"})`, async () => {
      const { publicClient, pool, factory, dataProvider, liquidityAdder } =
        await networkHelpers.loadFixture(setupEnv18_6);
      const bins = token0Only ? [1, 2] : [-2, -1];
      const build = (unusedCap: bigint, weights = [1, 9]) =>
        sdk.buildAddLiquidityWeightedParams({
          publicClient,
          factoryAddress: factory.address,
          dataProviderAddress: dataProvider.address,
          poolAddress: pool.address,
          bins,
          weights,
          currentPriceX64: sdk.priceToQ64(1),
          maxAmountToken0: token0Only ? parseUnits("1", 18) : unusedCap,
          maxAmountToken1: token0Only ? unusedCap : parseUnits("1", 6),
          maxOracleDistanceChangePercent: 0.5,
        });
      const withoutDust = await build(0n);
      const withDust = await build(1n);
      assert.deepEqual(withDust.weightDeltas, withoutDust.weightDeltas);
      const smallRelativeWeights = await build(1n, [1e-7, 9e-7]);
      assert.deepEqual(smallRelativeWeights.weightDeltas, withDust.weightDeltas);
      const hash = await deployer.sendTransaction({
        to: liquidityAdder,
        data: sdk.encodeAddLiquidityWeightedSelfCalldata({ pool: pool.address, ...withDust }),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success");
      const states = await sdk.getBinStatesScaled(
        publicClient,
        dataProvider.address,
        pool.address,
        bins,
      );
      const balances = token0Only ? states.token0BalancesScaled : states.token1BalancesScaled;
      const error = balances[1] - balances[0] * 9n;
      assert.ok(
        error >= -10n && error <= 10n,
        `deposited balances lost their 1:9 ratio: ${balances}`,
      );
    });
  }

  it("deposits token0 amounts worth less than one token1 base unit", async () => {
    const { publicClient, pool, factory, dataProvider, liquidityAdder, token0, token1 } =
      await networkHelpers.loadFixture(setupEnv18_6);
    const cap = 100_000_000_000n;
    const before0 = (await token0.read.balanceOf([pool.address])) as bigint;
    const before1 = (await token1.read.balanceOf([pool.address])) as bigint;
    const params = await sdk.buildAddLiquidityWeightedParams({
      publicClient,
      factoryAddress: factory.address,
      dataProviderAddress: dataProvider.address,
      poolAddress: pool.address,
      bins: [1],
      currentPriceX64: sdk.priceToQ64(1),
      maxAmountToken0: cap,
      maxAmountToken1: 0n,
      maxOracleDistanceChangePercent: 0.5,
    });
    const hash = await deployer.sendTransaction({
      to: liquidityAdder,
      data: sdk.encodeAddLiquidityWeightedSelfCalldata({ pool: pool.address, ...params }),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");
    const spent0 = ((await token0.read.balanceOf([pool.address])) as bigint) - before0;
    assert.ok(spent0 > 0n && spent0 <= cap);
    assert.ok(cap - spent0 <= 2n);
    assert.equal(await token1.read.balanceOf([pool.address]), before1);
  });

  it("preserves mixed-bin value weights when a small cap needs a larger calibration probe", async () => {
    const { publicClient, pool, factory, dataProvider } =
      await networkHelpers.loadFixture(setupEnv18_6);
    const params = await sdk.buildAddLiquidityWeightedParams({
      publicClient,
      factoryAddress: factory.address,
      dataProviderAddress: dataProvider.address,
      poolAddress: pool.address,
      bins: [-1, 1],
      weights: [1, 9],
      currentPriceX64: sdk.priceToQ64(1),
      maxAmountToken0: 1n,
      maxAmountToken1: 1n,
      maxOracleDistanceChangePercent: 0.5,
    });
    assert.equal(params.weightDeltas.shares[1], params.weightDeltas.shares[0] * 9n);
    assert.equal(params.maxAmountToken0, 1n);
    assert.equal(params.maxAmountToken1, 1n);
  });

  it("buildAddLiquidityWeightedParams keeps share weights within int104 for high-price inputs", async () => {
    const { publicClient, pool, factory, dataProvider } =
      await networkHelpers.loadFixture(setupEnv18_6);

    const params = await sdk.buildAddLiquidityWeightedParams({
      publicClient,
      factoryAddress: factory.address,
      dataProviderAddress: dataProvider.address,
      poolAddress: pool.address,
      bins: [-2, -1, 0, 1],
      currentPriceX64: 1309319182557697118630402n,
      maxAmountToken0: parseUnits("1000000", 18),
      maxAmountToken1: 1_000_000n,
      maxOracleDistanceChangePercent: 0.5,
    });

    assert.equal(params.weightDeltas.shares.length, 4);
    for (const share of params.weightDeltas.shares) {
      assert.ok(share > 0n);
      assert.ok(share <= sdk.MAX_INT104);
    }
  });

  it("throws when bins contain duplicates", async () => {
    const { publicClient, pool, factory, dataProvider } =
      await networkHelpers.loadFixture(setupEnv18_6);

    await assert.rejects(
      buildModifyLiquidityArgsForAdditionPlan(
        publicClient,
        factory.address,
        dataProvider.address,
        pool.address,
        {
          bins: [
            {
              bin: -1,
              targetValueInToken: parseUnits("100", 6),
              targetValueInToken0: false,
            },
            {
              bin: -1,
              targetValueInToken: parseUnits("200", 6),
              targetValueInToken0: false,
            },
          ],
          currentPrice: 1,
        },
      ),
      /duplicate bin -1 is not supported/,
    );
  });

  it("rejects invalid currentPrice", async () => {
    const { publicClient, pool, factory, dataProvider } =
      await networkHelpers.loadFixture(setupEnv18_6);

    await assert.rejects(
      buildModifyLiquidityArgsForAdditionPlan(
        publicClient,
        factory.address,
        dataProvider.address,
        pool.address,
        {
          bins: [
            {
              bin: 0,
              targetValueInToken: parseUnits("1", 18),
              targetValueInToken0: true,
            },
          ],
          currentPrice: 0,
        },
      ),
      /currentPrice must be a positive finite number/,
    );
  });
});
