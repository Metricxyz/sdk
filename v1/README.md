# @nradko/metric-omm-sdk-v1

TypeScript SDK for **v1** Metric OMM contracts: **Swapper**, **LiquidityAdder**, pool `addLiquidity` / `removeLiquidity`, and factory-backed reads.

Pinned to the same commits as [`dev_metric-deploy/versions.env`](../../../dev_metric-deploy/versions.env).

## Installation

```bash
npm install @nradko/metric-omm-sdk-v1 viem
```

Or via the combined package:

```typescript
import { v1 } from "@nradko/metric-omm-sdk";
```

## Ethereum mainnet addresses

| Contract | Address |
| -------- | ------- |
| MetricOmmPoolFactory | `0xDd41F182630A395E2ED8b9c1D5f1E22F1f9b133a` |
| MetricOmmPoolDeployer | `0xb9bb9364FEA5170713709Ba67Aec649eF043e885` |
| MetricOmmPoolLiquidityAdder | `0x9de47a0C84c7F9486Af77C8135CE7f480d121B44` |
| MetricOmmPoolDataProvider | `0xf06454dB7E9b8BCa2FC77bF6e88f9B98dF0b52e8` |
| MetricOmmPoolStateView | `0x124C2853E316d1585621560E35D4dcC8318F97FF` |
| MetricOmmSimpleRouter | `0x94DD3A9308A1060f4BD9A95dE65F27f0F048f863` |
| MetricOmmPoolSwapper | `0xc73407A1d240e08EB34654e706cc3B19E356b8C4` |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |

`MetricOmmPoolDataProvider` is the deployed lens: pool reads (`slot0`, `binStates`, `positionBinShares`, …) plus swap depth and revert-based quotes. Pass `addresses.dataProvider` to read helpers and liquidity builders (`dataProviderAddress` param).

```typescript
import { getAddressesOrThrow, ChainId, isChainSupported } from "@nradko/metric-omm-sdk-v1";

const a = getAddressesOrThrow(ChainId.ETHEREUM);
// isChainSupported(ChainId.BASE) === false — use DeployedChainId / getSupportedChainIds() for bundled addresses
```

`ChainId` lists future chain IDs for typing; **only Ethereum mainnet** has entries in `ADDRESSES` for this release. Use `getSupportedChainIds()`, `isChainSupported()`, or `DeployedChainId` when you need compile-time guarantees.

## Swaps (Swapper)

```typescript
import {
  buildArgsAndExpectedAmountsForSwapExactInput,
  getAddressesOrThrow,
  ChainId,
} from "@nradko/metric-omm-sdk-v1";
import { MetricOmmPoolSwapperAbi } from "@nradko/metric-omm-sdk-v1/abis";

const addresses = getAddressesOrThrow(ChainId.ETHEREUM);

const { args, expectedInput, expectedOutput } =
  await buildArgsAndExpectedAmountsForSwapExactInput({
    publicClient,
    factoryAddress: addresses.factory,
    swapperAddress: addresses.swapper,
    pool: poolAddress,
    recipient: account,
    zeroForOne: true,
    amountIn: 1_000_000_000_000_000_000n,
    slippagePercent: 0.5,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
  });

await walletClient.writeContract({
  address: addresses.swapper,
  abi: MetricOmmPoolSwapperAbi,
  functionName: "swapExactInput",
  args,
  account,
});
```

Quote without building tx args: `quoteSwap` (read-only pool quote), `quoteExpectedAmountsForSwapExactInput` / `quoteExpectedAmountsForSwapExactOutput` (Swapper-aligned estimates for slippage math).

## Liquidity

- **Add (EOA):** approve **LiquidityAdder**, then `addLiquidityExactShares` / `addLiquidityWeighted` on the adder (see `encodeAddLiquidity*` helpers).
- **Remove:** `removeLiquidity` on the pool — build deltas with `buildModifyLiquidityArgsForRemoval` / `encodeRemoveLiquidityCalldata`.

SDK builders still use internal names like `buildModifyLiquidityArgsForUniformAddition` where the math is shared; encoders target v1 pool/adder ABIs.

## Pool reads

```typescript
import { getPoolImmutables, getPoolState, getSlot0, getAddressesOrThrow, ChainId } from "@nradko/metric-omm-sdk-v1";

const addresses = getAddressesOrThrow(ChainId.ETHEREUM);
const imm = await getPoolImmutables(publicClient, addresses.factory, poolAddress);
const state = await getPoolState(publicClient, addresses.dataProvider, poolAddress);
const slot0 = await getSlot0(publicClient, addresses.dataProvider, poolAddress);
```

## ABIs

```typescript
import {
  MetricOmmPoolAbi,
  MetricOmmPoolDataProviderAbi,
  MetricOmmPoolSwapperAbi,
  MetricOmmPoolLiquidityAdderAbi,
} from "@nradko/metric-omm-sdk-v1/abis";
```

Regenerate from pinned contracts:

```bash
npm run setup:contracts    # init submodules, hardhat build, sync ABIs
```

All pinned contracts (including `MetricOmmPoolDataProvider`) are compiled by Hardhat from the pinned `@metric/core` and `@metric/periphery` git dependencies (periphery remappings use core's libs via `lib/metric-core`).

## Development

```bash
npm run build              # tsc only (default prepare)
npm run setup:contracts    # refresh ABIs from pinned git deps (maintainers)
npm test                   # Hardhat tests (needs matching @metric/* in node_modules)
```

In the monorepo, run v1 tests with an isolated install (same pattern as v0):

```bash
# from dev_sdk/
cd v1
npm ci
npm run sync:contracts   # required before first test run
npm test
```

## Tests

```bash
npm run sync:contracts && npm test
```

Fork tests: set `ETHEREUM_RPC_URL` (optional `ETHEREUM_FORK_BLOCK_NUMBER`).
