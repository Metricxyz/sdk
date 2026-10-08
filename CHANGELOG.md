# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.2] - 2026-10-07

### Added

- **Pool creation via `ImmutableAppPoolHelper`** — `createPoolViaImmutableAppPoolHelper` and `encodeCreatePoolViaImmutableAppPoolHelperCalldata` create a pool through the helper, which overrides its bid/ask/reference asymmetry beyond the factory's creation cap. They take the same `CreatePoolFactoryParams` as `createPool` plus the override value; the price provider must come from the AnchoredProviderFactory and `priceProviderTimelock` must be `maxUint256`.
- **`ImmutableAppPoolHelperAbi`** and `ChainAddresses.immutableAppPoolHelper` — `0xD993832465F58306EDa8F35D2d10A2B4bCF0C7FB` on every bundled chain.
- **`ChainAddresses.anchoredProviderFactory`** — the APP factory hardcoded in the helper, `0xb0eAE19259500Ac4Ca59b9a5cb8cDB2Da8076F0A` on every bundled chain.

## [0.6.1] - 2026-10-05

### Breaking changes

- **Total-amount liquidity add removed** — `buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount` and its params type are removed. Its off-chain calibration could return a source cap slightly above the budget, so a Max deposit failed. Use `buildAddLiquidityWeightedParams` with `encodeAddLiquidityWeightedSelfCalldata`; the LiquidityAdder sizes the deposit on-chain to fit the caps.

- **Cursor bounds in oracle-distance space** — `prepareLiquidityCursorBounds` and `computeLiquidityCursorBounds` take `maxOracleDistanceChangePercent` (largest change in the pool price's distance from the oracle, in percent of price) instead of `maximalCursorMovement`; `computeLiquidityCursorBounds` now takes one params object including the pool's bin range and `binLengthsE6`. `cursorMovementToPositionDelta` is removed.

### Added

- **`buildAddLiquidityWeightedParams`** — builds `addLiquidityWeighted` arguments from bins, optional value weights, token caps and `maxOracleDistanceChangePercent` (cursor bounds replace the spec-amount buffer for this flow).

## [0.6.0] - 2026-09-29

Stable release of `0.6.0-rc.0`; no changes since the release candidate.

## [0.6.0-rc.0] - 2026-09-28

### Breaking changes

- **Router deployment** — `simpleRouter` is now `0x02201E6f13c41506c7Bb635d7543F98826229aB7` on every bundled chain (was `0x1Fd28cF3Cd95F58480A7c64b8696Cb6bA7720910` on Ethereum and `0x3c6c4fC94f1493b9d76C5e4C4CdEdB444D3CC0A2` elsewhere). `externalSwapExecutor` is now required on `ChainAddresses` and set to `0x578C80DeC5D4Aa1F2879985e6e8d91Fc268e4AC2` on every chain. Applications must update their transaction and approval targets.
- **Router ABI** — `DeadlineExpired` is removed; expired external swaps revert with `TransactionExpired`.

### Added

- **Sequence step failures** — the router ABI includes `SequenceStepFailed(caller, index, reason)`, emitted when a step fails without reverting the sequence.

### Changed

- **Periphery** — pinned `ed58520348f2eb05ba1903145c0a91f69cd0afde` and regenerated the router ABI.

## [0.6.0-alpha.1] - 2026-09-22

### Breaking changes

- **Native swap helpers** — `prepareExact{Input,Output}{,Single}{SupportingNativePayment,AndUnwrap}Calldata` now require final `chainId` and `wrappedNative` arguments. Pass `chainId, null` to resolve and validate the wrapped-native token, or `null, null` to explicitly skip validation.

### Added

- **Router sequences** — encode ordered router calls with configurable success/failure policies. Results and `SequenceFailed` preserve per-step return/revert data and statuses (`NOT_EXECUTED`, `SUCCESS`, `FAILURE`).
- **External swaps** — encode swaps through an external executor, with native-payment and output-unwrap helpers. Caller-funded swaps automatically refund unused input; native-payment helpers request ETH refunds. External routes can deliver output directly to the settlement recipient or through the executor, which cannot be the final recipient.
- **External swap fallback** — compose a primary router swap and an external fallback as two multicalls in a sequence, including exact-input/output, single-hop/multihop, native-payment, and unwrap variants. Both revert reasons remain available if both branches fail. Fallback params infer the swap shape and reject mixed amount or token fields.
- **Router-funded external swaps** — optional `payerIsRouter` and `refundAsNative` encoder arguments, plus `encodeSweepTokenCalldata` for atomic cleanup of retained router funds.

### Changed

- **Periphery** — pinned `f10fd9db1a447414b164fa4d7331a088f61d3154` and regenerated the router ABI for sequences and external swaps.
- **Ethereum deployment** — updated `simpleRouter` to `0x1Fd28cF3Cd95F58480A7c64b8696Cb6bA7720910` and exposed its bound executor as optional `externalSwapExecutor` (`0xFAf77585aC2FbD6777Baca30c1dB99ce8Bca3248`). Other chains retain their existing routers and return no executor. Calldata builders still take addresses explicitly; applications must update their transaction and approval targets.

### Fixed

- **Native token validation** — malformed input/output addresses produce the same wrapped-native validation message as mismatched tokens.

## [0.5.2] - 2026-09-15

### Fixed

- **Live oracle quotes** — single-hop and multihop exact-input/output quotes use a zero-address `eth_call` origin so attributed price providers can be read outside an active pool swap. Trade sender/recipient arguments and hypothetical quote callers are preserved. Actual swaps still require normal wallet simulation and oracle registration.

### Changed

- **Contract sources** — bumped `metricPeripheryRef` to `f92a958c75c01ebef62a9e749ab037f6b813cf21`, which includes the current-bin liquidity-depth fix and pins Metric Core `d4d0e2a3a7d690fdfed9829239e5ec3d8c4c9575`, including the bid/ask/reference asymmetry precision fix.
- **Contract ABIs** — regenerated the pool and factory interfaces for pending fee payouts and oversized liquidity-share validation.
- **Deployments** — replaced the shared Core, Periphery, and extension addresses with the September 15 deployment set on all ten supported chains.

## [0.5.1] - 2026-09-11

> Sender-aware quoting and matching periphery deployment.

### Added

- **Sender-aware quotes** — `sender` param on all single-hop and multi-hop quote and swap-build helpers (`quoteLiveExactIn(Single)`, `quoteLiveExactOut(Single)`, `quoteHypotheticalExactInput(Single)`, `quoteHypotheticalExactOutput(Single)`, `buildExactInput(Single)Params`, `buildExactOutput(Single)Params`); the address forwarded to swap extensions, defaulting to `recipient` when omitted.

### Changed

- **Periphery ref** — bumped `metricPeripheryRef` to `e7ec0c89128980a4fad8da9d07c109f6b9640257` to match the updated quoter/pool ABIs.

## [0.5.0] - 2026-08-29

> Align the SDK with the latest Metric OMM protocol, expand bundled deployments to ten chains, and ship as a single v1 package.
>
> Package: **@metric.xyz/metric-omm-sdk-v1** `0.5.0`. **@metric.xyz/metric-omm-sdk** stays frozen at `0.4.6`.

### Added

- **Packed event decoding** — unpack `Swap` and `BinSwapped` packed words (`unpackSwapEvent`, `unpackBinSwappedEvent`, and related helpers).
- **Stop-loss-compatible pool setup** — `recommendedInitialScaledAmounts` derives initial scaled token amounts; `computeMinimumOperationalLiquidity` sizes `minimalOperationalLiquidity`.
- **Create-pool controls** — protocol fees, `bidAskRefAsymmetryX8` (reject 0; `DISABLED_BID_ASK_REF_ASYMMETRY_X8` disables the check), and updated factory field names (`initialScaledAmount{0,1}PerE18Shares`).
- **Allow-all extension admin** — `encodeSetAllowAllDepositorsCalldata` / `encodeSetAllowAllSwappersCalldata`.
- **Ten-chain addresses** — Ethereum, Base, Arbitrum, Avalanche, BNB, Polygon, MegaETH, HyperEVM, Monad, Robinhood (shared CREATE2 protocol addresses).

### Changed

- **Protocol ABIs and helpers** — liquidity adder cursor bounds, hypothetical quotes take reference prices, slot0 includes `bidAskRefAsymmetryX8`, stop-loss decay uses E18, weighted adds require explicit cursor bounds.
- **Percentage removal** — default scan uses the pool's real bin range; position-share range reads are chunked.
- **Repo flattened** — v1-only package at the repo root; v0 and the combined `@metric.xyz/metric-omm-sdk` wrapper removed. Install `@metric.xyz/metric-omm-sdk-v1` directly.

### Fixed

- **Factory native fee collection** — `collectFactoryFees` calls `collectEth` (correct ABI name).
- **`init:submodules` on a moved checkout** — detect dangling `@metric/core` symlink with `lstatSync` and re-link instead of failing with `EEXIST`.

## [0.4.6] - 2026-08-04

> OracleValueStopLoss helpers for front ends: detect whether any pool bin is stop-loss breached and estimate when trading may resume via watermark decay.
>
> Packages: **@metric.xyz/metric-omm-sdk-v1** `0.4.6`, **@metric.xyz/metric-omm-sdk** `0.4.6`. **@metric.xyz/metric-omm-sdk-v0** unchanged.

### Added — SDK (v1)

- **Oracle stop-loss any-bin status** — `getOracleStopLossAnyBinStatus` loads config, bin balances, and current high watermarks, then evaluates breaches for every non-empty bin in `[lowestBin, highestBin]`. Returns `isAnyBinStopLossBreached`, per-bin directional flags (`blocksZeroForOne` / `blocksOneForZero`), and `secondsUntil*Resumes` decay estimates. Pure helpers: `evaluateOracleStopLoss`, `computeOracleStopLossMetrics`, `isStopLossMetricBreached`, `secondsUntilStopLossClears`, `decayedHighWatermark`, `stopLossThreshold`. Callers supply oracle bid/ask (must match the pool price provider at the same block). A swap is blocked only if a bin on its path is breached — use per-bin flags for path-aware UI, not only the any-bin boolean.

## [0.4.5] - 2026-07-14

> New V1 deployment addresses on Ethereum, Base, Robinhood, and HyperEVM.
> V0 adds Robinhood deployment.

> Packages: **@nradko/metric-omm-sdk-v1** `0.4.5`, **@nradko/metric-omm-sdk** `0.4.5`, **@nradko/metric-omm-sdk-v0** `0.1.2`.

### Added — SDK (v0)

- **Robinhood (4663)** — bundled factory, deployer, router, state view, and WETH addresses in `ADDRESSES`.

### Changed — SDK (v1)

- **Bundled addresses** — protocol deployment table updated on Ethereum, Base, Robinhood, and HyperEVM (CREATE2 — same protocol addresses on all four chains; wrapped native differs per chain).

## [0.4.4] - 2026-07-08

> Native ETH liquidity adds and weighted-add cursor-bound helpers. New CREATE2 deployment addresses on Ethereum and Base.
>
> Pinned upstream: **metric-periphery** `d210a84daf694c52a591d371ceb9b82cece0f79f`.
>
> Packages: **@nradko/metric-omm-sdk-v1** `0.4.4`, **@nradko/metric-omm-sdk** `0.4.4`. **@nradko/metric-omm-sdk-v0** stays at `0.1.1`.

### Added — SDK (v1)

- **Native ETH liquidity add (add only)** — `prepareAddLiquidity*SupportingNativePaymentCalldata` multicalls `[addLiquidity…, refundETH]` on LiquidityAdder. Set `msg.value` for the WETH pool leg; surplus ETH is refunded. Self variants credit `(msg.sender, salt)`; WithOwner variants credit `(owner, salt)`. No native-ETH remove path.

- **Liquidity cursor bounds** — weighted adds (`encodeAddLiquidityWeighted*`) require `minimalCurBin`, `minimalPosition`, `maximalCurBin`, `maximalPosition`. The pool **cursor** is its current price position: `(curBinIdx, curPosInBin)` from `slot0`. LiquidityAdder checks at execution that the cursor is still inside these bounds.
  - **Use case:** you quote or plan a weighted add off-chain while the cursor is at A; before your tx lands, swaps can move the cursor. Bounds let you allow a small tolerated drift (e.g. `maximalCursorMovement: 0.25` = ±25% of `MAX_UINT104` positions, summed across bins) instead of disabling the check entirely.
  - **Prepare:** `prepareLiquidityCursorBounds({ publicClient, pool, maximalCursorMovement })` reads the live cursor and returns bounds to spread into `encodeAddLiquidityWeighted*`. Pure helpers: `computeLiquidityCursorBounds`, `cursorMovementToPositionDelta`. Use `UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS` to skip the check.

### Changed — SDK (v1)

- Bundled Ethereum/Base deployment addresses updated.
- `encodeMulticallCalldata` / `encodeRefundETHCalldata` / `encodeUnwrapWETH9Calldata` moved to `peripheryPayments/` (shared by router and liquidity).

## [0.4.3] - 2026-06-25

> Breaking vs `0.4.2` on native ETH helpers and route API types. Updates deployment addresses and removes the separate StateView lens.
>
> Pinned upstream: **metric-periphery** `e161cb0b1b301395c631197f3c7d5c205a8b4d48` (core via periphery `lib/metric-core`).
>
> Packages: **@nradko/metric-omm-sdk-v1** `0.4.3`, **@nradko/metric-omm-sdk** `0.4.3`. **@nradko/metric-omm-sdk-v0** stays at `0.1.1`.

### Added — SDK (v1)

- **Native ETH exact-output** — `prepareExactOutputSingleSupportingNativePaymentCalldata`, `prepareExactOutputSupportingNativePaymentCalldata`, `prepareExactOutputSingleAndUnwrapCalldata`, and `prepareExactOutputAndUnwrapCalldata`.
- **Route API exact-out** — `prepareExactOutputFromRoute` maps `exact_out` `POST /public/v1/evm/:chain_id/route` responses to `ExactOutputSingleParams` or `ExactOutputParams`.
- **Route API types** — `TradeType`, nested `routes[]` on `RouteResponse`, and `RouteOptionResponse` aligned with the current wire contract.

### Breaking — SDK (v1)

- **Native ETH helper rename** — `prepareExactInputSingleFromNativeCalldata` → `prepareExactInputSingleSupportingNativePaymentCalldata`, `prepareExactInputFromNativeCalldata` → `prepareExactInputSupportingNativePaymentCalldata`, `prepareExactInputSingleToNativeCalldata` → `prepareExactInputSingleAndUnwrapCalldata`, `prepareExactInputToNativeCalldata` → `prepareExactInputAndUnwrapCalldata`, and exact-output variants (`prepareExactOutput*SupportingNativePaymentCalldata` / `prepareExactOutput*AndUnwrapCalldata`).
- **Native ETH return type** — helpers return `Hex` calldata only; removed `PreparedSwapTransaction` and bundled `value` — set `msg.value` on the transaction yourself.
- **Native ETH unwrap recipient** — removed `ethRecipient` option; ETH is sent to `params.recipient`.
- **Route API response shape** — top-level `expectedAmountOut` removed; use `amountOut`. Paths live under `routes[]`; each option carries `tradeType`, `amountIn`, and `amountOut`.
- **ChainAddresses** — `stateView` removed; use `dataProvider` for all pool reads (`slot0`, bins, position shares).
- **Removed exports** — `MetricOmmPoolStateViewAbi`, `getPositionBinSharesFromStateView`.
- **Bundled deployment addresses** — LiquidityAdder, DataProvider, SimpleRouter, SwapQuoter, and all four extensions updated on Ethereum mainnet and Base.

### Changed — SDK (v1)

- **Router utils** — `encodeMulticallCalldata`, `encodeRefundETHCalldata`, and `encodeUnwrapWETH9Calldata` live in `router/utils.ts` (re-exported from the package root).
- **Route API mapping** — `prepareExactInputFromRoute` reads from `routes[0]`; rejects split routes and partial fills; validates `tradeType` per direction.
- **SwapQuoter address** — `addresses.quoter` is no longer a zero placeholder.

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
