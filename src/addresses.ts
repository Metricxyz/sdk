/**
 * MetricAMM SDK — v1 deployed addresses.
 *
 * All configured chains share the same protocol deployment addresses (CREATE2).
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

/** Shared CREATE2 protocol deployment. */
const PROTOCOL_ADDRESSES = {
  factory: "0xA32761549A1DE40060c194C86A8df24f0A29bA2d",
  poolDeployer: "0x8b25C2c3Dc0C3A9DC1272FbBC09E064015097A5B",
  liquidityAdder: "0x6cd70697cca0586e80907cddC6e9304f910229DD",
  dataProvider: "0x95ab07bCef6463712213D0845962FF4293E5acf7",
  simpleRouter: "0x7D4fb51164288D2e1fdA2032D887517F71008b89",
  quoter: "0x45e72641A71A7eCcccF2Ef905e4159951cdeF8e0",
  extensions: {
    depositAllowlistExtension: "0x180c94f108dBa243FB74819fD1cC490dd82a2A2e",
    swapAllowlistExtension: "0xe9c6C1f3b5a1994A7B66c844348b67086d33533b",
    oracleValueStopLossExtension: "0x022B57C96a337b12eAAB1b39AF9E8a07dE23eE67",
    priceVelocityGuardExtension: "0x5e971600f5f7e9972631960CCF1F57AF53B5fE95",
  },
} as const satisfies Omit<ChainAddresses, "wrappedNative">;

/** Periphery deployment — CREATE2, same protocol addresses on each chain below. */
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
