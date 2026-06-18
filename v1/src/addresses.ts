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
  /** MetricOmmSimpleRouter (single- and multi-hop ERC-20 swaps). */
  simpleRouter: Address;
  /** MetricOmmSwapQuoter (live pool quotes via revert callback). */
  quoter: Address;
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
  factory: "0x567C7205107257650dC73a73d87b879a45F5b6F6",
  poolDeployer: "0xBe34D0cEb6CF1acbf55dEf35E4dC3e17BDfb6AE4",
  liquidityAdder: "0x323B95ABcE8b3025829980bb19d1Fd819808FCB2",
  dataProvider: "0x5A100da447833D94b8e50AeD1916D7488D15D3fc",
  stateView: "0xb40F8B0cfBB6a01c3232c6D063B1F87d1C0bE40f",
  simpleRouter: "0x18f85056444452E718cD680A08f219B2347FE672",
  quoter: "0x0000000000000000000000000000000000000000",
  extensions: {
    depositAllowlistExtension: "0x088B0CCBdb17531132173a30428f66c1d5A73794",
    swapAllowlistExtension: "0x952D844e166E6FAaF73a5e56F0fB0C54543a0f69",
    oracleValueStopLossExtension: "0x9694959a452283d86eBF4EF4eB5651dEAa1eCec1",
    priceVelocityGuardExtension: "0xa53E5db6c18Ce258b3090F1470c5fE7f2e0215Fc",
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
