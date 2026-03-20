# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
