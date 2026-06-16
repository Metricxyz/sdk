# @nradko/metric-omm-sdk-v1

TypeScript SDK for **v1** Metric OMM contracts: **Swapper**, **LiquidityAdder**, pool `addLiquidity` / `removeLiquidity`, **extensions**, and factory-backed reads.

Pinned **metric-periphery** `cc8fef9781fba405cfd1945fe6bf49a00da132bb` (core via periphery `lib/metric-core`).

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
| MetricOmmPoolFactory | `0x175851292f22621F337D76fE5445e9372fb06f9C` |
| MetricOmmPoolDeployer | `0x1C0502457231fF2BE9af4468115B33c112A580eF` |
| MetricOmmPoolLiquidityAdder | `0x7A2C0A39A48c526F1Cae4d67cb0e7aE883A7B623` |
| MetricOmmPoolDataProvider | `0xD0C4df72910Fd70C89CBa5f0FE0ef45638D12775` |
| MetricOmmPoolStateView | `0xb40F8B0cfBB6a01c3232c6D063B1F87d1C0bE40f` |
| MetricOmmSimpleRouter | `0x818a948B25f32F41547a7B9175cB174d2B1e6AD7` |
| MetricOmmPoolSwapper | `0x3B8F17A4cb4f91805338f4b6c2f2aAf94243587e` |
| DepositAllowlistExtension | `0xa56f616c1C8108750b8a5BF387a34C757B8Bdc2c` |
| SwapAllowlistExtension | `0x1aee646900bE4aa1D0A7Ec6c98483923E1aBf481` |
| OracleValueStopLossExtension | `0x3CB3EdCce50Bdc95e746F6e7C23fd61d439fA02a` |
| PriceVelocityGuardExtension | `0x65D5C490fF5Df1861D966A671dB43a8d0c22b9C4` |
| WETH (Ethereum) | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| WETH (Base) | `0x4200000000000000000000000000000000000006` |

`MetricOmmPoolDataProvider` is the deployed lens: pool reads (`slot0`, `binStates`, `positionBinShares`, …) plus swap depth and revert-based quotes. Pass `addresses.dataProvider` to read helpers and liquidity builders (`dataProviderAddress` param).

```typescript
import { getAddressesOrThrow, ChainId, isChainSupported } from "@nradko/metric-omm-sdk-v1";

const a = getAddressesOrThrow(ChainId.ETHEREUM);
// getAddressesOrThrow(ChainId.BASE) — same protocol addresses as Ethereum
// isChainSupported(ChainId.ARBITRUM) === false — use DeployedChainId / getSupportedChainIds()
```

ChainId lists future chain IDs for typing; **Ethereum mainnet and Base** have entries in ADDRESSES for this release. Use getSupportedChainIds(), isChainSupported(), or DeployedChainId when you need compile-time guarantees.

## Swaps (Swapper)

```typescript
import {
  buildArgsAndExpectedAmountsForSwapExactInput,
  getAddressesOrThrow,
  ChainId,
} from "@nradko/metric-omm-sdk-v1";
import { MetricOmmPoolSwapperAbi } from "@nradko/metric-omm-sdk-v1/abis";

const addresses = getAddressesOrThrow(ChainId.ETHEREUM);

const { args, expectedInput, expectedOutput } =
  await buildArgsAndExpectedAmountsForSwapExactInput({
    publicClient,
    factoryAddress: addresses.factory,
    swapperAddress: addresses.swapper,
    pool: poolAddress,
    recipient: account,
    zeroForOne: true,
    amountIn: 1_000_000_000_000_000_000n,
    slippagePercent: 0.5,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
    // extensionData: "0x", // optional; defaults to empty
  });

await walletClient.writeContract({
  address: addresses.swapper,
  abi: MetricOmmPoolSwapperAbi,
  functionName: "swapExactInput",
  args,
  account,
});
```

Quote without building tx args: `quoteSwap` (read-only pool quote), `quoteExpectedAmountsForSwapExactInput` / `quoteExpectedAmountsForSwapExactOutput` (Swapper-aligned estimates for slippage math).

## Liquidity

- **Add (EOA):** approve **LiquidityAdder**, then `addLiquidityExactShares` / `addLiquidityWeighted` on the adder (see `encodeAddLiquidity*` helpers).
- **Remove:** `removeLiquidity` on the pool — build deltas with `buildModifyLiquidityArgsForRemoval` / `encodeRemoveLiquidityCalldata`.

`addLiquidityWeighted` encoders accept optional bin-position bounds (`minimalCurBin`, `minimalPosition`, `maximalCurBin`, `maximalPosition`); defaults disable bounds.

SDK builders still use internal names like `buildModifyLiquidityArgsForUniformAddition` where the math is shared; encoders target v1 pool/adder ABIs.

## Extensions

Pools support up to seven **extensions** (periphery contracts) configured at creation via `extensions`, `extensionOrders`, and `extensionInitData`. Swap and liquidity encoders forward optional **`extensionData`** (defaults to `0x`).

### Pool creation with extensions

```typescript
import {
  encodeCreatePoolCalldata,
  buildExtensionOrders,
  encodeOracleStopLossInitData,
  EMPTY_EXTENSION_INIT_DATA,
} from "@nradko/metric-omm-sdk-v1";

const calldata = encodeCreatePoolCalldata({
  token0,
  token1,
  priceProvider,
  admin,
  adminFeeDestination,
  adminSpreadFeeE6: 5000,
  adminNotionalFeeE8: 0,
  curBinDistFromProvidedPricePercent: 0,
  initialScaledToken0PerShareE18,
  initialScaledToken1PerShareE18,
  minimalMintableLiquidity: 1000n,
  nonNegativeBins,
  negativeBins,
  extensions: [depositAllowlistAddress, swapAllowlistAddress],
  extensionOrders: buildExtensionOrders({
    beforeAddLiquidity: [1],
    beforeSwap: [2],
  }),
  extensionInitData: [
    EMPTY_EXTENSION_INIT_DATA, // DepositAllowlist — no init payload
    EMPTY_EXTENSION_INIT_DATA, // SwapAllowlist — no init payload
  ],
});
```

`encodeExtensionOrder` / `buildExtensionOrders` pack 3-bit extension indices per action (same encoding as on-chain `ExtensionOrders`).

### Initialize data

| Extension | Init encoder |
| --------- | ------------ |
| DepositAllowlist, SwapAllowlist, PriceVelocityGuard | `EMPTY_EXTENSION_INIT_DATA` |
| OracleValueStopLoss | `encodeOracleStopLossInitData({ drawdownE6, decayPerSecondE8, timelockSeconds })` |

### Admin actions (pool admin)

```typescript
import {
  encodeSetAllowedToDepositCalldata,
  encodeSetAllowedToSwapCalldata,
  encodeSetMaxChangePerBlockCalldata,
  encodeProposeOracleStopLossDrawdownCalldata,
} from "@nradko/metric-omm-sdk-v1";

// Allow a depositor on a pool with DepositAllowlistExtension
const data = encodeSetAllowedToDepositCalldata({
  extension: depositAllowlistAddress,
  pool: poolAddress,
  depositor: userAddress,
  allowed: true,
});
```

Also available: swap allowlist setters, price-velocity guard setters, and oracle stop-loss propose / execute / cancel helpers for timelock, drawdown, decay, and high-watermark updates.

**Swap allowlist note:** when users swap via `MetricOmmPoolSwapper`, the extension gates the **Swapper contract address** as the pool swap caller — allow that address, not the end-user EOA.

## Pool reads

```typescript
import { getPoolImmutables, getPoolState, getSlot0, getAddressesOrThrow, ChainId } from "@nradko/metric-omm-sdk-v1";

const addresses = getAddressesOrThrow(ChainId.ETHEREUM);
const imm = await getPoolImmutables(publicClient, addresses.factory, poolAddress);
// imm.extensions (extension1…7), imm.extensionOrders
const state = await getPoolState(publicClient, addresses.dataProvider, poolAddress);
const slot0 = await getSlot0(publicClient, addresses.dataProvider, poolAddress);
```

## ABIs

```typescript
import {
  MetricOmmPoolAbi,
  MetricOmmPoolDataProviderAbi,
  MetricOmmPoolSwapperAbi,
  MetricOmmPoolLiquidityAdderAbi,
  DepositAllowlistExtensionAbi,
  SwapAllowlistExtensionAbi,
  PriceVelocityGuardExtensionAbi,
  OracleValueStopLossExtensionAbi,
} from "@nradko/metric-omm-sdk-v1/abis";
```

Regenerate from pinned contracts:

```bash
npm run setup:contracts    # init submodules, hardhat build, sync ABIs
```

All pinned contracts are compiled by Hardhat from the pinned `@metric/periphery` git dependency (core via `lib/metric-core`).

## Development

```bash
npm run build              # tsc only (default prepare)
npm run setup:contracts    # refresh ABIs from pinned git deps (maintainers)
npm test                   # Hardhat tests (needs matching @metric/* in node_modules)
```

In the monorepo, run v1 tests with an isolated install:

```bash
cd v1
npm ci
npm run setup:contracts
npm test
```

## Tests

```bash
npm run setup:contracts && npm test
```

Fork tests: set `ETHEREUM_RPC_URL` (optional `ETHEREUM_FORK_BLOCK_NUMBER`).
