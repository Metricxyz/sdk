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

  async function setupEnv(config?: {
    decimals0?: number;
    decimals1?: number;
    maxDriftE8?: bigint;
    curBinDistFromProvidedPriceE6?: number;
  }) {
    const decimals0 = config?.decimals0 ?? 18;
    const decimals1 = config?.decimals1 ?? 6;
    const maxDriftE8 = config?.maxDriftE8 ?? 50000n;
    const curBinDistFromProvidedPriceE6 =
      config?.curBinDistFromProvidedPriceE6 ?? 0;
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
      maxDriftE8,
      1n,
      10000,
      0,
      deployer.account.address,
      curBinDistFromProvidedPriceE6,
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
      targetTotalInToken1 += entry.targetValueInToken0
        ? toToken1Value(entry.targetValueInToken, immutables, priceX18)
        : entry.targetValueInToken;
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

  it("handles current-bin addition when curPosInBin is near an edge", async () => {
    const { publicClient, pool, stateView, token0, token1, priceProvider } =
      await networkHelpers.loadFixture(setupEnv18_6HighDrift);

    const maxUint104 = (1n << 104n) - 1n;
    const minTargetPos = (maxUint104 * 90n) / 100n;
    const maxLowerEdgePos = (maxUint104 * 10n) / 100n;

    const q64Price = sdk.priceToQ64(1);
    await priceProvider.write.setBidAndAskPrice([q64Price, q64Price]);

    const seedHash = await deployer.sendTransaction({
      to: pool.address,
      data: sdk.encodeModifyLiquidityCalldata([
        42n,
        [{ bin: 0, deltaShares: 10_000_000n }],
        sdk.NO_SLIPPAGE_LIMIT,
        sdk.NO_SLIPPAGE_LIMIT,
      ]),
    });
    await publicClient.waitForTransactionReceipt({ hash: seedHash });

    const beforeSlot0 = await sdk.getSlot0(
      publicClient,
      stateView.address,
      pool.address,
    );
    const immutables = await sdk.getPoolImmutables(publicClient, pool.address);
    const router = await viem.deployContract("MetricOmmSwapRouter", [
      token0.address,
    ]);
    await token0.write.approve([router.address, parseUnits("1000000", 18)]);
    await token1.write.approve([router.address, parseUnits("1000000", 6)]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const maxUint128 = (1n << 128n) - 1n;
    let selectedSlot0 = await sdk.getSlot0(
      publicClient,
      stateView.address,
      pool.address,
    );

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
          await router.write.swapExactInput([
            pool.address,
            deployer.account.address,
            candidate.zeroForOne,
            candidate.amountIn,
            candidate.priceLimitX64,
            0n,
            deadline,
          ]);
          selectedSlot0 = await sdk.getSlot0(
            publicClient,
            stateView.address,
            pool.address,
          );
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
      (selectedSlot0.curPosInBin >= minTargetPos &&
        selectedSlot0.curPosInBin < maxUint104) ||
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
      stateView.address,
      pool.address,
      [selectedSlot0.curBinIdx],
    );

    const { result, spent0, spent1 } = await planAndExecuteAny(
      publicClient,
      pool.address,
      stateView.address,
      token0,
      token1,
      params,
      30_000n,
    );

    const ceilDivLocal = (a: bigint, b: bigint) => (a + b - 1n) / b;

    const specDiff0 =
      result.specAmount0 >= spent0
        ? result.specAmount0 - spent0
        : spent0 - result.specAmount0;
    const specDiff1 =
      result.specAmount1 >= spent1
        ? result.specAmount1 - spent1
        : spent1 - result.specAmount1;
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
    const expectedSpent0 = ceilDivLocal(
      expectedAmount0Scaled,
      immutables.token0ScaleMultiplier,
    );
    const expectedSpent1 = ceilDivLocal(
      expectedAmount1Scaled,
      immutables.token1ScaleMultiplier,
    );

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

  it("buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount allocates weighted value proportionally", async () => {
    const { publicClient, pool, stateView, token0, token1, priceProvider } =
      await networkHelpers.loadFixture(setupEnv18_6HighDrift);

    const q64Price = sdk.priceToQ64(1);
    await priceProvider.write.setBidAndAskPrice([q64Price, q64Price]);

    const seedHash = await deployer.sendTransaction({
      to: pool.address,
      data: sdk.encodeModifyLiquidityCalldata([
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

    const slot0BeforeSwap = await sdk.getSlot0(
      publicClient,
      stateView.address,
      pool.address,
    );
    const immutables = await sdk.getPoolImmutables(publicClient, pool.address);
    const bin0StateBeforeSwap = await sdk.getBinStatesScaled(
      publicClient,
      stateView.address,
      pool.address,
      [slot0BeforeSwap.curBinIdx],
    );

    const token0AvailableExternal =
      bin0StateBeforeSwap.token0BalancesScaled[0] /
      immutables.token0ScaleMultiplier;
    const token1AvailableExternal =
      bin0StateBeforeSwap.token1BalancesScaled[0] /
      immutables.token1ScaleMultiplier;

    const swapOutToken0 = token0AvailableExternal >= token1AvailableExternal;
    const availableOutExternal = swapOutToken0
      ? token0AvailableExternal
      : token1AvailableExternal;
    const amountOutDesired =
      availableOutExternal > 1n ? availableOutExternal / 2n : 1n;
    assert.ok(
      availableOutExternal > 0n,
      "current bin has no available token balance for specified-out setup",
    );

    const router = await viem.deployContract("MetricOmmSwapRouter", [
      token0.address,
    ]);
    await token0.write.approve([router.address, parseUnits("1000000", 18)]);
    await token1.write.approve([router.address, parseUnits("1000000", 6)]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const maxUint128 = (1n << 128n) - 1n;
    await router.write.swapExactOutput([
      pool.address,
      deployer.account.address,
      swapOutToken0 ? false : true,
      amountOutDesired,
      maxUint128,
      swapOutToken0 ? parseUnits("1000000", 6) : parseUnits("1000000", 18),
      deadline,
    ]);

    const slot0AfterSwap = await sdk.getSlot0(
      publicClient,
      stateView.address,
      pool.address,
    );
    assert.ok(
      slot0AfterSwap.curBinIdx !== slot0BeforeSwap.curBinIdx ||
        slot0AfterSwap.curPosInBin !== slot0BeforeSwap.curPosInBin,
      "expected current bin position to move after specified-out swap",
    );

    const bins = [-3, -1, 0, 1, 3];
    const weights = [1, 2, 3, 2, 1];
    const totalValueToAddInToken = parseUnits("9", 6);

    const beforeTargetStates = await sdk.getBinStatesScaled(
      publicClient,
      stateView.address,
      pool.address,
      bins,
    );
    const slot0BeforeAdd = await sdk.getSlot0(
      publicClient,
      stateView.address,
      pool.address,
    );

    const args =
      await sdk.buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount({
        publicClient,
        stateViewAddress: stateView.address,
        poolAddress: pool.address,
        bins,
        weights,
        totalValueToAddInToken,
        totalValueInToken0: false,
        currentPriceX64: q64Price,
        salt: 888n,
        specAmountBufferPercent: 0,
      });

    const [salt, deltas, specAmount0, specAmount1] = args;
    assert.equal(salt, 888n);
    assert.equal(deltas.length, bins.length);

    const hash = await deployer.sendTransaction({
      to: pool.address,
      data: sdk.encodeModifyLiquidityCalldata(args),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");

    const binToIndex = new Map<number, number>();
    bins.forEach((bin, i) => binToIndex.set(bin, i));

    const ceilDivLocal = (a: bigint, b: bigint) => (a + b - 1n) / b;
    const maxUint104 = (1n << 104n) - 1n;

    const valuesInToken1: bigint[] = [];
    for (const delta of deltas) {
      const idx = binToIndex.get(delta.bin);
      assert.ok(idx != null, `unexpected delta bin ${delta.bin}`);

      const token0BalScaled = beforeTargetStates.token0BalancesScaled[idx!];
      const token1BalScaled = beforeTargetStates.token1BalancesScaled[idx!];
      const totalShares = beforeTargetStates.totalShares[idx!];

      const isBelowBin =
        delta.bin < slot0BeforeAdd.curBinIdx ||
        (delta.bin === slot0BeforeAdd.curBinIdx &&
          slot0BeforeAdd.curPosInBin === maxUint104);
      const isAboveBin =
        delta.bin > slot0BeforeAdd.curBinIdx ||
        (delta.bin === slot0BeforeAdd.curBinIdx &&
          slot0BeforeAdd.curPosInBin === 0n);

      let amount0ScaledToAdd = 0n;
      let amount1ScaledToAdd = 0n;

      if (totalShares > 0n) {
        amount0ScaledToAdd = ceilDivLocal(
          delta.deltaShares * token0BalScaled,
          totalShares,
        );
        amount1ScaledToAdd = ceilDivLocal(
          delta.deltaShares * token1BalScaled,
          totalShares,
        );
      } else if (isBelowBin) {
        amount1ScaledToAdd = ceilDivLocal(
          delta.deltaShares * immutables.initialScaledToken1PerShareE18,
          1_000_000_000_000_000_000n,
        );
      } else if (isAboveBin) {
        amount0ScaledToAdd = ceilDivLocal(
          delta.deltaShares * immutables.initialScaledToken0PerShareE18,
          1_000_000_000_000_000_000n,
        );
      } else {
        const token0Portion = maxUint104 - slot0BeforeAdd.curPosInBin;
        const token1Portion = slot0BeforeAdd.curPosInBin;
        amount0ScaledToAdd = ceilDivLocal(
          delta.deltaShares *
            immutables.initialScaledToken0PerShareE18 *
            token0Portion,
          1_000_000_000_000_000_000n * maxUint104,
        );
        amount1ScaledToAdd = ceilDivLocal(
          delta.deltaShares *
            immutables.initialScaledToken1PerShareE18 *
            token1Portion,
          1_000_000_000_000_000_000n * maxUint104,
        );
      }

      const amount0External = ceilDivLocal(
        amount0ScaledToAdd,
        immutables.token0ScaleMultiplier,
      );
      const amount1External = ceilDivLocal(
        amount1ScaledToAdd,
        immutables.token1ScaleMultiplier,
      );
      const valueInToken1 =
        amount1External +
        toToken1Value(amount0External, immutables, 1_000_000_000_000_000_000n);

      valuesInToken1.push(valueInToken1);
    }

    const unitValues = valuesInToken1.map(
      (value, i) => (value * 1_000_000n) / BigInt(weights[i]),
    );
    const minUnitValue = unitValues.reduce(
      (m, v) => (v < m ? v : m),
      unitValues[0],
    );
    const maxUnitValue = unitValues.reduce(
      (m, v) => (v > m ? v : m),
      unitValues[0],
    );
    const unitSpread = maxUnitValue - minUnitValue;
    const allowedSpread = maxUnitValue / 5n + 1n; // 20%

    assert.ok(
      unitSpread <= allowedSpread,
      `weighted per-bin values are not proportional enough; spread=${unitSpread}, max=${maxUnitValue}`,
    );

    const specDiff1 =
      specAmount1 > totalValueToAddInToken
        ? specAmount1 - totalValueToAddInToken
        : totalValueToAddInToken - specAmount1;
    const allowedSpecDiff1 = totalValueToAddInToken / 10n + 1n; // 10%
    assert.ok(
      specDiff1 <= allowedSpecDiff1,
      `specAmount1 not close to target total; spec=${specAmount1}, target=${totalValueToAddInToken}, diff=${specDiff1}, specAmount0=${specAmount0}`,
    );
  });

  it("buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount avoids int104 overflow in calibration for high-price token1 inputs", async () => {
    const { publicClient, pool, stateView } =
      await networkHelpers.loadFixture(setupEnv18_6);

    const args =
      await sdk.buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount({
        publicClient,
        stateViewAddress: stateView.address,
        poolAddress: pool.address,
        bins: [-2, -1, 0, 1],
        totalValueToAddInToken: 1_000_000n,
        totalValueInToken0: false,
        currentPriceX64: 1309319182557697118630402n,
        specAmountBufferPercent: 0.01,
      });

    assert.equal(args[1].length, 4);
    for (const delta of args[1]) {
      assert.ok(delta.deltaShares > 0n);
      assert.ok(delta.deltaShares <= sdk.MAX_INT104);
    }
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
