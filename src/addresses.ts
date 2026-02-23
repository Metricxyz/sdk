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
  BASE: 8453,
  ARBITRUM: 42161,
  AVALANCHE: 43114,
  BNB: 56,
  POLYGON: 137,
  MEGAETH: 4326,
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
    factory: "0xe22F9fc0f04486dE25ed6CF1800a4a47aFD82e0C",
    poolDeployer: "0x0f732971a3503afee276782173170D1F1154d4c1",
    router: "0xcB41C10c6414aCbea022c7662df4005dd8FBEF91",
    stateView: "0xe6b102a2aea65b9b59e4F8B86B38E221886675A8",
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  },

  [ChainId.BASE]: {
    factory: "0xe22F9fc0f04486dE25ed6CF1800a4a47aFD82e0C",
    poolDeployer: "0x0f732971a3503afee276782173170D1F1154d4c1",
    router: "0xA6A16C00B7E9DBE1D54acEd7d6FE264fc4732eaF",
    stateView: "0xe6b102a2aea65b9b59e4F8B86B38E221886675A8",
    wrappedNative: "0x4200000000000000000000000000000000000006", // WETH
  },

  [ChainId.ARBITRUM]: {
    factory: "0xe22F9fc0f04486dE25ed6CF1800a4a47aFD82e0C",
    poolDeployer: "0x0f732971a3503afee276782173170D1F1154d4c1",
    router: "0x82A562fD9F02d4346B95D3a2a501411979C8F920",
    stateView: "0xe6b102a2aea65b9b59e4F8B86B38E221886675A8",
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
  },

  [ChainId.AVALANCHE]: {
    factory: "0xe22F9fc0f04486dE25ed6CF1800a4a47aFD82e0C",
    poolDeployer: "0x0f732971a3503afee276782173170D1F1154d4c1",
    router: "0x5C1e08DF74a3457648A4C4dc5DC0DE497284c53C",
    stateView: "0xe6b102a2aea65b9b59e4F8B86B38E221886675A8",
    wrappedNative: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX
  },

  [ChainId.BNB]: {
    factory: "0xe22F9fc0f04486dE25ed6CF1800a4a47aFD82e0C",
    poolDeployer: "0x0f732971a3503afee276782173170D1F1154d4c1",
    router: "0xa9a63266bB70eb3419C34C245F4318983f325Bbd",
    stateView: "0xe6b102a2aea65b9b59e4F8B86B38E221886675A8",
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
  },

  [ChainId.POLYGON]: {
    factory: "0xe22F9fc0f04486dE25ed6CF1800a4a47aFD82e0C",
    poolDeployer: "0x0f732971a3503afee276782173170D1F1154d4c1",
    router: "0x976c26402E1EC10454c5Fe6D2C9857DD57aE78f3",
    stateView: "0xe6b102a2aea65b9b59e4F8B86B38E221886675A8",
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
  },

  [ChainId.MEGAETH]: {
    factory: "0xe22F9fc0f04486dE25ed6CF1800a4a47aFD82e0C",
    poolDeployer: "0x0f732971a3503afee276782173170D1F1154d4c1",
    router: "0xA6A16C00B7E9DBE1D54acEd7d6FE264fc4732eaF",
    stateView: "0xe6b102a2aea65b9b59e4F8B86B38E221886675A8",
    wrappedNative: "0x4200000000000000000000000000000000000006", // WETH
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
