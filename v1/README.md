# @metric.xyz/metric-omm-sdk-v1

TypeScript SDK for **v1** Metric OMM contracts: **SimpleRouter**, **SwapQuoter**, **LiquidityAdder**, pool `addLiquidity` / `removeLiquidity`, **extensions**, and factory-backed reads.

Pinned **metric-periphery** `6bb01830399a18c559067d53b73c749d89d7bd8d` (core via periphery `lib/metric-core`).

## Installation

```bash
npm install @metric.xyz/metric-omm-sdk-v1 viem
```

Or via the combined package:

```typescript
import { v1 } from "@metric.xyz/metric-omm-sdk";
```

## Deployed addresses

Protocol contracts use the **same CREATE2 addresses** on Ethereum, Base, Arbitrum, Avalanche, BNB Chain, Polygon, MegaETH, HyperEVM, Monad, and Robinhood. Wrapped native differs per chain.

| Contract | Address |
| -------- | ------- |
| MetricOmmPoolFactory | `0xA32761549A1DE40060c194C86A8df24f0A29bA2d` |
| MetricOmmPoolDeployer | `0x8b25C2c3Dc0C3A9DC1272FbBC09E064015097A5B` |
| MetricOmmPoolLiquidityAdder | `0x6cd70697cca0586e80907cddC6e9304f910229DD` |
| MetricOmmPoolDataProvider | `0x95ab07bCef6463712213D0845962FF4293E5acf7` |
| MetricOmmSimpleRouter | `0x7D4fb51164288D2e1fdA2032D887517F71008b89` |
| MetricOmmSwapQuoter | `0x45e72641A71A7eCcccF2Ef905e4159951cdeF8e0` |
| DepositAllowlistExtension | `0x180c94f108dBa243FB74819fD1cC490dd82a2A2e` |
| SwapAllowlistExtension | `0xe9c6C1f3b5a1994A7B66c844348b67086d33533b` |
| OracleValueStopLossExtension | `0x022B57C96a337b12eAAB1b39AF9E8a07dE23eE67` |
| PriceVelocityGuardExtension | `0x5e971600f5f7e9972631960CCF1F57AF53B5fE95` |

`MetricOmmPoolDataProvider` is the deployed lens: pool reads (`slot0`, `binStates`, `positionBinShares`, …). Pass `addresses.dataProvider` to read helpers and liquidity builders (`dataProviderAddress` param). There is no separate StateView deployment — use `dataProvider` for all lens reads.

```typescript
import { getAddressesOrThrow, getSupportedChainIds, ChainId } from "@metric.xyz/metric-omm-sdk-v1";

const a = getAddressesOrThrow(ChainId.ETHEREUM);
// All supported chains use the same protocol addresses; wrappedNative is chain-specific.
const supportedChains = getSupportedChainIds();
```

All ten deployed chains have entries in `ADDRESSES` for this release.

## Swaps (SimpleRouter)

### Single hop

```typescript
import {
  buildExactInputSingleParams,
  getAddressesOrThrow,
  ChainId,
} from "@metric.xyz/metric-omm-sdk-v1";
import { MetricOmmSimpleRouterAbi } from "@metric.xyz/metric-omm-sdk-v1/abis";

const addresses = getAddressesOrThrow(ChainId.ETHEREUM);

const params = await buildExactInputSingleParams({
  publicClient,
  pool: poolAddress,
  tokenIn,
  tokenOut,
  recipient: account,
  amountIn: 1_000_000_000_000_000_000n,
  slippagePercent: 0.5,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
  quoterAddress, // pass deployed MetricOmmSwapQuoter address
});

await walletClient.writeContract({
  address: addresses.simpleRouter,
  abi: MetricOmmSimpleRouterAbi,
  functionName: "exactInputSingle",
  args: [params],
  account,
});
```

### Multihop

```typescript
import { buildExactInputParams, encodeExactInputCalldata } from "@metric.xyz/metric-omm-sdk-v1";

const pathParams = await buildExactInputParams({
  publicClient,
  tokenIn,
  tokenOut,
  pools: [poolA, poolB],
  recipient: account,
  amountIn,
  slippagePercent: 0.5,
  deadline,
  quoterAddress,
});

await walletClient.sendTransaction({
  to: addresses.simpleRouter,
  data: encodeExactInputCalldata(pathParams),
  account,
});
```

Approve the **SimpleRouter** for input tokens (ERC-20 path). Swap allowlist extensions gate the **router contract address**, not the end-user EOA.

### Native ETH

**Exact input + native payment:** use `prepareExactInputSingleSupportingNativePaymentCalldata` / `prepareExactInputSupportingNativePaymentCalldata` (multicall + `refundETH`). Set `msg.value` on the transaction yourself.

**Exact output + native payment:** use `prepareExactOutputSingleSupportingNativePaymentCalldata` / `prepareExactOutputSupportingNativePaymentCalldata` (multicall + `refundETH`). Set `msg.value` on the transaction yourself.

**ETH output (unwrap):** use `prepareExactInputSingleAndUnwrapCalldata` / `prepareExactInputAndUnwrapCalldata` (or exact-output variants).

```typescript
import {
  buildExactInputSingleParams,
  prepareExactInputSingleSupportingNativePaymentCalldata,
  prepareExactInputSingleAndUnwrapCalldata,
} from "@metric.xyz/metric-omm-sdk-v1";

// ETH → ERC-20: build params with tokenIn = addresses.wrappedNative, then:
const params = await buildExactInputSingleParams({ /* … */, quoterAddress });
const swapData = prepareExactInputSingleSupportingNativePaymentCalldata(params);
await walletClient.sendTransaction({ to: addresses.simpleRouter, data: swapData, value: params.amountIn, account });

// ERC-20 → ETH: tokenOut = wrappedNative, then unwrap via multicall:
const unwrapData = prepareExactInputSingleAndUnwrapCalldata(params, addresses.simpleRouter);
await walletClient.sendTransaction({ to: addresses.simpleRouter, data: unwrapData, account });
```

**Exact input + native payment:** pass any `msg.value` ≤ `amountIn`; the router uses native ETH first and pulls the rest from wrappedNative (approve the router). Unused native ETH is refunded.

**Exact output + native payment:** pass any `msg.value`; if it is less than the `amountIn` calculated during the swap, the remainder is charged from WETH (reverts if insufficient). Unused native ETH is refunded.

### Route API → swap

When routing comes from `POST /public/v1/evm/:chain_id/route`, convert the JSON response into swap params without re-quoting. Request `maxRoutes: 1` for single-path execution (split routes are rejected by the SDK mappers).

```typescript
import {
  prepareExactInputFromRoute,
  prepareExactOutputFromRoute,
  encodeExactInputSingleCalldata,
  encodeExactInputCalldata,
  encodeExactOutputSingleCalldata,
  encodeExactOutputCalldata,
} from "@metric.xyz/metric-omm-sdk-v1";

const route = await fetch(`${routeApiBase}/public/v1/evm/${chainId}/route`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tokenIn,
    tokenOut,
    amountIn: amountIn.toString(),
    maxRoutes: 1,
  }),
}).then((r) => r.json());

const prepared =
  route.tradeType === "exact_out"
    ? await prepareExactOutputFromRoute({
        publicClient,
        route,
        recipient: account,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
        slippagePercent: 0.5,
      })
    : await prepareExactInputFromRoute({
        publicClient,
        route,
        recipient: account,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
        slippagePercent: 0.5,
      });

const data =
  prepared.kind === "single"
    ? route.tradeType === "exact_out"
      ? encodeExactOutputSingleCalldata(prepared.params)
      : encodeExactInputSingleCalldata(prepared.params)
    : route.tradeType === "exact_out"
      ? encodeExactOutputCalldata(prepared.params)
      : encodeExactInputCalldata(prepared.params);

await walletClient.sendTransaction({ to: addresses.simpleRouter, data, account });
```

Pair with `prepareExactInputSingleSupportingNativePaymentCalldata` and set `msg.value` when `tokenIn` is native ETH (route `tokenIn` should be wrapped native).

## Quotes (SwapQuoter)

Live quotes simulate the quoter contract (eth_call). Pass `quoterAddress` with the deployed **MetricOmmSwapQuoter** address.

```typescript
import { quoteLiveExactInSingle, quoteLiveExactIn } from "@metric.xyz/metric-omm-sdk-v1";

const single = await quoteLiveExactInSingle({
  publicClient,
  pool: poolAddress,
  tokenIn,
  tokenOut,
  recipient: account,
  amountIn,
  quoterAddress,
});

const path = await quoteLiveExactIn({
  publicClient,
  tokenIn,
  tokenOut,
  pools: [poolA, poolB],
  recipient: account,
  amountIn,
  quoterAddress,
});
```

Hypothetical quotes: `quoteHypotheticalExactInputSingle`, `quoteHypotheticalExactInput`, and exact-output variants with per-pool bid, ask, and reference prices.

## Liquidity (LiquidityAdder)

- **Add (EOA):** approve **LiquidityAdder** (`addresses.liquidityAdder`), then `addLiquidityExactShares` / `addLiquidityWeighted` on the adder (see `encodeAddLiquidity*` helpers). Both paths accept optional `binPositionBounds`; omitted bounds are unconstrained.
- **Remove:** `removeLiquidity` on the pool — build deltas with `buildModifyLiquidityArgsForRemoval` / `encodeRemoveLiquidityCalldata`. There is no native-ETH remove path.

### Native ETH (add only)

Same multicall pattern as SimpleRouter: `prepareAddLiquidity*SupportingNativePaymentCalldata` wraps `[addLiquidity…, refundETH]`. Set `msg.value` for the WETH pool leg; unused ETH is refunded.

```typescript
import {
  prepareAddLiquidityExactSharesSelfSupportingNativePaymentCalldata,
  getAddressesOrThrow,
  ChainId,
} from "@metric.xyz/metric-omm-sdk-v1";

const { liquidityAdder } = getAddressesOrThrow(ChainId.ETHEREUM);

const data = prepareAddLiquidityExactSharesSelfSupportingNativePaymentCalldata({
  pool,
  salt,
  deltas,
  maxAmountToken0,
  maxAmountToken1,
});

await walletClient.sendTransaction({
  to: liquidityAdder,
  data,
  value: ethAmount,
  account,
});
```

Weighted adds: `prepareAddLiquidityWeightedSelfSupportingNativePaymentCalldata` / `prepareAddLiquidityWeightedWithOwnerSupportingNativePaymentCalldata`.

## Extensions

Pools support up to seven **extensions** (periphery contracts) configured at creation via `extensions`, `extensionOrders`, and `extensionInitData`. Swap and liquidity encoders forward optional **`extensionData`** (defaults to `0x`).

See extension admin encoders (`encodeSetAllowedToDepositCalldata`, `encodeSetAllowedToSwapCalldata`, …) and [HOW_TO.md](../metric-omm-sdk/HOW_TO.md) for pool-creation examples.

### Oracle stop-loss status

For pools with **OracleValueStopLossExtension**, check whether any non-empty bin is currently halt-breached and when decay may clear it:

```typescript
import {
  getAddressesOrThrow,
  ChainId,
  getOracleStopLossAnyBinStatus,
} from "@metric.xyz/metric-omm-sdk-v1";

const addresses = getAddressesOrThrow(ChainId.ETHEREUM);

// bid/ask must match the pool oracle at this block (e.g. from the pool price provider).
const status = await getOracleStopLossAnyBinStatus({
  publicClient,
  extension: addresses.oracleValueStopLossExtension,
  dataProvider: addresses.dataProvider,
  pool: poolAddress,
  bidPriceX64,
  askPriceX64,
});

status.isAnyBinStopLossBreached; // true if any evaluated bin blocks at least one direction
status.breachedBins; // per-bin metrics, thresholds, blocksZeroForOne / blocksOneForZero
status.secondsUntilZeroForOneResumes; // max decay seconds for token0 breaches; null if never via decay
status.secondsUntilOneForZeroResumes;
```

`isAnyBinStopLossBreached` means at least one bin in the pool range is breached — not that every swap is halted. On-chain stop-loss only checks bins on the swap path; use per-bin direction flags (or a quote/simulate) for a specific trade. Offline: `evaluateOracleStopLoss` with balances and watermarks you already have.

## Oracle registration

For providers-oracle price feeds, register pools before attributed reads:

```typescript
import { getPoolOracleStatus, registerPool } from "@metric.xyz/metric-omm-sdk-v1";

const status = await getPoolOracleStatus(publicClient, oracleAddress, feedId, poolAddress);
await registerPool({ publicClient, walletClient, oracleAddress, feedId, pool: poolAddress, factory, account });
```

## Pool reads

```typescript
import { getPoolImmutables, getPoolState, getSlot0, getAddressesOrThrow, ChainId } from "@metric.xyz/metric-omm-sdk-v1";

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
  MetricOmmSimpleRouterAbi,
  MetricOmmSwapQuoterAbi,
  MetricOmmPoolLiquidityAdderAbi,
  DepositAllowlistExtensionAbi,
  SwapAllowlistExtensionAbi,
  PriceVelocityGuardExtensionAbi,
  OracleValueStopLossExtensionAbi,
  OracleProviderAbi,
} from "@metric.xyz/metric-omm-sdk-v1/abis";
```

Regenerate from pinned contracts:

```bash
npm run setup:contracts    # init submodules, hardhat build, sync ABIs
```

## Development

```bash
npm run build              # tsc only (default prepare)
npm run setup:contracts    # refresh ABIs from pinned git deps (maintainers)
npm test                   # Hardhat tests (needs matching @metric/* in node_modules)
npm run verify             # lint, format, typecheck, test — publish gate
```

```bash
cd v1
npm ci
npm run setup:contracts
npm test
```
