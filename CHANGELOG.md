# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-06-08

> **NOT backward compatible.** This release tracks a hooks-era **metric-core** and **metric-periphery** upgrade. On-chain ABIs changed in ways that break existing integrators at both the **smart-contract** and **SDK** level. Do not assume calldata, selectors, immutables layout, or factory read paths from `0.1.x` still work.
>
> Pinned upstream: **metric-core** `bc0fe2be62468d040aff73e78cad1ef3805c4d33`, **metric-periphery** `64c336d97c78b2c59c86caed91f210e4753d8f88`.
>
> Packages: **@nradko/metric-omm-sdk-v1** `0.2.0`, **@nradko/metric-omm-sdk** `0.2.0` (v1 namespace only). **@nradko/metric-omm-sdk-v0** stays at `0.1.1`.

### Why this breaks compatibility

The primary break is a **change to `MetricOmmPool` function signatures** in **metric-core**. To support optional per-pool hooks, the single `bytes data` argument on liquidity and swap actions was split into two distinct payloads:

- **`callbackData`** — passed to `metricOmmSwapCallback` / `metricOmmModifyLiquidityCallback` (token payment flow, same role the old `data` had).
- **`hookData`** — passed to `IMetricOmmHooks` (`beforeSwap`, `afterSwap`, `beforeAddLiquidity`, etc.); opaque to the pool except forwarding.

Because the argument count and names changed, **function selectors changed**. Calldata encoded for pre-hooks `0.1.x` pools will not decode correctly on hooks-era pools and will revert (or hit the wrong function if a stale ABI is used).

**Example — `MetricOmmPool.swap`:**

```solidity
// Pre-hooks (0.1.x) — one bytes arg
swap(
  address recipient,
  bool zeroForOne,
  int128 amountSpecified,
  uint128 priceLimitX64,
  bytes calldata data          // -> metricOmmSwapCallback
)

// Hooks era (0.2.0) — two bytes args; different selector
swap(
  address recipient,
  bool zeroForOne,
  int128 amountSpecified,
  uint128 priceLimitX64,
  bytes calldata callbackData, // -> metricOmmSwapCallback
  bytes calldata hookData      // -> IMetricOmmHooks beforeSwap / afterSwap
)
```

A Swapper that previously ABI-encoded five logical swap fields now must append `hookData` as a sixth encoded argument. Passing the old five-arg calldata against a new pool is invalid. Passing hook payload in `callbackData` (old habit) will break the callback path; passing it only in `callbackData` and leaving `hookData` empty will skip hook gates on pools that require hook data.

The same split applies to **`addLiquidity`** (`callbackData` + `hookData`). **`removeLiquidity`** gained `hookData`. **`simulateSwapAndRevert`** gained `recipient` and `hookData` so off-chain quotes run the same hooks as live swaps.

Secondary breaks (also ABI-level): pool-creation immutables struct, factory read functions, events, and **metric-periphery** forwarding `hookData` on Swapper, LiquidityAdder, and DataProvider. This SDK release re-syncs its ABIs and encoders to the pinned contracts.

**If you integrate directly with contracts:** redeploy or upgrade to the pinned core/periphery commits; update every `swap`, `addLiquidity`, `removeLiquidity`, and quote/simulation call.

**If you use this SDK:** upgrade to `0.2.0` and audit all pool create, liquidity, swap, and quote code paths.

### Breaking — metric-core ABIs (`bc0fe2b`)

These on-chain changes drive the SDK break. Old selectors and argument lists are invalid against new deployments.

- **Pool creation immutables** — `depositAllowlistProvider`, `swapAllowlistProvider`, and `reportSwapToPriceProvider` removed; replaced by `hooks` (address) and `hooksPermissions` (uint16 bitmask).
- **`hookData` on pool actions** — `addLiquidity` and `swap` now take both `callbackData` (IERC20 callback payload) and `hookData` (forwarded to `IMetricOmmHooks`); `removeLiquidity` takes `hookData`; `simulateSwapAndRevert` takes `recipient` and `hookData`.
- **Pool immutables read path** — immutables live on the pool via `getImmutables()`; factory `poolImmutables`, `poolTokens`, `getTokens`, and `poolScaleMultipliers` removed.
- **Factory registry** — `poolByIdx` renamed to `idxToPool`; `poolToIdx` and `isPool` added; index 0 reserved (`nextPoolIdx` starts at 1).
- **Callback interfaces** — `metricOmmSwapCallback` and `metricOmmModifyLiquidityCallback` rename the bytes param from `data` to `callbackData`.
- **Deployer** — `MetricOmmPoolDeployer` links `LiquidityLib` (library dependency change for deploy scripts).
- **Behavioral fixes** (same ABI family, different runtime results on edge paths) — swap-math audit fixes; action-scoped reentrancy guard; `inSwap` view; swap hooks run in `simulateSwapAndRevert`.

### Breaking — metric-periphery ABIs (`64c336d`)

Periphery ABIs follow core hook forwarding. Pre-hooks Swapper/LiquidityAdder calldata is not compatible.

- **`hookData` on all periphery mutators** — `MetricOmmPoolLiquidityAdder` add-liquidity methods and `MetricOmmPoolSwapper` swap methods append `hookData`; `quoteSwap` uses an eight-argument overload with `recipient` and `hookData` (legacy six-argument overload remains but does not match hook-enabled execution).
- **Constructor changes** — `MetricOmmPoolSwapper(weth)` only (no `poolFactory`); `MetricOmmPoolLiquidityAdder()` has no args.
- **DataProvider** — `quoteSwap` aligned with hook-aware pool simulation.
- **Allowlist contracts removed** — standalone `DepositAllowlist` / `SwapAllowlist` replaced by hook subhooks in periphery (`DepositAllowlistHook`, `SwapAllowlistHook`, `SwapReporterHook`, etc.).

### Breaking — SDK (v1) — mirrors contract ABIs

Synced ABIs: `MetricOmmPool`, `MetricOmmPoolFactory`, `MetricOmmPoolSwapper`, `MetricOmmPoolLiquidityAdder`, `MetricOmmPoolDataProvider`.

- **`CreatePoolFactoryParams`** — `hooks` / `hooksPermissions` replace allowlist providers; `reportSwapToPriceProvider` removed.
- **`getPoolImmutables`** — reads `pool.getImmutables()` instead of `factory.poolImmutables(pool)`.
- **Liquidity encoders** — append `hookData` (default `0x`) on add and remove calldata.
- **Swap encoders and quotes** — append `hookData`; `quoteSwap` / slippage builders use eight-arg shape with `recipient` + `hookData`. Pass the same values at quote and execution when hooks are enabled.
- **`quoteExpectedAmountsForSwapExactInput` / `quoteExpectedAmountsForSwapExactOutput`** — now require `recipient`.

### Changed — SDK (v1)

- Bid/ask resolution reads `getImmutables` on the pool (`factoryAddress` no longer required when prices are omitted).
- Test harness deploys linked `LiquidityLib` for `MetricOmmPoolDeployer` and uses `MockWETH9` for swapper setup.

### Fixed — SDK (v1)

- Quote and slippage paths call the hook-aware `quoteSwap` overload so off-chain quotes match on-chain execution when `recipient` and `hookData` align.

### Not wrapped by this SDK yet

- **metric-periphery** `MetricOmmSimpleRouter` (single- and multi-hop exact-input/output swaps).

## [0.0.14] - 2026-03-31

### Changed

- Pool creation params now use explicit **scaled** naming for initial per-share token densities:
  - `initialToken0PerShare` -> `initialScaledToken0PerShareE18`
  - `initialToken1PerShare` -> `initialScaledToken1PerShareE18`
- `CreatePoolFactoryParams` docs and examples now clearly describe that initial per-share values are in internal scaled units (not native token decimals), with guidance for representing 1 token/share.
- `prepareFactoryCreatePoolParams` now maps the renamed scaled fields to factory calldata, and create-pool executable inputs/tests were updated to the new naming.

## [0.0.13] - 2026-03-30

### Added

- **HyperEVM support**: added `ChainId.HYPEREVM` (chain ID 999) and contract addresses (factory, poolDeployer, router, stateView, wrappedNative/WHYPE).
- **Monad support**: added `ChainId.MONAD` (chain ID 143) and contract addresses (factory, poolDeployer, router, stateView, wrappedNative/WMON).
- `Multicall3` ABI (`src/abis/Multicall3.ts`).

### Changed

- `exec/pool/collect-protocol-fees.ts` now batches fee collection across multiple pools into a single transaction using `Multicall3::aggregate`.

## [0.0.12] - 2026-03-20

### Added

- **Moved scripts** to interact with (pool|factory|router|erc20) to `exec/(pool|factory|router|erc20)/`.
- **New executables for collecting fees**:
  - `exec/pool/collect-protocol-fees.ts`
  - `exec/factory/collect.ts`
- New executables for inspecting pool state and quoting swaps:
  - `exec/pool/inspect-pool.ts` — detailed pool state view.
  - `exec/router/quote-swap.ts` — CLI swap quote tool.
- Factory fee collection SDK helpers:
  - `getFactoryAssetBalances` — reads factory balances for multiple assets (including native ETH via zero address).
  - `collectFactoryFees` — sequentially executes `collectTokens`/`collectETH` for non-zero assets.
- `quoteSwap` — low-level swap quote function exposed from `src/router/swap.ts`; returns `amount0Delta`, `amount1Delta`, `amountIn`, and `amountOut`.
- `QuoteSwapParams` and `QuoteSwapResult` types exported from the router module.

### Changed

- `getPoolState` now reads via `StateView` contract (`slot0` + `slot1` calls) instead of calling `getState` directly on the pool. **Breaking**: requires a `stateViewAddress` argument.
- Default `specAmountBufferPercent` changed from `1` to `0` across all liquidity builder functions (`buildModifyLiquidityArgsForAddition`, `buildModifyLiquidityArgsForUniformAddition`, `buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount`, `buildModifyLiquidityArgsForRemoval`, `buildModifyLiquidityArgsForPercentageRemoval`).

## [0.0.11] - 2026-03-09

### Changed

- `specAmountBufferPercent` semantics were aligned with the name and are now treated as percent units (`1` = 1%, `0.01` = 0.01%).

### Fixed

- `scripts/actions/remove-liquidity.ts`: fixed percentage-to-shares conversion so entered percentages map correctly to removed shares.

## [0.0.6] - 2026-02-27

### Added

- Swap quote-only helpers: `quoteExpectedAmountsForSwapExactInput` and `quoteExpectedAmountsForSwapExactOutput`.
- Quote-only params types: `QuoteExpectedAmountsForSwapExactInputParams` and `QuoteExpectedAmountsForSwapExactOutputParams` (build params minus `recipient` and `deadline`).
- Optional `prices` input (`{ bidPriceX64, askPriceX64 }`) on swap build params to bypass on-chain price-provider read when values are already available.

### Changed

- Swap price-provider reads now use UI ABI endpoint (`PriceProviderUiAbi.getBidAndAskPriceUi`).
- Swap quote paths correctly read `simulateContract(...).result` tuple payload instead of array-destructuring the wrapper object.
- Exact-input `minAmountOut` slippage math fixed to divide by `BPS_BASE`.

## [0.0.5] - 2026-02-26

### Added

- Exported shared liquidity math helpers (`ONE_E18`, `ceilDiv`, `toPriceX18`, token conversion helpers, scaled delta conversion).
- Args-first liquidity builder APIs and related exported arg types.
- Args-first swap builders and arg types: `buildArgsForSwapExactInput`, `buildArgsForSwapExactOutput`, `SwapExactInputArgs`, and `SwapExactOutputArgs`.
- Swap quote-aware builders that return expected amounts together with args: `buildArgsAndExpectedAmountsForSwapExactInput` and `buildArgsAndExpectedAmountsForSwapExactOutput`.
- `PriceProviderAbi` and ABI sync support for `IPriceProvider`.

### Changed

- Liquidity flows were unified around `ModifyLiquidityArgs` builders (`buildModifyLiquidityArgsForAddition/UniformAddition/PercentageRemoval/Removal`) with flattened inputs.
- `encodeModifyLiquidityCalldata` now operates on direct `ModifyLiquidityArgs` tuple payloads.
- Swap arg builders now derive slippage-protected limits from on-chain `quoteSwap` using pool immutables and the pool price provider bid/ask.
- `prepareSwapExactInputCalldata` and `prepareSwapExactOutputCalldata` accept either params or prebuilt args tuples.
- Swap type naming was normalized: low-level tuple-matching structs use `*Params`; high-level builder inputs use `Build*Params`.

### Removed

- Legacy liquidity compatibility aliases and deprecated wrapper APIs.
- Legacy nested `params` adapter paths for liquidity arg builders.
- Legacy position compatibility module surface.
