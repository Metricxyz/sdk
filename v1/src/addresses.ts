/**
 * MetricAMM SDK — v1 deployed addresses.
 *
 * Ethereum mainnet and Base use the same protocol deployment addresses (CREATE2).
 * Pool state reads (slot0, bins, position shares) and depth/quote views use dataProvider
 * (MetricOmmPoolDataProvider — the single deployed lens per factory).
 */

import type { Address } from "viem";

// ============ Chain IDs ============

export const ChainId = {
  ETHEREUM: 1,
  BASE: 8453,
  ARBITRUM: 42161,
  AVALANCHE: 43114,
  BNB: 56,
  POLYGON: 137,
  MEGAETH: 4326,
  HYPEREVM: 999,
  MONAD: 143,
} as const;

export type ChainId = (typeof ChainId)[keyof typeof ChainId];

/** Chains that have entries in ADDRESSES for this SDK release. */
export type DeployedChainId = typeof ChainId.ETHEREUM | typeof ChainId.BASE;

// ============ Contract Address Types ============

export interface ChainAddresses {
  /** MetricOmmPoolFactory */
  factory: Address;
  /** MetricOmmPoolDeployer */
  poolDeployer: Address;
  /** MetricOmmPoolLiquidityAdder */
  liquidityAdder: Address;
  /** MetricOmmPoolDataProvider (pool reads, swap depth, revert quotes). */
  dataProvider: Address;
  /** MetricOmmPoolStateView (raw pool storage reads). */
  stateView: Address;
  /** MetricOmmSimpleRouter (single- and multi-hop swaps; not wrapped by SDK yet). */
  simpleRouter: Address;
  /** MetricOmmPoolSwapper */
  swapper: Address;
  /** Wrapped native (WETH on Ethereum / Base) */
  wrappedNative: Address;

  /** Per-pool extensions (configure at pool creation). */
  extensions: {
    depositAllowlistExtension: Address;
    swapAllowlistExtension: Address;
    oracleValueStopLossExtension: Address;
    priceVelocityGuardExtension: Address;
  };
}

// ============ Deployed addresses ============

/** Shared protocol deployment (Ethereum + Base). */
const PROTOCOL_ADDRESSES = {
  factory: "0x175851292f22621F337D76fE5445e9372fb06f9C",
  poolDeployer: "0x1C0502457231fF2BE9af4468115B33c112A580eF",
  liquidityAdder: "0x7A2C0A39A48c526F1Cae4d67cb0e7aE883A7B623",
  dataProvider: "0xD0C4df72910Fd70C89CBa5f0FE0ef45638D12775",
  stateView: "0xb40F8B0cfBB6a01c3232c6D063B1F87d1C0bE40f",
  simpleRouter: "0x818a948B25f32F41547a7B9175cB174d2B1e6AD7",
  swapper: "0x3B8F17A4cb4f91805338f4b6c2f2aAf94243587e",
  extensions: {
    depositAllowlistExtension: "0xa56f616c1C8108750b8a5BF387a34C757B8Bdc2c",
    swapAllowlistExtension: "0x1aee646900bE4aa1D0A7Ec6c98483923E1aBf481",
    oracleValueStopLossExtension: "0x3CB3EdCce50Bdc95e746F6e7C23fd61d439fA02a",
    priceVelocityGuardExtension: "0x65D5C490fF5Df1861D966A671dB43a8d0c22b9C4",
  },
} as const satisfies Omit<ChainAddresses, "wrappedNative">;

/** Extensions-era deployment — Ethereum mainnet and Base (Jun 2026). */
export const ADDRESSES: Record<DeployedChainId, ChainAddresses> = {
  [ChainId.ETHEREUM]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  [ChainId.BASE]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0x4200000000000000000000000000000000000006",
  },
} as const;

// ============ Helper Functions ============

const DEPLOYED_CHAIN_IDS: readonly DeployedChainId[] = [ChainId.ETHEREUM, ChainId.BASE];

export function getAddresses(chainId: number): ChainAddresses | undefined {
  if (chainId === ChainId.ETHEREUM) return ADDRESSES[ChainId.ETHEREUM];
  if (chainId === ChainId.BASE) return ADDRESSES[ChainId.BASE];
  return undefined;
}

export function getAddressesOrThrow(chainId: number): ChainAddresses {
  const addresses = getAddresses(chainId);
  if (!addresses) {
    throw new Error(
      `Chain ${chainId} has no v1 deployment in this SDK (Ethereum and Base are configured)`,
    );
  }
  return addresses;
}

export function isChainSupported(chainId: number): chainId is DeployedChainId {
  return chainId === ChainId.ETHEREUM || chainId === ChainId.BASE;
}

export function getSupportedChainIds(): DeployedChainId[] {
  return [...DEPLOYED_CHAIN_IDS];
}

export function isChainDeployed(chainId: number): boolean {
  const addresses = getAddresses(chainId);
  if (!addresses) return false;
  return addresses.factory !== "0x0000000000000000000000000000000000000000";
}
