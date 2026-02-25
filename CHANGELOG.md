# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Exported shared liquidity math helpers (`ONE_E18`, `ceilDiv`, `toPriceX18`, token conversion helpers, scaled delta conversion).
- Args-first liquidity builder APIs and related exported arg types.

### Changed

- Liquidity flows were unified around `ModifyLiquidityArgs` builders (`buildModifyLiquidityArgsForAddition/UniformAddition/PercentageRemoval/Removal`) with flattened inputs.
- `encodeModifyLiquidityCalldata` and `sendModifyLiquidity` now operate on direct `ModifyLiquidityArgs` tuple payloads.

### Removed

- Legacy liquidity compatibility aliases and deprecated wrapper APIs.
- Legacy nested `params` adapter paths for liquidity arg builders.
- Legacy position compatibility module surface.
