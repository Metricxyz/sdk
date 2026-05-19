# How to use `@nradko/metric-omm-sdk`

This guide is for **application developers** integrating swaps and liquidity. You do not need to read the Solidity repos; follow the version that matches the contracts already deployed on your chain.

## Packages at a glance

| Install | What you get |
| -------- | ------------- |
| `@nradko/metric-omm-sdk` | **Combined** — `v0` and `v1` namespaces in one dependency |
| `@nradko/metric-omm-sdk-v0` | Legacy Router + `modifyLiquidity` API only |
| `@nradko/metric-omm-sdk-v1` | Current Swapper + LiquidityAdder API only |

All packages require **viem** `^2.x` and **Node ≥ 22**.

```bash
npm install @nradko/metric-omm-sdk viem
```

> **Naming:** npm uses **`v0`** and **`v1`**. v0 targets older deployments; v1 targets the newer Ethereum deployment.

---

## Combined SDK: imports

The wrapper re-exports both APIs as namespaces so you can depend once and import explicitly:

```typescript
import { v0, v1 } from "@nradko/metric-omm-sdk";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({ chain: mainnet, transport: http() });

// Legacy pool on Base → v0
const baseV0 = v0.getAddressesOrThrow(v0.ChainId.BASE);

// New Ethereum deployment → v1
const ethV1 = v1.getAddressesOrThrow(v1.ChainId.ETHEREUM);
```

You can also install a single version package and import from the root:

```typescript
import { buildArgsAndExpectedAmountsForSwapExactInput } from "@nradko/metric-omm-sdk-v1";
```

**Do not mix v0 and v1 helpers for the same pool.** Factory address, swap router, and liquidity entrypoints differ. Use one namespace end-to-end for create / read / add / remove / swap.

### ABIs

Each version exposes committed ABIs:

```typescript
import { MetricOmmPoolSwapperAbi } from "@nradko/metric-omm-sdk-v1/abis";
import { MetricOmmSwapRouterAbi } from "@nradko/metric-omm-sdk-v0/abis";
```

Via the combined package, import from the underlying package name (re-export of `/abis` is not on the wrapper root).


## v0 vs v1 — what changes for SDK users

### One-page comparison

| Topic | v0 | v1 |
| ----- | --- | --- |
| **Swaps** | `MetricOmmSwapRouter` | `MetricOmmPoolSwapper` |
| **Add liquidity** | Pool `modifyLiquidity` (positive deltas) | `MetricOmmPoolLiquidityAdder.addLiquidity*` |
| **Remove liquidity** | Pool `modifyLiquidity` (negative deltas) | Pool `removeLiquidity` |
| **Swap builder needs** | `routerAddress` | `factoryAddress` + `swapperAddress` |
| **Addition builder needs** | `stateViewAddress` + pool | `factoryAddress` + `dataProviderAddress` + pool |
| **Pool immutables** | Read from pool / StateView | `getPoolImmutables(client, factory, pool)` |
| **Create-pool admin fees** | `maxDriftPercent`, `driftDecayPerSecondPercent`, `adminFeePercent` | `adminSpreadFeeE6`, `adminNotionalFeeE8` |
| **Create-pool extras** | — | Optional deposit/swap allowlists, `priceProviderTimelock` |
| **Chains in SDK** | Many | Ethereum mainnet (for bundled addresses) |
| **Lens for reads** | `addresses.stateView` (StateView) | `addresses.dataProvider` (MetricOmmPoolDataProvider) |

Shared between versions (same mental model):

- **Bins:** `createUniformBins`, `createBins`, `packBinData` — packed `bigint[]` for factory `createPool`.
- **Position key:** `salt` (uint256) + owner address; same salt can hold multiple bin positions.
- **Planning types:** `LiquidityDelta` = `{ bin, deltaShares }` for *plans*; builders convert to on-chain structs.
- **Slippage helper:** `NO_SLIPPAGE_LIMIT` for “no min/max caps” on add paths that support it.
- **Distribution math:** `buildModifyLiquidityArgsForUniformAddition`, `buildModifyLiquidityArgsForRemoval`, etc. — names retained in v1 even though v1 does not call `modifyLiquidity` on-chain.

### Where each transaction is sent

```text
v0:
  createPool     → factory.createPool
  add/remove     → pool.modifyLiquidity
  swap           → router.swapExactInput / swapExactOutput

v1:
  createPool     → factory.createPool
  add            → liquidityAdder.addLiquidityExactShares | addLiquidityWeighted
  remove         → pool.removeLiquidity
  swap           → swapper.swapExactInput | swapExactOutput
```

### On-chain calldata shapes (v1 only)

v1 splits “plan” from “wire format”:

| Action | SDK plan | On-chain struct | Encoder |
| ------ | -------- | ----------------- | -------- |
| Add | `LiquidityDelta[]` (+ max token caps) | `{ int256[] binIdxs, uint256[] shares }` | `additionPlanToPoolLiquidityDelta` → `encodeAddLiquidityExactSharesSelfCalldata` |
| Remove | negative `deltaShares` in plan | same struct, **positive** share amounts to burn | `removalPlanToPoolLiquidityDelta` → `encodeRemoveLiquidityCalldata` |

v0 uses `encodeModifyLiquidityCalldata` with the legacy tuple `(salt, deltas[], specAmount0, specAmount1)` on the **pool**.

---

## Setup: clients and addresses

```typescript
import { v1 } from "@nradko/metric-omm-sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const account = privateKeyToAccount("0x…");
const publicClient = createPublicClient({ chain: mainnet, transport: http() });
const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});

const addresses = v1.getAddressesOrThrow(v1.ChainId.ETHEREUM);
// addresses.factory, .dataProvider, .swapper, .liquidityAdder, …

// Read helpers use addresses.dataProvider (dataProviderAddress param):
const lensAddress = addresses.dataProvider;
```

Replace `v1` with `v0` and your `chainId` when using legacy deployments (`v0.ChainId.BASE`, etc.).

---

## Create a pool

Both versions: `encodeCreatePoolCalldata(params)` → `factory.createPool`, or `createPool(publicClient, walletClient, factoryAddress, params)` to simulate + send.

### v0 params (drift / percent fees)

```typescript
import { v0 } from "@nradko/metric-omm-sdk";

const params: v0.CreatePoolFactoryParams = {
  token0,
  token1,
  priceProvider,
  admin,
  reportSwapToPriceProvider: false,
  adminFeeDestination: admin,
  maxDriftPercent: 5,
  driftDecayPerSecondPercent: 0.01,
  adminFeePercent: 5,
  curBinDistFromProvidedPricePercent: 0,
  initialScaledToken0PerShareE18: 10n ** 18n,
  initialScaledToken1PerShareE18: 10n ** 18n,
  minimalMintableLiquidity: 1000n,
  nonNegativeBins: v0.createUniformBins(10, 10_000),
  negativeBins: v0.createUniformBins(10, 10_000),
};

const data = v0.encodeCreatePoolCalldata(params);
```

### v1 params (E6 / E8 admin fees)

```typescript
import { v1 } from "@nradko/metric-omm-sdk";

const params: v1.CreatePoolFactoryParams = {
  token0,
  token1,
  priceProvider,
  admin,
  reportSwapToPriceProvider: false,
  adminFeeDestination: admin,
  adminSpreadFeeE6: 5_000,      // on-chain fee units, not “percent” strings
  adminNotionalFeeE8: 0,
  curBinDistFromProvidedPricePercent: 0,
  initialScaledToken0PerShareE18: 10n ** 18n,
  initialScaledToken1PerShareE18: 10n ** 18n,
  minimalMintableLiquidity: 1000n,
  nonNegativeBins: v1.createUniformBins(10, 10_000),
  negativeBins: v1.createUniformBins(10, 10_000),
  // depositAllowlistProvider, swapAllowlistProvider, priceProviderTimelock optional
};

const data = v1.encodeCreatePoolCalldata(params);
```

**Tips**

- Oracle must know the pair (e.g. MockOracle: `setTokens(token0, token1)` before create in tests).
- `salt` is optional; omit for random CREATE2 salt, or set fixed `bytes32` for reproducible pool address.
- Bin layout limits still apply (~128 bins per side, cumulative distance &lt; 1e6). Prefer modest bin counts in app code.

---

## Read pool state

| Data | v0 | v1 |
| ---- | --- | --- |
| Slot0 / bins / position shares | `getSlot0`, `getBinStatesScaled`, `getPositionBinSharesFromDataProvider` with **bundled** `addresses.stateView` | Same helpers via **`addresses.dataProvider`** (`dataProviderAddress` param) |
| Pool immutables (tokens, scales, bin ranges) | `getPoolImmutables(publicClient, pool)` | `getPoolImmutables(publicClient, factory, pool)` |
| Protocol / pool fees | `getFeeConfig` via StateView (v0 layout) | `getPoolFeeConfig(client, factory, pool)` |

```typescript
const slot0 = await v1.getSlot0(publicClient, addresses.dataProvider, poolAddress);
const imm = await v1.getPoolImmutables(publicClient, addresses.factory, poolAddress);
```

---

## Add liquidity

### v0 — single pool entrypoint

1. Build args (uniform, custom bins, or total token budget):

```typescript
const { salt, deltas, specAmount0, specAmount1 } =
  await v0.buildModifyLiquidityArgsForUniformAddition({
    publicClient,
    stateViewAddress: addresses.stateView,
    poolAddress: pool,
    amountInTokensPerBin: 1_000_000n,
    amountIsInToken0: true,
    currentPrice: 3000,
    lowerBin: -5,
    upperBin: 5,
  });
```

2. Approve tokens on the **pool**.
3. Send:

```typescript
await walletClient.writeContract({
  address: pool,
  abi: v0.MetricOmmPoolAbi,
  functionName: "modifyLiquidity",
  args: [salt, deltas, specAmount0, specAmount1],
});
// or: data: v0.encodeModifyLiquidityCalldata({ salt, deltas, specAmount0, specAmount1 })
```

### v1 — LiquidityAdder

1. Build **pool delta** and max token caps (uniform example):

```typescript
const [salt, deltas, maxAmountToken0, maxAmountToken1] =
  await v1.buildModifyLiquidityArgsForUniformAddition({
    publicClient,
    factoryAddress: addresses.factory,
    dataProviderAddress: addresses.dataProvider,
    poolAddress: pool,
    amountInTokensPerBin: 1_000_000n,
    amountIsInToken0: true,
    currentPrice: 3000,
    lowerBin: -5,
    upperBin: 5,
  });

const poolLiquidityDelta = v1.additionPlanToPoolLiquidityDelta(deltas);
```

For custom bin targets, use `buildAddLiquidityExactSharesParamsFromBinTargets` (wraps `buildModifyLiquidityArgsForAddition`).

2. Approve token0/token1 on **`addresses.liquidityAdder`**.
3. Send:

```typescript
await walletClient.writeContract({
  address: addresses.liquidityAdder,
  abi: v1.MetricOmmPoolLiquidityAdderAbi,
  functionName: "addLiquidityExactShares",
  args: [pool, salt, poolLiquidityDelta, maxAmountToken0, maxAmountToken1],
});
// or: v1.encodeAddLiquidityExactSharesSelfCalldata({ pool, salt, deltas: poolLiquidityDelta, maxAmountToken0, maxAmountToken1 })
```

Weighted adds: `encodeAddLiquidityWeightedSelfCalldata` + `buildModifyLiquidityArgsForAddition` with weight-style inputs. Custodial / meta-tx: `*WithOwnerCalldata` variants pass an explicit `owner`.

---

## Remove liquidity

### v0

Negative `deltaShares` in the plan → same `modifyLiquidity` on the **pool**:

```typescript
const { salt, deltas, specAmount0, specAmount1 } =
  await v0.buildModifyLiquidityArgsForRemoval({
    publicClient,
    stateViewAddress,
    poolAddress: pool,
    owner: account.address,
    salt: 0n,
    percentageToRemove: 100,
  });

await walletClient.writeContract({
  address: pool,
  abi: v0.MetricOmmPoolAbi,
  functionName: "modifyLiquidity",
  args: [salt, deltas, specAmount0, specAmount1],
});
```

### v1

Dedicated pool function — no LiquidityAdder:

```typescript
const { salt, deltas } = await v1.buildModifyLiquidityArgsForRemoval({
  publicClient,
  dataProviderAddress: addresses.dataProvider,
  poolAddress: pool,
  owner: account.address,
  salt: 0n,
  percentageToRemove: 100,
});

const poolDelta = v1.removalPlanToPoolLiquidityDelta(deltas);

await walletClient.writeContract({
  address: pool,
  abi: v1.MetricOmmPoolAbi,
  functionName: "removeLiquidity",
  args: [account.address, salt, poolDelta],
});
// or: data: v1.encodeRemoveLiquidityCalldata({ owner, salt, deltas: poolDelta })
```

---

## Swaps

### v0 — Router

```typescript
import { MetricOmmSwapRouterAbi } from "@nradko/metric-omm-sdk-v0/abis";

const { args, expectedInput, expectedOutput } =
  await v0.buildArgsAndExpectedAmountsForSwapExactInput({
    publicClient,
    routerAddress: addresses.router,
    pool: poolAddress,
    recipient: account.address,
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

Quote without tx: `v0.quoteSwap`, `quoteExpectedAmountsForSwapExactInput`.

### v1 — Swapper

```typescript
import { MetricOmmPoolSwapperAbi } from "@nradko/metric-omm-sdk-v1/abis";

const { args } = await v1.buildArgsAndExpectedAmountsForSwapExactInput({
  publicClient,
  factoryAddress: addresses.factory,
  swapperAddress: addresses.swapper,
  pool: poolAddress,
  recipient: account.address,
  zeroForOne: true,
  amountIn: 1_000_000_000_000_000_000n,
  slippagePercent: 0.5,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
});

// Approve input token on swapper (ERC20 path)
await walletClient.writeContract({
  address: addresses.swapper,
  abi: MetricOmmPoolSwapperAbi,
  functionName: "swapExactInput",
  args,
  account,
});
```

Low-level encoding (no quote math): `v1.encodeSwapExactInputCalldata` / `prepareSwapExactInputCalldata` (aliases). Native ETH input: `prepareSwapExactInputNativeForTokensCalldata`.

---

## End-to-end checklist (v1)

1. `getAddressesOrThrow(ChainId.ETHEREUM)` — factory, swapper, liquidityAdder.
2. Use **`addresses.dataProvider`** for slot/bin/position reads (replaces a separate StateView deploy).
3. **Create pool** — `encodeCreatePoolCalldata` → factory; parse `PoolCreated` for `poolAddress`.
4. **Add** — approve LiquidityAdder → `addLiquidityExactShares` with `PoolLiquidityDelta`.
5. **Swap** — approve Swapper → `swapExactInput` with args from builder.
6. **Remove** — `removeLiquidity` on pool with `encodeRemoveLiquidityCalldata`.

Same flow on v0, but router + `modifyLiquidity` for add/remove and bundled StateView.

---

## Practical footguns

| Issue | Guidance |
| ----- | -------- |
| **Mixed-decimal pools (18/6)** | Use moderate share sizes (e.g. `10_000_000n`), not `parseUnits("100", 18)`, when minting into empty bins — scaled balances are `uint104`. |
| **Invalid bin index** | If you create `N` bins per side, valid indices are roughly `-N…-1` and `0…N-1`. Do not address bin `N`. |
| **v1 lens** | Use `addresses.dataProvider` (`MetricOmmPoolDataProvider`); StateView is not deployed separately. |
| **Approvals** | v0: pool (+ router for swaps). v1: liquidityAdder for adds, swapper for swaps, pool only for remove. |
| **Deterministic create tests** | Pass explicit `salt` in `CreatePoolFactoryParams`; otherwise each `encodeCreatePoolCalldata` differs. |
| **Type-only `ChainId` entries** | v1 exports many chain IDs for typing; only Ethereum has `ADDRESSES`. Use `isChainSupported` / `getSupportedChainIds`. |

---

## Further reading

- [packages/v0/README.md](../v0/README.md) — Router, multi-chain addresses.
- [packages/v1/README.md](../v1/README.md) — mainnet address table, Swapper examples.
- [Monorepo README](../../README.md) — development, publishing, ABI sync.
