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
  ARBITRUM: 42161,
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
    factory: "0x5d09437cfD768bee946C5480E770c6937df510A8",
    poolDeployer: "0xAD1c7179a1ec85A66280F09D46Ff7D6565a4540B",
    router: "0xF8bB90d25DB7c9092965bfbD74b25BfA6ca96528",
    stateView: "0xd143fb14BbC692Fd559FEc3BB15432aAD61bc747",
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
    factory: "0x5d09437cfD768bee946C5480E770c6937df510A8",
    poolDeployer: "0xAD1c7179a1ec85A66280F09D46Ff7D6565a4540B",
    router: "0x33e3cD634Ad1bC371F898415c155BcFECB932d43",
    stateView: "0xd143fb14BbC692Fd559FEc3BB15432aAD61bc747",
    wrappedNative: "0x4200000000000000000000000000000000000006", // Base WETH
  },

  [ChainId.BASE_SEPOLIA]: {
    factory: "0x0000000000000000000000000000000000000000",
    poolDeployer: "0x0000000000000000000000000000000000000000",
    router: "0x0000000000000000000000000000000000000000",
    stateView: "0x0000000000000000000000000000000000000000",
    wrappedNative: "0x4200000000000000000000000000000000000006", // Base Sepolia WETH
  },

  [ChainId.ARBITRUM]: {
    factory: "0x5d09437cfD768bee946C5480E770c6937df510A8",
    poolDeployer: "0xAD1c7179a1ec85A66280F09D46Ff7D6565a4540B",
    router: "0xB019FAFfc0c32372Cd1E8cEE99cF9BedeA729545",
    stateView: "0xd143fb14BbC692Fd559FEc3BB15432aAD61bc747",
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // Arbitrum WETH
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
