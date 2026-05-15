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
| MetricOmmPoolFactory | `0x93e314a9a65a15f3c3bc039bb4261dbbbc343fba` |
| MetricOmmPoolDeployer | `0xe56e89c4faeec39364b5a2cbde13c572a876afb6` |
| MetricOmmPoolLiquidityAdder | `0x1f2a03dc43947c6bdebb2e6136222997e49fa3e9` |
| MetricOmmPoolSwapDataProvider | `0x404bdb6d2b9ed34a5637211a8d52177c38c39d02` |
| DepositAllowlist | `0xea700fcd860533474e1ff920b76914113ae56681` |
| SwapAllowlist | `0x5269d78af4a288e1649be6bf169a51bb94b6eb78` |
| MetricOmmPoolSwapper | `0x85e4ff47427f1a62ed19a3abf97b80c333da266c` |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |

`stateView` is **not** in the deploy bundle — deploy `MetricOmmPoolStateView` from metric-core (constructor: factory) and pass its address into read helpers.

```typescript
import { getAddressesOrThrow, ChainId } from "@nradko/metric-omm-sdk-v1";

const a = getAddressesOrThrow(ChainId.ETHEREUM);
```

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

Quote without building tx args: `quoteSwap`, `quoteExpectedAmountsForSwapExactInput`.

## Liquidity

- **Add (EOA):** approve **LiquidityAdder**, then `addLiquidityExactShares` / `addLiquidityWeighted` on the adder (see `encodeAddLiquidity*` helpers).
- **Remove:** `removeLiquidity` on the pool — build deltas with `buildModifyLiquidityArgsForRemoval` / `encodeRemoveLiquidityCalldata`.

SDK builders still use internal names like `buildModifyLiquidityArgsForUniformAddition` where the math is shared; encoders target v1 pool/adder ABIs.

## Pool reads

```typescript
import { getPoolImmutables, getPoolState, getSlot0 } from "@nradko/metric-omm-sdk-v1";

const imm = await getPoolImmutables(publicClient, addresses.factory, poolAddress);
const state = await getPoolState(publicClient, stateViewAddress, poolAddress);
```

## ABIs

```typescript
import {
  MetricOmmPoolAbi,
  MetricOmmPoolSwapperAbi,
  MetricOmmPoolLiquidityAdderAbi,
} from "@nradko/metric-omm-sdk-v1/abis";
```

ABIs are committed under `src/abis/` and copied to `dist/abis/` on build.

## Development

```bash
npm run setup:contracts   # submodules + hardhat + sync ABIs
npm run build
npm test
```

From repo root: `npm test -w @nradko/metric-omm-sdk-v1` (fork tests need `ETHEREUM_RPC_URL`).
