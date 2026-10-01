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
import {
  getAddressesOrThrow,
  ChainId,
  buildExactInputSingleParams,
} from "@metric.xyz/metric-omm-sdk-v1";
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
import {
  MetricOmmSimpleRouterAbi,
  MetricOmmSwapQuoterAbi,
} from "@metric.xyz/metric-omm-sdk-v1/abis";
```

## What the v1 SDK covers

| Topic                      | v1                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Swaps**                  | `MetricOmmSimpleRouter`                                                                                    |
| **Quotes**                 | `MetricOmmSwapQuoter` (`quoteLiveExactInSingle`, multihop `quoteLiveExactIn`, …)                           |
| **Add liquidity**          | `MetricOmmPoolLiquidityAdder.addLiquidity*`                                                                |
| **Remove liquidity**       | Pool `removeLiquidity`                                                                                     |
| **Swap builder needs**     | `simpleRouter` + `quoterAddress` (until bundled quoter is set)                                             |
| **Addition builder needs** | `factoryAddress` + `dataProviderAddress` + pool                                                            |
| **Pool immutables**        | `getPoolImmutables(client, factory, pool)`                                                                 |
| **Create-pool admin fees** | `adminSpreadFeeE6`, `adminNotionalFeeE8`                                                                   |
| **Create-pool extras**     | Optional deposit/swap allowlists, `priceProviderTimelock`                                                  |
| **Chains in SDK**          | Ethereum, Base, Arbitrum, Avalanche, BNB, Polygon, MegaETH, HyperEVM, Monad, Robinhood (bundled addresses) |
| **Lens for reads**         | `addresses.dataProvider` (MetricOmmPoolDataProvider)                                                       |

Shared mental model:

- **Bins:** `createUniformBins`, `createBins`, `packBinData` — packed `bigint[]` for factory `createPool`.
- **Position key:** `salt` (uint256) + owner address; same salt can hold multiple bin positions.
- **Planning types:** `LiquidityDelta` = `{ bin, deltaShares }` for _plans_; builders convert to on-chain structs.
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

| Action | SDK plan                              | On-chain struct                                 | Encoder                                                                          |
| ------ | ------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| Add    | `LiquidityDelta[]` (+ max token caps) | `{ int256[] binIdxs, uint256[] shares }`        | `additionPlanToPoolLiquidityDelta` → `encodeAddLiquidityExactSharesSelfCalldata` |
| Remove | negative `deltaShares` in plan        | same struct, **positive** share amounts to burn | `removalPlanToPoolLiquidityDelta` → `encodeRemoveLiquidityCalldata`              |

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

// For pools using OracleValueStopLossExtension, derive initialScaledAmount{0,1}PerE18Shares
// from the opening price with recommendedInitialScaledAmounts instead of picking them by
// hand — see metric-core docs/POOL_CONFIGURATION_AND_MANAGEMENT.md §2.5.
const { initialScaledAmount0PerE18Shares, initialScaledAmount1PerE18Shares } =
  v1.recommendedInitialScaledAmounts(1 /* opening price: token1 per token0 */);

const params: v1.CreatePoolFactoryParams = {
  token0,
  token1,
  priceProvider,
  admin,
  adminFeeDestination: admin,
  adminSpreadFeeE6: 5_000, // on-chain fee units, not “percent” strings
  adminNotionalFeeE8: 0,
  // Values below the factory's current default are clamped up on-chain; 0 defers to it entirely.
  protocolSpreadFeeE6: 0,
  protocolNotionalFeeE8: 0,
  curBinDistFromProvidedPricePercent: 0,
  initialScaledAmount0PerE18Shares,
  initialScaledAmount1PerE18Shares,
  minimalOperationalLiquidity: v1.computeMinimumOperationalLiquidity(
    initialScaledAmount0PerE18Shares,
    initialScaledAmount1PerE18Shares,
  ),
  bidAskRefAsymmetryX8: v1.DISABLED_BID_ASK_REF_ASYMMETRY_X8,
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

| Data                                         | Helper                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Slot0 / bins / position shares               | `getSlot0`, `getBinStatesScaled`, `getPositionBinSharesFromDataProvider` via **`addresses.dataProvider`** |
| Pool immutables (tokens, scales, bin ranges) | `getPoolImmutables(publicClient, factory, pool)`                                                          |
| Protocol / pool fees                         | `getPoolFeeConfig(client, factory, pool)`                                                                 |

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
  args: [
    pool,
    salt,
    poolLiquidityDelta,
    maxAmountToken0,
    maxAmountToken1,
    v1.UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS, // or v1.prepareLiquidityCursorBounds(...) to guard the add
    v1.EMPTY_EXTENSION_DATA,
  ],
});
// or: v1.encodeAddLiquidityExactSharesSelfCalldata({ pool, salt, deltas: poolLiquidityDelta, maxAmountToken0, maxAmountToken1 })
```

Weighted adds: `encodeAddLiquidityWeightedSelfCalldata` + `buildModifyLiquidityArgsForAddition` with weight-style inputs. Custodial / meta-tx: `*WithOwnerCalldata` variants pass an explicit `owner`. Weighted adds size themselves off the pool's _live_ cursor at execution time, so `minimalCurBin`/`minimalPosition`/`maximalCurBin`/`maximalPosition` are required — use `prepareLiquidityCursorBounds` to derive a tight bound from the current cursor (protects against an LP sandwich); pass `UNCONSTRAINED_LIQUIDITY_CURSOR_BOUNDS` only if that protection is deliberately not wanted.

---

### Total-token budgets and Max

`buildModifyLiquidityArgsForUniformAdditionWithTotalTokenAmount` treats
`totalValueToAddInToken` as a hard cap on the selected source token, including
`specAmountBufferPercent`. It calculates calibration and final shares from one
block snapshot, and reduces the per-bin targets when integer rounding would
exceed that budget. It rebuilds the shares and both token amounts together;
callers must not clip a returned token cap independently of its shares.

The other token is derived from the chosen bins and still needs its own balance
check. A budget too small for the selected bins throws instead of returning an
unfundable plan. All reads are read-only; execution can still fail if pool state
moves after the snapshot, so callers should refresh the plan before submitting.

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

| Issue                          | Guidance                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Mixed-decimal pools (18/6)** | Use moderate share sizes (e.g. `10_000_000n`), not `parseUnits("100", 18)`, when minting into empty bins — scaled balances are `uint104`. |
| **Invalid bin index**          | If you create `N` bins per side, valid indices are roughly `-N…-1` and `0…N-1`. Do not address bin `N`.                                   |
| **Lens**                       | Use `addresses.dataProvider` (`MetricOmmPoolDataProvider`) for all pool reads.                                                            |
| **Approvals**                  | liquidityAdder for adds, simpleRouter for swaps, pool only for remove.                                                                    |
| **Deterministic create tests** | Pass explicit `salt` in `CreatePoolFactoryParams`; otherwise each `encodeCreatePoolCalldata` differs.                                     |

---

## Router sequences and external swap fallback

These helpers require the SimpleRouter from periphery `ed58520` (or a compatible
version) with the four-argument `externalSwap` entrypoint, plus an ExternalSwapExecutor
bound to that router. Existing router deployments without `sequence` / `externalSwap`
are not compatible. Approve input tokens on the SimpleRouter.

Every bundled chain uses the same SimpleRouter and its bound ExternalSwapExecutor
(`getAddressesOrThrow(chainId).externalSwapExecutor`).

Build the primary params with the existing quote or route helpers, then pass an
external quote to the matching fallback helper:

```ts
const addresses = getAddressesOrThrow(ChainId.ETHEREUM);
const executor = addresses.externalSwapExecutor;

// Obtain externalRouterCalldata with the executor as payer and output recipient.
const data = prepareExactInputSingleWithExternalSwapFallbackCalldata(params, {
  executor,
  externalRouter,
  externalRouterCalldata,
});
await walletClient.sendTransaction({ account, to: addresses.simpleRouter, data });
```

The sequence contains two multicalls. Primary success stops execution. Primary
failure rolls back that whole multicall and runs the external swap. Fallback
failure reverts the transaction. Both branches use the primary token pair,
recipient, deadline, and limits (`amountIn` / `amountOutMinimum` for exact input,
`amountInMaximum` / `amountOut` for exact output).

Fallback helpers infer the swap shape from params. They throw if params contain
both exact-input and exact-output amount fields, or both `tokens` and
`tokenIn`/`tokenOut`. Supply one complete shape; unrelated quote metadata is allowed.

If both branches fail, the transaction reverts with `SequenceFailed(results, statuses)`.
Both revert reasons are available: `results[0]` is the primary error and
`results[1]` is the fallback error. For an expired deadline, both decode to
`TransactionExpired`; no external router call is made. The fallback does not bypass the primary deadline.

Both successful sequence returns and `SequenceFailed` use `uint8[] statuses`:
`StepStatus.NOT_EXECUTED = 0`, `SUCCESS = 1`, and `FAILURE = 2`.
Both arrays retain the number of sequence calls. Unexecuted steps have `"0x"`
results and status `NOT_EXECUTED`; the last executed entry identifies the step
that triggered a revert. Each result is capped at 4,096 bytes and may be truncated.
For these fallback helpers, primary success yields `[1, 0]`, fallback success
`[2, 1]`, and both failing `[2, 2]` in the revert payload. Decode each error in
`results` with the ABI of the contract that produced it.

The primary swap and external fallback **MUST use the same input and output
tokens**. For multihop swaps, these are the first and last entries in `params.tokens`;
intermediate tokens and routes may differ. The caller must ensure the external
quote calldata uses this pair; the SDK cannot validate token addresses encoded
inside arbitrary external calldata.

The **ExternalSwapExecutor performs the external swap**: the SimpleRouter funds
it, then it calls `externalRouter` with `externalRouterCalldata`.

The external swap's payer **MUST be the executor**, not the SimpleRouter or the
user. Request or encode the external quote with the executor as its payer/sender
and send output to either the executor or the swap's settlement recipient
(SimpleRouter for `AndUnwrap`, otherwise `params.recipient`). The executor forwards
any output it receives to that settlement recipient; `params.recipient` itself
must not be the executor. The user approves SimpleRouter, which funds the executor.
The SDK does not obtain or rewrite aggregator quotes. For exact output, the external quote
must implement exact-output behavior; the router enforces a minimum output and
maximum input, so excess output is also delivered to the recipient.

All existing variants have matching helpers: `prepareExactInput`,
`prepareExactInputSingle`, `prepareExactOutput`, and `prepareExactOutputSingle`,
optionally followed by `SupportingNativePayment` or `AndUnwrap`, then
`WithExternalSwapFallbackCalldata`. Unwrap fallback helpers take `simpleRouter` as the third argument and
`chainId` / `wrappedNative` as the fourth and fifth arguments. Native-payment
fallback helpers take `chainId` / `wrappedNative` as the third and fourth arguments. Native payment helpers use wrappedNative as the input token and
accept the native contribution through transaction `value`. Both branches refund
unused router ETH. The external branch also requests automatic ETH refunds of
unused wrapped-native input. Unwrap helpers require wrappedNative output and unwrap
inside each branch, making swap and unwrap atomic together.

For standalone external swaps, use `encodeExternalSwapCalldata(executor, params)`,
`prepareExternalSwapSupportingNativePaymentCalldata(executor, params, chainId, wrappedNative)`, or
`prepareExternalSwapAndUnwrapCalldata(executor, params, simpleRouter, chainId, wrappedNative)`.
`encodeSequenceCalldata` and the `OnStepSuccess` / `OnStepFailure` enums are also
exported for custom sequences.

`encodeExternalSwapCalldata(executor, params, payerIsRouter = false, refundAsNative = false)`
(and its alias `prepareExternalSwapCalldata`) encodes the new four-argument contract
entrypoint. Caller-funded swaps temporarily fund `amountInMaximum`, then automatically
return unused input to the caller, so net spend is only the amount consumed. They
preserve pre-existing router input-token balances; no input sweep is needed.

| Flow | Flags (`payerIsRouter`, `refundAsNative`) | Follow-up in the same multicall |
| --- | --- | --- |
| Token input, token output | `false, false` | None |
| ETH input, ETH refund | `false, true` | `refundETH()` for ETH never wrapped |
| ETH input, WETH refund | `false, false` | `refundETH()` for ETH never wrapped |
| Token input, ETH output | `false, false`; recipient = SimpleRouter | `unwrapWETH9(amountOutMinimum, finalRecipient)` |

The native-payment helper chooses ETH refunds, including for mixed ETH/WETH funding.
To keep refunds wrapped, compose `encodeExternalSwapCalldata(executor, params)` and
`encodeRefundETHCalldata()` with `encodeMulticallCalldata` instead. Both native flows
require WETH input. `refundAsNative = true` with another input token reverts.

For output from a preceding swap, set that swap's recipient to SimpleRouter and
encode the external swap with `payerIsRouter = true` in the same multicall. This
spends `amountInMaximum` from the router's token balance without wrapping ETH or
pulling a shortfall from the caller. Leftovers stay in the router, even with
`refundAsNative = true` (which still requires WETH). Consume them in a later step or
append `encodeSweepTokenCalldata(tokenIn, 0n, recipient)` / `encodeUnwrapWETH9Calldata`.
Router balances are publicly accessible; keep funding and spending atomic.
Sweep and unwrap helpers transfer the entire corresponding token balance;
`refundETH` transfers the entire ETH balance to the transaction caller.

All swap helpers with `SupportingNativePayment` or `AndUnwrap` take two final
arguments: `chainId: number | null` and `wrappedNative: Address | null`.

- `chainId, null`: resolve wrapped native from the SDK's chain addresses.
- `null, wrappedNative`: validate against the explicitly supplied address.
- `chainId, wrappedNative`: require the address to match the chain, then validate the token.
- `null, null`: explicitly skip token validation; the caller is responsible for correctness.

Unknown chain IDs throw, including when an explicit address is also supplied.
A supplied wrapped-native address must be valid and non-zero. Address comparisons
ignore letter case. Native-payment helpers validate the input token; unwrap
helpers validate the output token. Multihop helpers check the corresponding
first or last path token.

```ts
const data = prepareExternalSwapAndUnwrapCalldata(
  executor,
  params,
  simpleRouter,
  chainId,
  null,
);
```

## Further reading

- [README.md](./README.md) — deployment address table, SimpleRouter and SwapQuoter examples, development, and publishing.
