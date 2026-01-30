/**
 * MetricAMM SDK Contract Addresses
 *
 * Multi-chain contract address configuration.
 * Each chain has its own set of deployed contract addresses.
 */

import type { Address } from "viem";

// ============ Chain IDs ============

export const ChainId = {
  ETHEREUM: 1,
  SEPOLIA: 11155111,
  BASE: 8453,
  BASE_SEPOLIA: 84532,
} as const;

export type ChainId = (typeof ChainId)[keyof typeof ChainId];

// ============ Contract Address Types ============

export interface ChainAddresses {
  /** MetricOmmPoolFactory address */
  factory: Address;
  /** MetricOmmPoolDeployer address */
  poolDeployer: Address;
  /** MetricOmmSwapRouter address */
  router: Address;
  /** MetricOmmPoolStateView address */
  stateView: Address;
  /** Wrapped native token (WETH, WBASE, etc.) */
  wrappedNative: Address;
}

// ============ Deployed Addresses by Chain ============

export const ADDRESSES: Record<ChainId, ChainAddresses> = {
  [ChainId.ETHEREUM]: {
    factory: "0xB81881Fd95140a6e2a217f7bF1fb67C0e956f472",
    poolDeployer: "0xB590ffcd60f7a8849fC45D57753CcBc62593bEB4",
    router: "0x319E9e73159E8bA80756B1F1438a0c25EF6d1272",
    stateView: "0x185630D63C8F9226914B78174DF7DB9B88993052",
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  },

  [ChainId.SEPOLIA]: {
    factory: "0x0000000000000000000000000000000000000000",
    poolDeployer: "0x0000000000000000000000000000000000000000",
    router: "0x0000000000000000000000000000000000000000",
    stateView: "0x0000000000000000000000000000000000000000",
    wrappedNative: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", // Sepolia WETH
  },

  [ChainId.BASE]: {
    factory: "0x0000000000000000000000000000000000000000",
    poolDeployer: "0x0000000000000000000000000000000000000000",
    router: "0x0000000000000000000000000000000000000000",
    stateView: "0x0000000000000000000000000000000000000000",
    wrappedNative: "0x4200000000000000000000000000000000000006", // Base WETH
  },

  [ChainId.BASE_SEPOLIA]: {
    factory: "0x0000000000000000000000000000000000000000",
    poolDeployer: "0x0000000000000000000000000000000000000000",
    router: "0x0000000000000000000000000000000000000000",
    stateView: "0x0000000000000000000000000000000000000000",
    wrappedNative: "0x4200000000000000000000000000000000000006", // Base Sepolia WETH
  },
} as const;

// ============ Helper Functions ============

/**
 * Get contract addresses for a specific chain
 * @param chainId - The chain ID
 * @returns Chain addresses or undefined if not supported
 */
export function getAddresses(chainId: number): ChainAddresses | undefined {
  return ADDRESSES[chainId as ChainId];
}

/**
 * Get contract addresses for a specific chain, throws if not supported
 * @param chainId - The chain ID
 * @returns Chain addresses
 * @throws Error if chain is not supported
 */
export function getAddressesOrThrow(chainId: number): ChainAddresses {
  const addresses = getAddresses(chainId);
  if (!addresses) {
    throw new Error(`Chain ${chainId} is not supported`);
  }
  return addresses;
}

/**
 * Check if a chain is supported
 * @param chainId - The chain ID
 * @returns True if chain is supported
 */
export function isChainSupported(chainId: number): chainId is ChainId {
  return chainId in ADDRESSES;
}

/**
 * Get all supported chain IDs
 * @returns Array of supported chain IDs
 */
export function getSupportedChainIds(): ChainId[] {
  return Object.keys(ADDRESSES).map(Number) as ChainId[];
}

/**
 * Check if a chain has been deployed (non-zero addresses)
 * @param chainId - The chain ID
 * @returns True if contracts are deployed on this chain
 */
export function isChainDeployed(chainId: number): boolean {
  const addresses = getAddresses(chainId);
  if (!addresses) return false;
  return addresses.factory !== "0x0000000000000000000000000000000000000000";
}
