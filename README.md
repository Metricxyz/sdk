# Metric OMM SDK

TypeScript SDKs for Metric OMM AMM contracts, built on [viem](https://viem.sh/).

This directory holds **three independent npm packages**. They share no root tooling, lockfiles, or config — work inside each folder on its own.

| Package | Folder | Description |
| -------- | ------ | ----------- |
| `@nradko/metric-omm-sdk` | [metric-omm-sdk](./metric-omm-sdk) | Combined entry: `v0` and `v1` namespaces — see [HOW_TO.md](./metric-omm-sdk/HOW_TO.md) |
| `@nradko/metric-omm-sdk-v0` | [v0](./v0) | **v0** — main-line Router, `modifyLiquidity`, multi-chain addresses |
| `@nradko/metric-omm-sdk-v1` | [v1](./v1) | **v1** — SimpleRouter, SwapQuoter, LiquidityAdder, Ethereum + Base |

## Installation

**Combined (recommended when you need both APIs):**

```bash
npm install @nradko/metric-omm-sdk viem
```

**Version-specific:**

```bash
npm install @nradko/metric-omm-sdk-v1 viem
npm install @nradko/metric-omm-sdk-v0 viem
```

## Quick start (v1 — current Ethereum deployment)

```typescript
import { v1 } from "@nradko/metric-omm-sdk";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({ chain: mainnet, transport: http() });
const addresses = v1.getAddressesOrThrow(v1.ChainId.ETHEREUM);

const slot0 = await v1.getSlot0(publicClient, addresses.dataProvider, poolAddress);
```

See [v1/README.md](./v1/README.md) for SimpleRouter swaps (including native ETH and route API integration), SwapQuoter quotes, LiquidityAdder flows, and deployment addresses.

## Quick start (v0 — Router / modifyLiquidity)

```typescript
import { v0 } from "@nradko/metric-omm-sdk";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({ chain: mainnet, transport: http() });
const addresses = v0.getAddressesOrThrow(v0.ChainId.ETHEREUM);
```

See [v0/README.md](./v0/README.md) for Router swaps and `modifyLiquidity`.

## v0 vs v1 (breaking differences)

| | v0 | v1 |
| --- | --- | --- |
| Swaps | `MetricOmmSwapRouter` | `MetricOmmSimpleRouter` (+ `MetricOmmSwapQuoter` for quotes) |
| Add liquidity | Pool `modifyLiquidity` | `MetricOmmPoolLiquidityAdder.addLiquidity*` |
| Remove liquidity | Pool `modifyLiquidity` | Pool `removeLiquidity` |
| Pool immutables | On pool / legacy reads | `factory.poolImmutables(pool)` |
| Deployed chains (bundled addresses) | Many chains | Ethereum mainnet and Base |
| DataProvider | `addresses.dataProvider` on mainnet | `addresses.dataProvider` (MetricOmmPoolDataProvider) |

## Development

Each package is self-contained. From the package folder:

```bash
cd v0   # or v1, or metric-omm-sdk
npm ci
npm run build
npm run typecheck
npm run lint
npm run format:check
npm run verify   # full publish gate for that package
```

**v0** and **v1** pin different `@metric/core` / `@metric/periphery` commits and each has its own `package-lock.json`, `node_modules`, ESLint, and Prettier config.

**metric-omm-sdk** depends on **published** `@nradko/metric-omm-sdk-v0` and `@nradko/metric-omm-sdk-v1` from npm (exact versions in `package.json`), not local siblings.

Contract pins for **v1** match [`dev_metric-deploy/versions.env`](../dev_metric-deploy/versions.env). Refresh with `npm run sync:versions:env` inside `v1/`.

### Optional v1 fork tests

```bash
cd v1
export ETHEREUM_RPC_URL=https://...
npm test
```

Fork suite is skipped when no RPC URL is set.

## Publishing

Publish from **inside each package** with `npm publish`. `prepublishOnly` runs that package’s `verify` script only.

Publish order: **v0** → **v1** → **metric-omm-sdk**.

### v0

```bash
cd v0
npm publish --access public
```

### v1

```bash
cd v1
npm publish --access public
```

### Combined wrapper

1. Publish v0 and v1 first.
2. In `metric-omm-sdk/package.json`, set `@nradko/metric-omm-sdk-v0` and `@nradko/metric-omm-sdk-v1` to the exact versions you published.
3. `npm ci` in `metric-omm-sdk/`, then `npm publish --access public`.

`verify` on the wrapper fails if dependencies use `file:` links or are missing.
