# @nradko/metric-omm-sdk-v1

TypeScript SDK for **v1** Metric OMM contracts: **SimpleRouter**, **SwapQuoter**, **LiquidityAdder**, pool `addLiquidity` / `removeLiquidity`, **extensions**, and factory-backed reads.

Pinned **metric-periphery** `dccbda7970da36d55a86108e3dbcce1e794c9634` (core via periphery `lib/metric-core`).

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
| MetricOmmPoolFactory | `0x567C7205107257650dC73a73d87b879a45F5b6F6` |
| MetricOmmPoolDeployer | `0xBe34D0cEb6CF1acbf55dEf35E4dC3e17BDfb6AE4` |
| MetricOmmPoolLiquidityAdder | `0x323B95ABcE8b3025829980bb19d1Fd819808FCB2` |
| MetricOmmPoolDataProvider | `0x5A100da447833D94b8e50AeD1916D7488D15D3fc` |
| MetricOmmSimpleRouter | `0x18f85056444452E718cD680A08f219B2347FE672` |
| DepositAllowlistExtension | `0x088B0CCBdb17531132173a30428f66c1d5A73794` |
| SwapAllowlistExtension | `0x952D844e166E6FAaF73a5e56F0fB0C54543a0f69` |
| OracleValueStopLossExtension | `0x9694959a452283d86eBF4EF4eB5651dEAa1eCec1` |
| PriceVelocityGuardExtension | `0xa53E5db6c18Ce258b3090F1470c5fE7f2e0215Fc` |
| WETH (Ethereum) | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| WETH (Base) | `0x4200000000000000000000000000000000000006` |

`addresses.quoter` is a zero placeholder until a public SwapQuoter deployment is wired in this SDK release. Pass `quoterAddress` to quote helpers or set the bundled address when available.

`MetricOmmPoolDataProvider` is the deployed lens: pool reads (`slot0`, `binStates`, `positionBinShares`, …). Pass `addresses.dataProvider` to read helpers and liquidity builders (`dataProviderAddress` param).

```typescript
import { getAddressesOrThrow, ChainId, isChainSupported } from "@nradko/metric-omm-sdk-v1";

const a = getAddressesOrThrow(ChainId.ETHEREUM);
// getAddressesOrThrow(ChainId.BASE) — same protocol addresses as Ethereum
// isChainSupported(ChainId.ARBITRUM) === false — use DeployedChainId / getSupportedChainIds()
```

ChainId lists future chain IDs for typing; **Ethereum mainnet and Base** have entries in ADDRESSES for this release.

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
  quoterAddress, // required until addresses.quoter is set
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

## Quotes (SwapQuoter)

Live quotes simulate the quoter contract (eth_call). Pass `quoterAddress` when `addresses.quoter` is unset.

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

## Liquidity

- **Add (EOA):** approve **LiquidityAdder**, then `addLiquidityExactShares` / `addLiquidityWeighted` on the adder (see `encodeAddLiquidity*` helpers).
- **Remove:** `removeLiquidity` on the pool — build deltas with `buildModifyLiquidityArgsForRemoval` / `encodeRemoveLiquidityCalldata`.

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

Fork tests: set `ETHEREUM_RPC_URL` (optional `ETHEREUM_FORK_BLOCK_NUMBER`).
