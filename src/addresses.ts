/**
 * MetricAMM SDK — v1 deployed addresses.
 *
 * Ethereum, Base, Robinhood, and HyperEVM share the same protocol deployment
 * addresses (CREATE2). Pool state reads (slot0, bins, position shares) and
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
  | typeof ChainId.ROBINHOOD
  | typeof ChainId.HYPEREVM;

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

/** Shared protocol deployment (Ethereum, Base, Robinhood, HyperEVM). */
const PROTOCOL_ADDRESSES = {
  factory: "0x622911384e7973439b8be305f5e3Fc3c5736EDe4",
  poolDeployer: "0x47D5C9df5e3419217471A9D12D932Dbed7B0B7f1",
  liquidityAdder: "0x9aA238a8319D20F6D8C3bcca45CA2F5e27C1e00f",
  dataProvider: "0x19f85Eb0a450b429C9a700bE867CF284e7e685eC",
  simpleRouter: "0x292DecA668291262341f92B840830f78dB35b6E5",
  quoter: "0xaB6C48D981B943F62A23bb4EB2db125182E6753c",
  extensions: {
    depositAllowlistExtension: "0x2229c48864d9aC877d23591fE99C3718Ef992F66",
    swapAllowlistExtension: "0xAC6BA2d77279a7B26db57Be6f8bF234932547eEd",
    oracleValueStopLossExtension: "0x7D5D12aa06A025Fa37410F522F166070bA998e11",
    priceVelocityGuardExtension: "0x225c402B55c63d081821aA9260179C0d35e25091",
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
  [ChainId.ROBINHOOD]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  },
  [ChainId.HYPEREVM]: {
    ...PROTOCOL_ADDRESSES,
    wrappedNative: "0x5555555555555555555555555555555555555555",
  },
} as const;

// ============ Helper Functions ============

const DEPLOYED_CHAIN_IDS: readonly DeployedChainId[] = [
  ChainId.ETHEREUM,
  ChainId.BASE,
  ChainId.ROBINHOOD,
  ChainId.HYPEREVM,
];

export function getAddresses(chainId: number): ChainAddresses | undefined {
  if (chainId === ChainId.ETHEREUM) return ADDRESSES[ChainId.ETHEREUM];
  if (chainId === ChainId.BASE) return ADDRESSES[ChainId.BASE];
  if (chainId === ChainId.ROBINHOOD) return ADDRESSES[ChainId.ROBINHOOD];
  if (chainId === ChainId.HYPEREVM) return ADDRESSES[ChainId.HYPEREVM];
  return undefined;
}

export function getAddressesOrThrow(chainId: number): ChainAddresses {
  const addresses = getAddresses(chainId);
  if (!addresses) {
    throw new Error(
      `Chain ${chainId} has no v1 deployment in this SDK (Ethereum, Base, Robinhood, and HyperEVM are configured)`,
    );
  }
  return addresses;
}

export function isChainSupported(chainId: number): chainId is DeployedChainId {
  return (
    chainId === ChainId.ETHEREUM ||
    chainId === ChainId.BASE ||
    chainId === ChainId.ROBINHOOD ||
    chainId === ChainId.HYPEREVM
  );
}

export function getSupportedChainIds(): DeployedChainId[] {
  return [...DEPLOYED_CHAIN_IDS];
}

export function isChainDeployed(chainId: number): boolean {
  const addresses = getAddresses(chainId);
  if (!addresses) return false;
  return addresses.factory !== "0x0000000000000000000000000000000000000000";
}
