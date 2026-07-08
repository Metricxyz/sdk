# @nradko/metric-omm-sdk-v1

TypeScript SDK for **v1** Metric OMM contracts: **SimpleRouter**, **SwapQuoter**, **LiquidityAdder**, pool `addLiquidity` / `removeLiquidity`, **extensions**, and factory-backed reads.

Pinned **metric-periphery** `d210a84daf694c52a591d371ceb9b82cece0f79f` (core via periphery `lib/metric-core`).

## Installation

```bash
npm install @nradko/metric-omm-sdk-v1 viem
```

Or via the combined package:

```typescript
import { v1 } from "@nradko/metric-omm-sdk";
```

## Ethereum mainnet and Base addresses

Protocol contracts use the **same addresses** on Ethereum mainnet and Base (CREATE2). Wrapped native differs per chain (WETH).

| Contract | Address |
| -------- | ------- |
| MetricOmmPoolFactory | `0xf98aD80FE666B9a23075CdF64aF5971802844Fd8` |
| MetricOmmPoolDeployer | `0xf93e1ea4516E99A4Ee81D4979C8D3C8Ab636e397` |
| MetricOmmPoolLiquidityAdder | `0xdd615506d83e2d94f30aaf17e846330164ab599e` |
| MetricOmmPoolDataProvider | `0x7dc8eD16661A5003D9708B55f768484f9E963AdB` |
| MetricOmmSimpleRouter | `0xa4d4be6a6b6d9f6532cacfe61fc666ef2f9997ed` |
| MetricOmmSwapQuoter | `0xfa13b57b570B43c8b9A61ba8D2C1781aB064f617` |
| DepositAllowlistExtension | `0xC93BdA96021650DBfCEab6470c5329a0F391C160` |
| SwapAllowlistExtension | `0x50c58A0bf9711Ae091c3aF5C3eab49544062662e` |
| OracleValueStopLossExtension | `0x34822E3D4265a8E42284Ce9807A1a804b7552838` |
| PriceVelocityGuardExtension | `0x07A5c4821cd84a9A6162a6b1f756aA458B7616E3` |
| WETH (Ethereum) | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| WETH (Base) | `0x4200000000000000000000000000000000000006` |

`MetricOmmPoolDataProvider` is the deployed lens: pool reads (`slot0`, `binStates`, `positionBinShares`, …). Pass `addresses.dataProvider` to read helpers and liquidity builders (`dataProviderAddress` param). There is no separate StateView deployment — use `dataProvider` for all lens reads.

```typescript
import { getAddressesOrThrow, ChainId, isChainSupported } from "@nradko/metric-omm-sdk-v1";

const a = getAddressesOrThrow(ChainId.ETHEREUM);
// getAddressesOrThrow(ChainId.BASE) — same protocol addresses as Ethereum
// isChainSupported(ChainId.ARBITRUM) === false — use DeployedChainId / getSupportedChainIds()
```

`ChainId` lists future chain IDs for typing; **Ethereum mainnet and Base** have entries in `ADDRESSES` for this release.

## Swaps (SimpleRouter)

### Single hop

```typescript
import {
  buildExactInputSingleParams,
  getAddressesOrThrow,
  ChainId,
} from "@nradko/metric-omm-sdk-v1";
import { MetricOmmSimpleRouterAbi } from "@nradko/metric-omm-sdk-v1/abis";

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
import { buildExactInputParams, encodeExactInputCalldata } from "@nradko/metric-omm-sdk-v1";

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
} from "@nradko/metric-omm-sdk-v1";

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
} from "@nradko/metric-omm-sdk-v1";

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
import { quoteLiveExactInSingle, quoteLiveExactIn } from "@nradko/metric-omm-sdk-v1";

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
} from "@nradko/metric-omm-sdk-v1";

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

## Oracle registration

For providers-oracle price feeds, register pools before attributed reads:

```typescript
import { getPoolOracleStatus, registerPool } from "@nradko/metric-omm-sdk-v1";

const status = await getPoolOracleStatus(publicClient, oracleAddress, feedId, poolAddress);
await registerPool({ publicClient, walletClient, oracleAddress, feedId, pool: poolAddress, factory, account });
```

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
  MetricOmmSimpleRouterAbi,
  MetricOmmSwapQuoterAbi,
  MetricOmmPoolLiquidityAdderAbi,
  DepositAllowlistExtensionAbi,
  SwapAllowlistExtensionAbi,
  PriceVelocityGuardExtensionAbi,
  OracleValueStopLossExtensionAbi,
  OracleProviderAbi,
} from "@nradko/metric-omm-sdk-v1/abis";
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
