# @metric.xyz/metric-omm-sdk-v1

TypeScript SDK for **v1** Metric OMM contracts: **SimpleRouter**, **SwapQuoter**, **LiquidityAdder**, pool `addLiquidity` / `removeLiquidity`, **extensions**, and factory-backed reads.

Pinned **metric-periphery** `f92a958c75c01ebef62a9e749ab037f6b813cf21`
(Metric Core `d4d0e2a3a7d690fdfed9829239e5ec3d8c4c9575` via periphery
`lib/metric-core`).

## Installation

```bash
npm install @metric.xyz/metric-omm-sdk-v1 viem
```

Helpers are exported from the package root:

```typescript
import * as v1 from "@metric.xyz/metric-omm-sdk-v1";
```

## Deployed addresses

Protocol contracts use the **same deterministic addresses** on Ethereum, Base,
Arbitrum, Avalanche, BNB, Polygon, MegaETH, HyperEVM, Monad, and Robinhood.
Deployments use CREATE2 and CREATE3; wrapped native differs per chain.

| Contract | Address |
| -------- | ------- |
| MetricOmmPoolFactory | `0x2a53833cc95548cf52c7b159110e22D3a9018f32` |
| MetricOmmPoolDeployer | `0x2E0A99A2E352043d1CA489cF45bf7B511BCcC738` |
| MetricOmmPoolLiquidityAdder | `0x06Cb6C245Cd9219262442A7730D9484B3CfdD901` |
| MetricOmmPoolDataProvider | `0x83d66c5934b1525ee82e6E772c76c7acC778bBB7` |
| MetricOmmSimpleRouter | `0x3c6c4fC94f1493b9d76C5e4C4CdEdB444D3CC0A2` |
| MetricOmmSwapQuoter | `0x803Dd787ef9734c34696877ca6F20194fBcBFbF8` |
| DepositAllowlistExtension | `0x65FBa4Ee8f50772aB384f19e5520DdA420B1B47D` |
| SwapAllowlistExtension | `0x4Ca8d78873f0a66445CC05f9A1E705f1a58A6582` |
| OracleValueStopLossExtension | `0xE4038fA09f0bB9963068afaF97BE0c045155090D` |
| PriceVelocityGuardExtension | `0xEbc53e61078976118E384f110c262A263decB84B` |
| WETH (Ethereum) | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| WETH (Base / MegaETH) | `0x4200000000000000000000000000000000000006` |
| WETH (Arbitrum) | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |
| WAVAX (Avalanche) | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` |
| WBNB (BNB) | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |
| WMATIC (Polygon) | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` |
| WETH (Robinhood) | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| WHYPE (HyperEVM) | `0x5555555555555555555555555555555555555555` |
| WMON (Monad) | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` |

`MetricOmmPoolDataProvider` is the deployed lens: pool reads (`slot0`, `binStates`, `positionBinShares`, …). Pass `addresses.dataProvider` to read helpers and liquidity builders (`dataProviderAddress` param). There is no separate StateView deployment — use `dataProvider` for all lens reads.

```typescript
import { getAddressesOrThrow, ChainId } from "@metric.xyz/metric-omm-sdk-v1";

const a = getAddressesOrThrow(ChainId.ETHEREUM);
// same protocol addresses on Base, Arbitrum, Avalanche, BNB, Polygon, MegaETH, HyperEVM, Monad, Robinhood
```

Use `isChainSupported` / `getSupportedChainIds` for the ten bundled chains.

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

Hypothetical quotes: `quoteHypotheticalExactInputSingle`, `quoteHypotheticalExactInput`, and exact-output variants with per-pool bid/ask prices.

## Liquidity (LiquidityAdder)

- **Add (EOA):** approve **LiquidityAdder** (`addresses.liquidityAdder`), then `addLiquidityExactShares` / `addLiquidityWeighted` on the adder (see `encodeAddLiquidity*` helpers).
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

See extension admin encoders (`encodeSetAllowedToDepositCalldata`, `encodeSetAllowedToSwapCalldata`, …) and [HOW_TO.md](./HOW_TO.md) for pool-creation examples.

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
npm ci
npm run setup:contracts    # refresh ABIs from pinned git deps (maintainers)
npm test                   # Hardhat tests (needs matching @metric/* in node_modules)
```

```bash
npm run build              # tsc only (default prepare)
npm run typecheck
npm run lint
npm run format:check
npm run verify             # lint, format, typecheck, test — publish gate
```

Contract pins match `versions.env` in the sibling `metric-deploy` checkout. Refresh with `npm run sync:versions:env`.

## Publishing

`prepublishOnly` runs `verify` first.

```bash
npm publish --access public
```
