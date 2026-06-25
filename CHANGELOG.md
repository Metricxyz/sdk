# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed — SDK (v1) (breaking)

- **Native ETH helper rename** — `prepareExactInputSingleFromNativeCalldata` → `prepareExactInputSingleSupportingNativePaymentCalldata`, `prepareExactInputFromNativeCalldata` → `prepareExactInputSupportingNativePaymentCalldata`, `prepareExactInputSingleToNativeCalldata` → `prepareExactInputSingleAndUnwrapCalldata`, `prepareExactInputToNativeCalldata` → `prepareExactInputAndUnwrapCalldata`, and exact-output variants (`prepareExactOutput*SupportingNativePaymentCalldata` / `prepareExactOutput*AndUnwrapCalldata`).
- **Return type** — native-payment helpers return `Hex` calldata only; removed `PreparedSwapTransaction` and bundled `value` — set `msg.value` on the transaction yourself.
- **Unwrap recipient** — removed `ethRecipient` option; ETH is sent to `params.recipient`.

## [0.4.2] - 2026-06-24

> Compatible with `0.4.0` swap and quote APIs. Adds native ETH swap multicall helpers and Oracle route-to-swap conversion.
>
> Pinned upstream: **metric-periphery** `e161cb0b1b301395c631197f3c7d5c205a8b4d48` (core via periphery `lib/metric-core`).
>
> Packages: **@nradko/metric-omm-sdk-v1** `0.4.2`, **@nradko/metric-omm-sdk** `0.4.2`. **@nradko/metric-omm-sdk-v0** stays at `0.1.1`.

### Added — SDK (v1)

- **Native ETH swaps** — `prepareExactInputSingleSupportingNativePaymentCalldata`, `prepareExactInputSupportingNativePaymentCalldata`, `prepareExactInputSingleAndUnwrapCalldata`, `prepareExactInputAndUnwrapCalldata`, and exact-output variants (`prepareExactOutput*SupportingNativePaymentCalldata` / `prepareExactOutput*AndUnwrapCalldata`); low-level `encodeMulticallCalldata`, `encodeRefundETHCalldata`, `encodeUnwrapWETH9Calldata`.
- **Oracle route integration** — `prepareExactInputFromRoute` maps `POST /public/v1/evm/:chain_id/route` responses to `ExactInputSingleParams` or `ExactInputParams` (direct and one-hop routes).
- **Tests** — native swap Hardhat E2E (`native-swap-e2e.test.ts`), native multicall unit tests, and route-response mapping tests.

### Changed — SDK (v1)

- Synced ABIs from pinned **metric-periphery** `e161cb0b1b301395c631197f3c7d5c205a8b4d48` (SimpleRouter and SwapQuoter updates for mixed native/WETH payments).
- Expanded JSDoc on swap, multihop swap, and liquidity builder modules.

### Changed — packaging

- **Install lifecycle** — removed `prepare` and `postinstall` scripts so `npm install` runs no SDK scripts for consumers.
- **Periphery checkout** — `@metric/periphery` is cloned via `init-submodules.mjs` (maintainer `setup:contracts` flow) instead of an npm git devDependency.
- **Verify scripts** — skip redundant `npm ci` when `node_modules` already exists; v1 `verify` runs `init-submodules` before tests.

## [0.4.0] - 2026-06-18

> **NOT backward compatible with `0.3.0`.** Swaps and quotes move from **MetricOmmPoolSwapper** to **MetricOmmSimpleRouter** + **MetricOmmSwapQuoter**. Bundled Ethereum and Base deployment addresses changed.
>
> Pinned upstream: **metric-periphery** `fc7c947507ec465af950add2263507db2f3ff904` (core via periphery `lib/metric-core`).
>
> Packages: **@nradko/metric-omm-sdk-v1** `0.4.0`, **@nradko/metric-omm-sdk** `0.4.0`. **@nradko/metric-omm-sdk-v0** stays at `0.1.1`.

### Why this breaks compatibility with `0.3.0`

- **Swap entrypoint** — `addresses.swapper` removed; use `addresses.simpleRouter` with `exactInputSingle` / `exactOutputSingle` (single hop) or `exactInput` / `exactOutput` (multihop).
- **Quotes** — `quoteSwap` and Swapper-aligned builders removed; use **MetricOmmSwapQuoter** via `quoteLiveExactInSingle`, `quoteLiveExactOutSingle`, and multihop `quoteLiveExactIn` / `quoteLiveExactOut` (plus hypothetical variants).
- **ABIs** — `MetricOmmPoolSwapperAbi` and `PriceProviderUiAbi` removed; added `MetricOmmSimpleRouterAbi`, `MetricOmmSwapQuoterAbi`, `MetricOmmPoolStateViewAbi`, `OracleProviderAbi`.
- **Deployment addresses** — new CREATE2 bundle on Ethereum mainnet and Base (factory, deployer, liquidity adder, data provider, simple router, extensions).

### Added — SDK (v1)

- **Quoter module** — live and hypothetical single-hop and multihop quotes via `simulateContract`.
- **SimpleRouter module** — `buildExactInputSingleParams`, `buildExactInputParams`, calldata encoders, and slippage helpers for single- and multi-hop swaps.
- **Swap path helpers** — `resolveSwapPath` derives `zeroForOneBitMap` from pool immutables and token path.
- **Oracle registry** — `getPoolOracleStatus`, `registerPool`, and related reads for providers-oracle pool registration.
- **Tests** — two-hop path quote/swap parity, oracle registry unit and e2e tests.

### Breaking — SDK (v1)

- **`ChainAddresses`** — `swapper` replaced by `simpleRouter` and `quoter`.
- **Router exports** — removed Swapper builders (`buildArgsAndExpectedAmountsForSwap*`, `encodeSwapExact*`, `quoteSwap`, etc.).
- **Bundled addresses** — protocol deployment table updated for Ethereum and Base.

### Changed — SDK (v1)

- Synced ABIs from pinned **metric-periphery** `fc7c947507ec465af950add2263507db2f3ff904`.
- Hardhat `npmFilesToBuild` compiles SimpleRouter, SwapQuoter, and PoolStateView from periphery.
- Test harness deploys SimpleRouter and SwapQuoter instead of PoolSwapper.

## [0.3.0] - 2026-06-16

> **NOT backward compatible with `0.2.0`.** This release tracks the **extensions** rename in **metric-core** and **metric-periphery** (successor to the hooks-era `0.2.0` pin). Field names, factory pool-creation params, and immutables layout changed again.
>
> Pinned upstream: **metric-periphery** `cc8fef9781fba405cfd1945fe6bf49a00da132bb` (core via periphery `lib/metric-core`).
>
> Package: **@nradko/metric-omm-sdk-v1** `0.3.0`.

### Why this breaks compatibility with `0.2.0`

The hooks model was replaced by **extensions**: standalone periphery contracts (`DepositAllowlistExtension`, `SwapAllowlistExtension`, `PriceVelocityGuardExtension`, `OracleValueStopLossExtension`) configured per pool at creation.

- **`hookData` → `extensionData`** on pool swap/add/remove, Swapper, LiquidityAdder, and DataProvider quote paths.
- **Pool creation** — `hooks` / `hooksPermissions` replaced by `extensions[]`, `ExtensionOrders`, and `extensionInitData[]`.
- **Pool immutables** — single `hooks` + `hooksPermissions` replaced by `extension1…extension7` and six packed order fields.
- **`addLiquidityWeighted`** — LiquidityAdder overloads gained bin-position bound args (`minimalCurBin`, `minimalPosition`, `maximalCurBin`, `maximalPosition`).

Calldata and types from `0.2.0` must be audited and updated.

### Added — SDK (v1)

- **Extension module** — `encodeExtensionOrder`, `buildExtensionOrders`, `EMPTY_EXTENSION_DATA`, `EMPTY_EXTENSION_ORDERS`.
- **Initialize encoders** — `EMPTY_EXTENSION_INIT_DATA`, `encodeOracleStopLossInitData`.
- **Admin calldata encoders** for DepositAllowlist, SwapAllowlist, PriceVelocityGuard, and OracleValueStopLoss (propose / execute / cancel).
- **Extension ABIs** exported from `@nradko/metric-omm-sdk-v1/abis`.
- **Tests** — extension order packing, init encoding, admin encode parity, pool create with extensions, deposit/swap allowlist E2E.

### Breaking — SDK (v1)

- **`CreatePoolFactoryParams`** — `extensions`, `extensionOrders`, `extensionInitData` replace `hooks` / `hookOrders` / `hookInitData`.
- **`PoolImmutables`** — `extensions` (`PoolExtensions`) and `extensionOrders` replace `hooks` / `hooksPermissions`; removed `maxDriftE8` / `maxDriftDecayPerSecondE8`.
- **Swap and liquidity encoders** — `extensionData` replaces `hookData`.
- **`encodeAddLiquidityWeighted*`** — append bin-position bound args (defaults: no bounds).

### Changed — SDK (v1)

- Synced ABIs from pinned **metric-periphery** `cc8fef9781fba405cfd1945fe6bf49a00da132bb`.
- Liquidity encoders resolve correct LiquidityAdder overloads by input arity.
- Hardhat `npmFilesToBuild` and `sync-abis.mjs` include the four periphery extension contracts.

### Not wrapped by this SDK yet

- **metric-periphery** `MetricOmmSimpleRouter` (single- and multi-hop exact-input/output swaps).

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
