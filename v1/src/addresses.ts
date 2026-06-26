/**
 * MetricAMM SDK — v1 deployed addresses.
 *
 * Ethereum mainnet and Base use the same protocol deployment addresses (CREATE2).
 * Pool state reads (slot0, bins, position shares) and depth/quote views use dataProvider
 * (MetricOmmPoolDataProvider — the single deployed lens per factory; includes StateView reads).
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
  liquidityAdder: "0xA49acb20f33e4FB340f41d949fd7E4c48A242579",
  dataProvider: "0x803Cb583c1FbE97e9cA7899bE77cC110A78B8737",
  simpleRouter: "0x146D72ad62957F62ABCC14985aBFCC32a785F996",
  quoter: "0x8A45A0239DE0C8f438392f2E5AFcbee316E64965",
  extensions: {
    depositAllowlistExtension: "0xEd246C7B6963E20aa4fCa4912Af8E2Bff6Ca5f4D",
    swapAllowlistExtension: "0x54BF5ba3c5C6C513722a54771b2F2A609e2e3A75",
    oracleValueStopLossExtension: "0x6063a740034E85d34cC55Bc7069BC7b7cdE888bf",
    priceVelocityGuardExtension: "0xda4c0860d9fa8d254e425d485BD9C09BD2b051F7",
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
