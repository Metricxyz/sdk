# @nradko/metric-omm-sdk

TypeScript SDK for interacting with Metric OMM AMM contracts using [viem](https://viem.sh/).

## Installation

```bash
npm install @nradko/metric-omm-sdk viem
```

## Quick Start

```typescript
import { getSlot0, ChainId, ADDRESSES } from "@nradko/metric-omm-sdk";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const addresses = ADDRESSES[ChainId.ETHEREUM];
const slot0 = await getSlot0(publicClient, addresses.stateView, poolAddress);
console.log(`Current Bin: ${slot0.curBinIdx}`);
```

## Deployed Contract Addresses

Factory, PoolDeployer, and StateView share the same addresses across all chains (CREATE2). Router addresses differ per chain due to different WETH constructor arguments.

| Contract               | All Chains (CREATE2)                         |
| ---------------------- | -------------------------------------------- |
| MetricOmmPoolFactory   | `0xe22F9fc0f04486dE25ed6CF1800a4a47aFD82e0C` |
| MetricOmmPoolDeployer  | `0x0f732971a3503afee276782173170D1F1154d4c1` |
| MetricOmmPoolStateView | `0xe6b102a2aea65b9b59e4F8B86B38E221886675A8` |

| Chain     | MetricOmmSwapRouter                          |
| --------- | -------------------------------------------- |
| Ethereum  | `0xcB41C10c6414aCbea022c7662df4005dd8FBEF91` |
| Base      | `0xA6A16C00B7E9DBE1D54acEd7d6FE264fc4732eaF` |
| Arbitrum  | `0x82A562fD9F02d4346B95D3a2a501411979C8F920` |
| Avalanche | `0x5C1e08DF74a3457648A4C4dc5DC0DE497284c53C` |
| BNB       | `0xa9a63266bB70eb3419C34C245F4318983f325Bbd` |
| Polygon   | `0x976c26402E1EC10454c5Fe6D2C9857DD57aE78f3` |
| MegaETH   | `0xA6A16C00B7E9DBE1D54acEd7d6FE264fc4732eaF` |

All addresses are available programmatically:

```typescript
import {
  ADDRESSES,
  ChainId,
  getAddressesOrThrow,
} from "@nradko/metric-omm-sdk";

const ethAddresses = ADDRESSES[ChainId.ETHEREUM];
const arbAddresses = getAddressesOrThrow(42161);
```

### ABIs

ABIs are available as typed constants for direct use:

```typescript
import {
  MetricOmmPoolAbi,
  MetricOmmSwapRouterAbi,
} from "@nradko/metric-omm-sdk/abis";
```

## Usage

The SDK is args-first. You build typed tuple args with a `buildArgs...` helper, then send the transaction yourself via `walletClient.writeContract`.

### Liquidity

Build `ModifyLiquidityArgs` with the strategy you want (uniform addition, custom addition, percentage removal, or custom removal), then call pool `modifyLiquidity` with those args.

Available builders:

- `buildModifyLiquidityArgsForAddition(...)` - custom per-bin addition amounts
- `buildModifyLiquidityArgsForUniformAddition(...)` - uniform addition across a bin range
- `buildModifyLiquidityArgsForRemoval(...)` - remove custom per-bin share amounts/percentages
- `buildModifyLiquidityArgsForPercentageRemoval(...)` - remove a fixed percentage from selected bins/range

```typescript
import {
  buildModifyLiquidityArgsForUniformAddition,
  getAddressesOrThrow,
} from "@nradko/metric-omm-sdk";
import { MetricOmmPoolAbi } from "@nradko/metric-omm-sdk/abis";

const addresses = getAddressesOrThrow(1);

const modifyLiquidityArgs = await buildModifyLiquidityArgsForUniformAddition({
  publicClient,
  stateViewAddress: addresses.stateView,
  poolAddress,
  amountInTokensPerBin: 1_000_000n,
  amountIsInToken0: true,
  currentPrice: 3000,
  lowerBin: -5,
  upperBin: 5,
  salt: 0n,
});

const hash = await walletClient.writeContract({
  address: poolAddress,
  abi: MetricOmmPoolAbi,
  functionName: "modifyLiquidity",
  args: modifyLiquidityArgs,
  account,
});
```

### Swaps

Build swap args first, then call the router function directly.

Available Args builders:

- `buildArgsForSwapExactInput(...)`
- `buildArgsForSwapExactOutput(...)`

Additionally, these builders return args plus expected input/output amounts:

- `buildArgsAndExpectedAmountsForSwapExactInput(...)`
- `buildArgsAndExpectedAmountsForSwapExactOutput(...)`

Quote-only helpers (no `recipient`/`deadline` required):

- `quoteExpectedAmountsForSwapExactInput(...)`
- `quoteExpectedAmountsForSwapExactOutput(...)`

All swap build/quote helpers accept optional `prices: { bidPriceX64, askPriceX64 }`. If provided, the SDK uses them directly and skips reading from the pool price provider.

```typescript
import {
  buildArgsAndExpectedAmountsForSwapExactInput,
  getAddressesOrThrow,
} from "@nradko/metric-omm-sdk";
import { MetricOmmSwapRouterAbi } from "@nradko/metric-omm-sdk/abis";

const addresses = getAddressesOrThrow(1);

const result = await buildArgsAndExpectedAmountsForSwapExactInput({
  publicClient,
  routerAddress: addresses.router,
  pool: poolAddress,
  recipient: account,
  zeroForOne: true,
  amountIn: 1_000_000_000_000_000_000n,
  slippagePercent: 0.5,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
});

const expectedInput = result.expectedInput;
const expectedOutput = result.expectedOutput;
const args = result.args;

const hash = await walletClient.writeContract({
  address: addresses.router,
  abi: MetricOmmSwapRouterAbi,
  functionName: "swapExactInput",
  args,
  account,
});
```

## Development

### Prerequisites

This SDK depends on `@metric/core` and `@metric/periphery` from private GitHub repositories.

Make sure your machine has SSH access to:

- `git@github.com:Metric-OMM/metric-core.git`
- `git@github.com:Metric-OMM/metric-periphery.git`

Dependencies are pinned to exact commit SHAs in `package.json`.

### Setup

```bash
npm install
```

This repo uses a native Git hook (no Husky) for pre-commit checks. If needed, you can set it manually:

```bash
npm run setup:hooks
```

After install, `postinstall` runs automatically and compiles contracts and extracts ABIs.

To regenerate ABIs manually:

```bash
npm run sync:abis
```

### Running Tests

```bash
npm test
```

Commits are blocked unless `bunx hardhat test` succeeds.

### Building

```bash
npm run build
```

## API Reference

### Address Helpers

- `ADDRESSES` - Record of all deployed addresses by chain ID
- `ChainId` - Enum of supported chain IDs
- `getAddresses(chainId)` - Get addresses for a chain (returns `undefined` if unsupported)
- `getAddressesOrThrow(chainId)` - Get addresses or throw if unsupported
- `isChainSupported(chainId)` - Check if a chain is supported
- `isChainDeployed(chainId)` - Check if contracts are deployed on a chain

### Pool Functions

- `preparePoolBinData(params)` - Prepare legacy uniform bin arrays for pool creation
- `prepareFactoryCreatePoolParams(params)` - Build factory-ready pool params struct
- `encodeCreatePoolCalldata(params)` - Encode create-pool calldata from `CreatePoolFactoryParams`
- `createPool(publicClient, walletClient, factoryAddress, params, account)` - Simulate and send pool creation transaction
- `getPoolImmutables(client, poolAddress)` - Get pool immutable parameters
- `getPoolState(client, poolAddress)` - Get current pool state
- `getBinState(client, poolAddress, binIdx)` - Get state of a specific bin
- `getPositionBinShares(client, poolAddress, posKey)` - Get position bin shares

### Liquidity Functions

- `buildModifyLiquidityArgsForAddition(...)` - Build `ModifyLiquidityArgs` for custom addition
- `buildModifyLiquidityArgsForUniformAddition(...)` - Build `ModifyLiquidityArgs` for uniform addition
- `buildModifyLiquidityArgsForPercentageRemoval(...)` - Build `ModifyLiquidityArgs` for percentage removal
- `buildModifyLiquidityArgsForRemoval(...)` - Build `ModifyLiquidityArgs` for custom removal
- `encodeModifyLiquidityCalldata(modifyLiquidityArgs)` - Encode `modifyLiquidity` calldata
- `getPositionShares(client, stateViewAddress, poolAddress, owner, salt, lowerBin?, upperBin?)` - Get position shares in a bin range
- `getPositionSharesForBins(client, stateViewAddress, poolAddress, owner, salt, bins)` - Get position shares for explicit bins
- `NO_SLIPPAGE_LIMIT` - Constant for no slippage limit

### StateView Functions (Recommended for reads)

- `getSlot0(client, stateViewAddress, poolAddress)` - Get slot0 data (bin index, position, drift, fees)
- `getSlot1(client, stateViewAddress, poolAddress)` - Get bin totals
- `getBinStateExternal(client, stateViewAddress, poolAddress, binIdx)` - Read a single bin
- `getBinStatesExternal(client, stateViewAddress, poolAddress, binIndices)` - Batch read bins
- `getBinStatesScaled(client, stateViewAddress, poolAddress, binIndices)` - Batch read bins (scaled)
- `getBinTotalShares(client, stateViewAddress, poolAddress, binIdx)` - Get bin total shares
- `getPositionBinSharesFromStateView(...)` - Get position shares via state view
- `toPositionBinKey(...)` - Compute position bin key
- `getPositionBinSharesRange(...)` - Get position shares for a range of bins
- `getFeeConfig(client, stateViewAddress, poolAddress)` - Get fee configuration
- `getPriceProvider(client, stateViewAddress, poolAddress)` - Get price provider address
- `getLastTradeTimestamp(client, stateViewAddress, poolAddress)` - Get last trade timestamp

### Router Functions

- `buildArgsForSwapExactInput(params)` - Build `SwapExactInputArgs` using on-chain quote and slippage
- `buildArgsAndExpectedAmountsForSwapExactInput(params)` - Build exact-input args and return expected input/output amounts
- `quoteExpectedAmountsForSwapExactInput(params)` - Quote expected input/output for exact-input flow without building tx args
- `buildArgsForSwapExactOutput(params)` - Build `SwapExactOutputArgs` using on-chain quote and slippage
- `buildArgsAndExpectedAmountsForSwapExactOutput(params)` - Build exact-output args and return expected input/output amounts
- `quoteExpectedAmountsForSwapExactOutput(params)` - Quote expected input/output for exact-output flow without building tx args
- `prepareSwapExactInputCalldata(argsOrParams)` - Encode exact input swap calldata
- `prepareSwapExactOutputCalldata(argsOrParams)` - Encode exact output swap calldata
- `prepareSwapExactInputNativeForTokensCalldata(params)` - Encode native exact-input swap calldata

### Utility Functions

- `priceToQ64(price)` - Convert decimal price to Q64 fixed-point format
- `q64ToPrice(q64)` - Convert Q64 fixed-point to decimal price
- `packBinData(binData)` - Pack a single bin data struct
- `packBins5(bins)` - Pack up to 5 bins into a single slot
- `packBinDataArray(bins)` - Pack an array of bin data
- `unpackBinData(packed)` - Unpack bin data from packed format
- `createBins(params)` - Create bin data array
- `createUniformBins(count, weight, ...)` - Create uniform bin distribution
