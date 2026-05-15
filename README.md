# Metric OMM SDK (monorepo)

TypeScript SDKs for Metric OMM AMM contracts, built on [viem](https://viem.sh/).

This workspace publishes three npm packages:

| Package | Description |
| -------- | ----------- |
| [`@nradko/metric-omm-sdk`](./packages/metric-omm-sdk) | Combined entry: `v0` and `v1` namespaces — see [HOW_TO.md](./packages/metric-omm-sdk/HOW_TO.md) |
| [`@nradko/metric-omm-sdk-v0`](./packages/v0) | **v0** — main-line Router, `modifyLiquidity`, multi-chain addresses |
| [`@nradko/metric-omm-sdk-v1`](./packages/v1) | **v1** — Swapper, LiquidityAdder, `addLiquidity` / `removeLiquidity`, Ethereum mainnet |

## Installation

**Combined (recommended when you need both APIs):**

```bash
npm install @nradko/metric-omm-sdk viem
```

**Version-specific:**

```bash
npm install @nradko/metric-omm-sdk-v1 viem   # new deployments
npm install @nradko/metric-omm-sdk-v0 viem   # legacy Router deployments
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

See [packages/v1/README.md](./packages/v1/README.md) for Swapper quotes, LiquidityAdder flows, and mainnet addresses.

## Quick start (v0 — Router / modifyLiquidity)

```typescript
import { v0 } from "@nradko/metric-omm-sdk";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({ chain: mainnet, transport: http() });
const addresses = v0.getAddressesOrThrow(v0.ChainId.ETHEREUM);
```

See [packages/v0/README.md](./packages/v0/README.md) for Router swaps and `modifyLiquidity`.

## v0 vs v1 (breaking differences)

| | v0 | v1 |
| --- | --- | --- |
| Swaps | `MetricOmmSwapRouter` | `MetricOmmPoolSwapper` |
| Add liquidity | Pool `modifyLiquidity` | `MetricOmmPoolLiquidityAdder.addLiquidity*` |
| Remove liquidity | Pool `modifyLiquidity` | Pool `removeLiquidity` |
| Pool immutables | On pool / legacy reads | `factory.poolImmutables(pool)` |
| Deployed chains (bundled addresses) | Many chains | Ethereum mainnet only (for now) |
| DataProvider | `addresses.dataProvider` on mainnet | Deploy `MetricOmmPoolDataProvider`; pass as `dataProviderAddress` |

## Development

From this directory (`dev_sdk`):

```bash
npm install          # runs prepare: v0 build, v1 submodule+ABI sync+build, wrapper build
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test             # v1 unit tests + v0 tests (isolated install)
```

Contract pins for **v1** match [`dev_metric-deploy/versions.env`](../dev_metric-deploy/versions.env) (`METRIC_CORE_REF`, `METRIC_PERIPHERY_REF`). Refresh v1 `package.json` pins with `npm run sync:versions:v1` (or `sync:versions:v1:check` in CI).

### v0 tests in a workspace

v0 and v1 pin **different** `@metric/core` / `@metric/periphery` commits; npm hoists one copy. v0 Hardhat tests use an isolated install:

```bash
npm run test:v0
```

### Optional v1 fork tests

```bash
export ETHEREUM_RPC_URL=https://...
# optional: V1_ETHEREUM_TEST_POOL=0x...
npm test -w @nradko/metric-omm-sdk-v1
```

Fork suite is skipped when no RPC URL is set (default in CI without secrets).

### Regenerate v1 ABIs

```bash
npm run sync:abis:v1
```

Committed ABIs under `packages/v1/src/abis/` let consumers use the package without running Hardhat; `prepare` refreshes them on install.

## Publishing

Publish order: **v0** → **v1** → **wrapper** (update wrapper `dependencies` to published semver before the final publish).

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
# per package: npm publish -w @nradko/metric-omm-sdk-v1 --access public
```
