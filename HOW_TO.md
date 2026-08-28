# How to use `@metric.xyz/metric-omm-sdk-v1`

This guide is for **application developers** integrating swaps and liquidity against Metric OMM contracts. You do not need to read the Solidity repos; follow the flows below for the contracts already deployed on your chain.

Requires **viem** `^2.x` and **Node ≥ 22**.

```bash
npm install @metric.xyz/metric-omm-sdk-v1 viem
```

---

## Imports

Helpers are exported from the package root. Import them by name:

```typescript
import { getAddressesOrThrow, ChainId, buildExactInputSingleParams } from "@metric.xyz/metric-omm-sdk-v1";
```

The examples below use a namespace import so every helper is visibly qualified:

```typescript
import * as v1 from "@metric.xyz/metric-omm-sdk-v1";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({ chain: mainnet, transport: http() });
const ethV1 = v1.getAddressesOrThrow(v1.ChainId.ETHEREUM);
```

### ABIs

Committed ABIs live under the `/abis` subpath:

```typescript
import { MetricOmmSimpleRouterAbi, MetricOmmSwapQuoterAbi } from "@metric.xyz/metric-omm-sdk-v1/abis";
```

## What the v1 SDK covers

| Topic | v1 |
| ----- | --- |
| **Swaps** | `MetricOmmSimpleRouter` |
| **Quotes** | `MetricOmmSwapQuoter` (`quoteLiveExactInSingle`, multihop `quoteLiveExactIn`, …) |
| **Add liquidity** | `MetricOmmPoolLiquidityAdder.addLiquidity*` |
| **Remove liquidity** | Pool `removeLiquidity` |
| **Swap builder needs** | `simpleRouter` + `quoterAddress` (until bundled quoter is set) |
| **Addition builder needs** | `factoryAddress` + `dataProviderAddress` + pool |
| **Pool immutables** | `getPoolImmutables(client, factory, pool)` |
| **Create-pool admin fees** | `adminSpreadFeeE6`, `adminNotionalFeeE8` |
| **Create-pool extras** | Optional deposit/swap allowlists, `priceProviderTimelock` |
| **Chains in SDK** | Ethereum, Base, Robinhood, HyperEVM (bundled addresses) |
| **Lens for reads** | `addresses.dataProvider` (MetricOmmPoolDataProvider) |

Shared mental model:

- **Bins:** `createUniformBins`, `createBins`, `packBinData` — packed `bigint[]` for factory `createPool`.
- **Position key:** `salt` (uint256) + owner address; same salt can hold multiple bin positions.
- **Planning types:** `LiquidityDelta` = `{ bin, deltaShares }` for *plans*; builders convert to on-chain structs.
- **Slippage helper:** `NO_SLIPPAGE_LIMIT` for “no min/max caps” on add paths that support it.
- **Distribution math:** `buildModifyLiquidityArgsForUniformAddition`, `buildModifyLiquidityArgsForRemoval`, etc. — names retained even though v1 does not call `modifyLiquidity` on-chain.

### Where each transaction is sent

```text
createPool     → factory.createPool
add            → liquidityAdder.addLiquidityExactShares | addLiquidityWeighted
remove         → pool.removeLiquidity
swap           → router.exactInputSingle / exactOutputSingle (or exactInput / exactOutput multihop)
```

### On-chain calldata shapes

v1 splits “plan” from “wire format”:

| Action | SDK plan | On-chain struct | Encoder |
| ------ | -------- | ----------------- | -------- |
| Add | `LiquidityDelta[]` (+ max token caps) | `{ int256[] binIdxs, uint256[] shares }` | `additionPlanToPoolLiquidityDelta` → `encodeAddLiquidityExactSharesSelfCalldata` |
| Remove | negative `deltaShares` in plan | same struct, **positive** share amounts to burn | `removalPlanToPoolLiquidityDelta` → `encodeRemoveLiquidityCalldata` |

---

## Setup: clients and addresses

```typescript
import * as v1 from "@metric.xyz/metric-omm-sdk-v1";
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
// addresses.factory, .dataProvider, .simpleRouter, .liquidityAdder, .quoter, …

// Read helpers use addresses.dataProvider (dataProviderAddress param):
const lensAddress = addresses.dataProvider;
```

---

## Create a pool

`encodeCreatePoolCalldata(params)` → `factory.createPool`, or `createPool(publicClient, walletClient, factoryAddress, params)` to simulate + send.

```typescript
import * as v1 from "@metric.xyz/metric-omm-sdk-v1";

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

| Data | Helper |
| ---- | ------ |
| Slot0 / bins / position shares | `getSlot0`, `getBinStatesScaled`, `getPositionBinSharesFromDataProvider` via **`addresses.dataProvider`** |
| Pool immutables (tokens, scales, bin ranges) | `getPoolImmutables(publicClient, factory, pool)` |
| Protocol / pool fees | `getPoolFeeConfig(client, factory, pool)` |

```typescript
const slot0 = await v1.getSlot0(publicClient, addresses.dataProvider, poolAddress);
const imm = await v1.getPoolImmutables(publicClient, addresses.factory, poolAddress);
```

---

## Add liquidity

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

```typescript
import { MetricOmmSimpleRouterAbi } from "@metric.xyz/metric-omm-sdk-v1/abis";

const params = await v1.buildExactInputSingleParams({
  publicClient,
  pool: poolAddress,
  tokenIn,
  tokenOut,
  recipient: account.address,
  amountIn: 1_000_000_000_000_000_000n,
  slippagePercent: 0.5,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
  quoterAddress, // pass until addresses.quoter is configured
});

await walletClient.writeContract({
  address: addresses.simpleRouter,
  abi: MetricOmmSimpleRouterAbi,
  functionName: "exactInputSingle",
  args: [params],
  account,
});
```

Multihop: `buildExactInputParams` / `encodeExactInputCalldata` with `pools[]` and optional `extensionDatas[]`.

Quote without sending a swap: `v1.quoteLiveExactInSingle`, `v1.quoteLiveExactIn`, and hypothetical variants.

---

## End-to-end checklist

1. `getAddressesOrThrow(ChainId.ETHEREUM)` — factory, simpleRouter, liquidityAdder, dataProvider.
2. Use **`addresses.dataProvider`** for slot/bin/position reads.
3. **Create pool** — `encodeCreatePoolCalldata` → factory; parse `PoolCreated` for `poolAddress`.
4. **Add** — approve LiquidityAdder → `addLiquidityExactShares` with `PoolLiquidityDelta`.
5. **Swap** — approve SimpleRouter → `exactInputSingle` or multihop `exactInput` (params from builders + quoter).
6. **Remove** — `removeLiquidity` on pool with `encodeRemoveLiquidityCalldata`.

---

## Practical footguns

| Issue | Guidance |
| ----- | -------- |
| **Mixed-decimal pools (18/6)** | Use moderate share sizes (e.g. `10_000_000n`), not `parseUnits("100", 18)`, when minting into empty bins — scaled balances are `uint104`. |
| **Invalid bin index** | If you create `N` bins per side, valid indices are roughly `-N…-1` and `0…N-1`. Do not address bin `N`. |
| **Lens** | Use `addresses.dataProvider` (`MetricOmmPoolDataProvider`) for all pool reads. |
| **Approvals** | liquidityAdder for adds, simpleRouter for swaps, pool only for remove. |
| **Deterministic create tests** | Pass explicit `salt` in `CreatePoolFactoryParams`; otherwise each `encodeCreatePoolCalldata` differs. |
| **Type-only `ChainId` entries** | Exports many chain IDs for typing; only Ethereum, Base, Robinhood, and HyperEVM have `ADDRESSES`. Use `isChainSupported` / `getSupportedChainIds`. |

---

## Further reading

- [README.md](./README.md) — deployment address table, SimpleRouter and SwapQuoter examples, development, and publishing.
