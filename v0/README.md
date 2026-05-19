# @nradko/metric-omm-sdk-v0

TypeScript SDK for **v0** Metric OMM contracts: **MetricOmmSwapRouter**, pool **`modifyLiquidity`**, and multi-chain deployed addresses.

Pinned to `metric-core@af10188` and `metric-periphery@e3154ea` (see `package.json`).

## Installation

```bash
npm install @nradko/metric-omm-sdk-v0 viem
```

Or via the combined package:

```typescript
import { v0 } from "@nradko/metric-omm-sdk";
```

## Addresses

Multi-chain factory, deployer, state view (CREATE2), and per-chain router addresses are in `ADDRESSES` / `getAddressesOrThrow(chainId)`.

```typescript
import { ADDRESSES, ChainId, getAddressesOrThrow } from "@nradko/metric-omm-sdk-v0";

const eth = getAddressesOrThrow(ChainId.ETHEREUM);
// eth.factory, eth.poolDeployer, eth.stateView, eth.router, ...
```

## Swaps (Router)

```typescript
import {
  buildArgsAndExpectedAmountsForSwapExactInput,
  getAddressesOrThrow,
  ChainId,
} from "@nradko/metric-omm-sdk-v0";
import { MetricOmmSwapRouterAbi } from "@nradko/metric-omm-sdk-v0/abis";

const addresses = getAddressesOrThrow(ChainId.ETHEREUM);

const { args } = await buildArgsAndExpectedAmountsForSwapExactInput({
  publicClient,
  routerAddress: addresses.router,
  pool: poolAddress,
  recipient: account,
  zeroForOne: true,
  amountIn: 1_000_000_000_000_000_000n,
  slippagePercent: 0.5,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
});

await walletClient.writeContract({
  address: addresses.router,
  abi: MetricOmmSwapRouterAbi,
  functionName: "swapExactInput",
  args,
  account,
});
```

## Liquidity (`modifyLiquidity`)

```typescript
import {
  buildModifyLiquidityArgsForUniformAddition,
  encodeModifyLiquidityCalldata,
} from "@nradko/metric-omm-sdk-v0";

const modifyArgs = await buildModifyLiquidityArgsForUniformAddition({ /* ... */ });
const data = encodeModifyLiquidityCalldata(modifyArgs);
```

## What ships on npm

The published tarball includes only `dist/` and `src/` (see `package.json` `files`). Repo-only folders such as `exec/`, `ignition/`, and network deploy scripts are for maintainers and are not part of the npm package.

## Development

```bash
npm run build              # tsc only (default prepare)
npm run setup:contracts    # refresh ABIs from pinned git deps (maintainers)
npm test                   # Hardhat tests (needs matching @metric/* in node_modules)
```

### Tests in the monorepo

v0 has its own `package-lock.json` and `node_modules` (not hoisted with v1). From `dev_sdk/`:

```bash
npm run test:v0
```

Or from this directory after `npm ci` (no workspaces):

```bash
npm ci
npm test
```

CI uses `npm run test:v0` as part of root `npm test`.
