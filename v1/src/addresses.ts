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

/** Shared protocol deployment (Ethereum + Base). */
const PROTOCOL_ADDRESSES = {
  factory: "0xf98aD80FE666B9a23075CdF64aF5971802844Fd8",
  poolDeployer: "0xf93e1ea4516E99A4Ee81D4979C8D3C8Ab636e397",
  liquidityAdder: "0xdd615506d83e2d94f30aaf17e846330164ab599e",
  dataProvider: "0x7dc8eD16661A5003D9708B55f768484f9E963AdB",
  simpleRouter: "0xa4d4be6a6b6d9f6532cacfe61fc666ef2f9997ed",
  quoter: "0xfa13b57b570B43c8b9A61ba8D2C1781aB064f617",
  extensions: {
    depositAllowlistExtension: "0xC93BdA96021650DBfCEab6470c5329a0F391C160",
    swapAllowlistExtension: "0x50c58A0bf9711Ae091c3aF5C3eab49544062662e",
    oracleValueStopLossExtension: "0x34822E3D4265a8E42284Ce9807A1a804b7552838",
    priceVelocityGuardExtension: "0x07A5c4821cd84a9A6162a6b1f756aA458B7616E3",
  },
} as const satisfies Omit<ChainAddresses, "wrappedNative">;

/** Periphery deployment — Ethereum mainnet and Base (CREATE2, same protocol addresses). */
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
