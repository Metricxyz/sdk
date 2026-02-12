# @metric/sdk

TypeScript SDK for interacting with Metric AMM contracts using [viem](https://viem.sh/).

## Installation

```bash
npm install @metric/sdk viem
```

## Quick Start

```typescript
import * as sdk from "@metric/sdk";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// Read pool state
const poolState = await sdk.getPoolState(publicClient, poolAddress);

// Get bin states using StateView (recommended for efficiency)
const slot0 = await sdk.getSlot0(publicClient, stateViewAddress, poolAddress);
console.log(`Current Bin: ${slot0.curBinIdx}`);
```

## Features

- ✅ Pool state reading and management
- ✅ MetricOmmPoolStateView integration for efficient off-chain reads
- ✅ Direct liquidity position management
- ✅ Swap Router with slippage protection
- ✅ Bin data packing utilities
- ✅ Price conversion helpers (Q64 format)
- ✅ TypeScript types for all contract interfaces
- ✅ Pre-bundled contract ABIs with full TypeScript inference

## Development

### Prerequisites

This SDK depends on `@metric/core` and `@metric/periphery` from private GitHub repositories.

Make sure your machine has access to:

- `git@github.com:Metric-OMM/metric-core.git`
- `git@github.com:Metric-OMM/metric-periphery.git`

Dependencies are pinned to exact commit SHAs in [package.json](package.json), so installs are reproducible and do not move with new upstream commits.

Install dependencies with:

```bash
npm install
```

After install, `postinstall` runs automatically and will:

1. compile pinned contracts from `@metric/core` and `@metric/periphery` via Hardhat,
2. extract and update SDK ABIs for:

- `MetricOmmPool`
- `MetricOmmPoolFactory`
- `MetricOmmPoolStateView`
- `MetricOmmSwapRouter`

If you need to regenerate them manually, run:

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

## API Reference

### Pool Functions

- `getPoolImmutables(client, poolAddress)` - Get pool immutable parameters
- `getPoolState(client, poolAddress)` - Get current pool state
- `getBinState(client, poolAddress, binIdx)` - Get state of a specific bin

### StateView Functions (Recommended)

- `getSlot0(client, stateViewAddress, poolAddress)` - Get slot0 data
- `getSlot1(client, stateViewAddress, poolAddress)` - Get performance fee data
- `getBinStatesExternal(client, stateViewAddress, poolAddress, binIndices)` - Batch read bins

### Position Functions

- `getPosition(client, poolAddress, owner, positionId)` - Get position details
- `addLiquidity(...)` - Add liquidity to a pool
- `removeLiquidity(...)` - Remove liquidity from a pool

### Router Functions

- `exactInputSingle(...)` - Swap with exact input amount
- `exactOutputSingle(...)` - Swap with exact output amount

### Utility Functions

- `priceToQ64(price)` - Convert price to Q64 format
- `q64ToPrice(q64)` - Convert Q64 to price
- `createUniformBins(count, weight, ...)` - Create uniform bin distribution

## License

MIT
