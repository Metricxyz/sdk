/**
 * MetricAMM SDK — v1 deployed addresses.
 *
 * All configured chains share the same protocol deployment addresses (CREATE2/CREATE3).
 * Pool state reads (slot0, bins, position shares) and
 * depth/quote views use dataProvider (MetricOmmPoolDataProvider — the single
 * deployed lens per factory).
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
  ROBINHOOD: 4663,
} as const;

export type ChainId = (typeof ChainId)[keyof typeof ChainId];

/** Chains that have entries in ADDRESSES for this SDK release. */
export type DeployedChainId =
  | typeof ChainId.ETHEREUM
  | typeof ChainId.BASE
  | typeof ChainId.ARBITRUM
  | typeof ChainId.AVALANCHE
  | typeof ChainId.BNB
  | typeof ChainId.POLYGON
  | typeof ChainId.MEGAETH
  | typeof ChainId.HYPEREVM
  | typeof ChainId.MONAD
  | typeof ChainId.ROBINHOOD;

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
  /** MetricOmmSimpleRouter (single- and multi-hop swaps). */
  simpleRouter: Address;
  /** ExternalSwapExecutor bound to simpleRouter (external swaps and fallbacks). */
  externalSwapExecutor: Address;
  /** MetricOmmSwapQuoter (live pool quotes via revert callback). */
  quoter: Address;
  /** Wrapped native token for this chain. */
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

/** Shared deterministic protocol deployment (CREATE2 and CREATE3). */
const PROTOCOL_ADDRESSES = {
  factory: "0x2a53833cc95548cf52c7b159110e22D3a9018f32",
  poolDeployer: "0x2E0A99A2E352043d1CA489cF45bf7B511BCcC738",
  liquidityAdder: "0x06Cb6C245Cd9219262442A7730D9484B3CfdD901",
  dataProvider: "0x83d66c5934b1525ee82e6E772c76c7acC778bBB7",
  simpleRouter: "0x02201E6f13c41506c7Bb635d7543F98826229aB7",
  externalSwapExecutor: "0x578C80DeC5D4Aa1F2879985e6e8d91Fc268e4AC2",
  quoter: "0x803Dd787ef9734c34696877ca6F20194fBcBFbF8",
  extensions: {
    depositAllowlistExtension: "0x65FBa4Ee8f50772aB384f19e5520DdA420B1B47D",
    swapAllowlistExtension: "0x4Ca8d78873f0a66445CC05f9A1E705f1a58A6582",
    oracleValueStopLossExtension: "0xE4038fA09f0bB9963068afaF97BE0c045155090D",
    priceVelocityGuardExtension: "0xEbc53e61078976118E384f110c262A263decB84B",
  },
} as const satisfies Omit<ChainAddresses, "wrappedNative">;

/** Same protocol addresses on each chain below. */
export const ADDRESSES: Record<DeployedChainId, ChainAddresses> = {
  [ChainId.ETHEREUM]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  [ChainId.BASE]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0x4200000000000000000000000000000000000006",
  },
  [ChainId.ARBITRUM]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  },
  [ChainId.AVALANCHE]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  },
  [ChainId.BNB]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  },
  [ChainId.POLYGON]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  },
  [ChainId.MEGAETH]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0x4200000000000000000000000000000000000006",
  },
  [ChainId.ROBINHOOD]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  },
  [ChainId.HYPEREVM]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0x5555555555555555555555555555555555555555",
  },
  [ChainId.MONAD]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  },
} as const;

// ============ Helper Functions ============

const DEPLOYED_CHAIN_IDS: readonly DeployedChainId[] = [
  ChainId.ETHEREUM,
  ChainId.BASE,
  ChainId.ARBITRUM,
  ChainId.AVALANCHE,
  ChainId.BNB,
  ChainId.POLYGON,
  ChainId.MEGAETH,
  ChainId.HYPEREVM,
  ChainId.MONAD,
  ChainId.ROBINHOOD,
];

export function getAddresses(chainId: number): ChainAddresses | undefined {
  return isChainSupported(chainId) ? ADDRESSES[chainId] : undefined;
}

export function getAddressesOrThrow(chainId: number): ChainAddresses {
  const addresses = getAddresses(chainId);
  if (!addresses) {
    throw new Error(`Chain ${chainId} has no v1 deployment in this SDK`);
  }
  return addresses;
}

export function isChainSupported(chainId: number): chainId is DeployedChainId {
  return DEPLOYED_CHAIN_IDS.includes(chainId as DeployedChainId);
}

export function getSupportedChainIds(): DeployedChainId[] {
  return [...DEPLOYED_CHAIN_IDS];
}

export function isChainDeployed(chainId: number): boolean {
  const addresses = getAddresses(chainId);
  if (!addresses) return false;
  return addresses.factory !== "0x0000000000000000000000000000000000000000";
}
