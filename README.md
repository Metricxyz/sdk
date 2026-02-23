# @nradko/metric-omm-sdk

TypeScript SDK for interacting with Metric OMM AMM contracts using [viem](https://viem.sh/).

## Installation

```bash
npm install @nradko/metric-omm-sdk viem
```

## Supported Chains

| Chain    | Chain ID | Status      |
| -------- | -------- | ----------- |
| Ethereum | 1        | ✅ Deployed |
| Base     | 8453     | ✅ Deployed |
| Arbitrum | 42161    | ✅ Deployed |

## Quick Start

```typescript
import {
  getSlot0,
  getAddressesOrThrow,
  ChainId,
  ADDRESSES,
} from "@nradko/metric-omm-sdk";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// Get deployed addresses for Ethereum
const addresses = ADDRESSES[ChainId.ETHEREUM];

// Read pool state via StateView (recommended)
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

## Features

- ✅ Multi-chain support (Ethereum, Base, Arbitrum)
- ✅ Pool creation and state reading
- ✅ MetricOmmPoolStateView integration for efficient off-chain reads
- ✅ Liquidity position management (add, remove, modify)
- ✅ Uniform and custom liquidity distribution calculations
- ✅ Swap Router with exact input/output and native ETH support
- ✅ Bin data packing utilities
- ✅ Price conversion helpers (Q64 format)
- ✅ Pre-bundled contract ABIs with full TypeScript inference
- ✅ Deterministic cross-chain addresses via CREATE2

## API Reference

### Address Helpers

- `ADDRESSES` - Record of all deployed addresses by chain ID
- `ChainId` - Enum of supported chain IDs
- `getAddresses(chainId)` - Get addresses for a chain (returns `undefined` if unsupported)
- `getAddressesOrThrow(chainId)` - Get addresses or throw if unsupported
- `isChainSupported(chainId)` - Check if a chain is supported
- `isChainDeployed(chainId)` - Check if contracts are deployed on a chain

### Pool Functions

- `createPool(walletClient, publicClient, params)` - Create a new pool
- `prepareFactoryCreatePoolParams(params)` - Prepare factory create pool parameters
- `preparePoolBinData(params)` - Prepare bin data for pool creation
- `prepareCreatePoolCalldata(params)` - Encode create pool calldata
- `getPoolImmutables(client, poolAddress)` - Get pool immutable parameters
- `getPoolState(client, poolAddress)` - Get current pool state
- `getBinState(client, poolAddress, binIdx)` - Get state of a specific bin
- `getPositionBinShares(client, poolAddress, posKey)` - Get position bin shares
- `calculateUniformLiquidityDistribution(...)` - Calculate uniform liquidity distribution
- `calculateAnyLiquidityDistribution(...)` - Calculate custom liquidity distribution

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

### Position Functions

- `modifyLiquidity(walletClient, publicClient, params)` - Add or modify liquidity
- `prepareModifyLiquidityCalldata(params)` - Encode modify liquidity calldata
- `getPositionShares(client, poolAddress, owner, salt, bins)` - Get position shares
- `prepareRemoveLiquidityDeltas(client, poolAddress, owner, salt, bins)` - Prepare removal deltas
- `removeLiquidity(walletClient, publicClient, params)` - Remove liquidity from a pool
- `prepareRemoveLiquidityCalldata(params)` - Encode remove liquidity calldata
- `NO_SLIPPAGE_LIMIT` - Constant for no slippage limit

### Router Functions

- `swapExactInput(walletClient, publicClient, params)` - Swap with exact input amount
- `swapExactOutput(walletClient, publicClient, params)` - Swap with exact output amount
- `swapExactInputNativeForTokens(walletClient, publicClient, params)` - Swap native ETH for tokens
- `prepareSwapExactInputCalldata(params)` - Encode exact input swap calldata
- `prepareSwapExactOutputCalldata(params)` - Encode exact output swap calldata
- `prepareSwapExactInputNativeForTokensCalldata(params)` - Encode native swap calldata

### Utility Functions

- `priceToQ64(price)` - Convert decimal price to Q64 fixed-point format
- `q64ToPrice(q64)` - Convert Q64 fixed-point to decimal price
- `packBinData(binData)` - Pack a single bin data struct
- `packBins5(bins)` - Pack up to 5 bins into a single slot
- `packBinDataArray(bins)` - Pack an array of bin data
- `unpackBinData(packed)` - Unpack bin data from packed format
- `createBins(params)` - Create bin data array
- `createUniformBins(count, weight, ...)` - Create uniform bin distribution

### ABIs

ABIs are available as typed constants for direct use with viem:

```typescript
import {
  MetricOmmPoolAbi,
  MetricOmmPoolFactoryAbi,
  MetricOmmPoolStateViewAbi,
  MetricOmmSwapRouterAbi,
} from "@nradko/metric-omm-sdk/abis";
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

After install, `postinstall` runs automatically and compiles contracts and extracts ABIs.

To regenerate ABIs manually:

```bash
npm run sync:abis
```

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

## License

MIT
