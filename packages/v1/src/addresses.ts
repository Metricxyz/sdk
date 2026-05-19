/**
 * MetricAMM SDK — v1 deployed addresses.
 *
 * Only Ethereum mainnet is configured (no other chain deployments for this release).
 * Pool state reads (slot0, bins, position shares) and depth/quote views use `dataProvider`
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

/** Chains that have entries in `ADDRESSES` for this SDK release. */
export type DeployedChainId = typeof ChainId.ETHEREUM;

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
  /** DepositAllowlist */
  depositAllowlist: Address;
  /** SwapAllowlist */
  swapAllowlist: Address;
  /** MetricOmmPoolSwapper */
  swapper: Address;
  /** Wrapped native (WETH on Ethereum) */
  wrappedNative: Address;
}

// ============ Deployed addresses ============

/** dev-deployment v1 num 2 — Ethereum mainnet (May 2026). */
export const ADDRESSES: Record<DeployedChainId, ChainAddresses> = {
  [ChainId.ETHEREUM]: {
    factory: "0xf98aD80FE666B9a23075CdF64aF5971802844Fd8",
    poolDeployer: "0xf93e1ea4516E99A4Ee81D4979C8D3C8Ab636e397",
    liquidityAdder: "0x05632ffd8D4a22ac6f925B9fc7b60390d436467D",
    dataProvider: "0xAce0Ec0040e81eE3496EeE768db8F453f2f0B9Bb",
    depositAllowlist: "0x497B15B9640eCbfFB96C1CFF7e6A3D8Ec5C6dAE2",
    swapAllowlist: "0x657f8CAC2066481b3Cd421781410e383f173433D",
    swapper: "0x377421359e849cc44da76b18511f6A5Dd5abFc23",
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
} as const;

// ============ Helper Functions ============

export function getAddresses(chainId: number): ChainAddresses | undefined {
  if (chainId !== ChainId.ETHEREUM) return undefined;
  return ADDRESSES[ChainId.ETHEREUM];
}

export function getAddressesOrThrow(chainId: number): ChainAddresses {
  const addresses = getAddresses(chainId);
  if (!addresses) {
    throw new Error(
      `Chain ${chainId} has no v1 deployment in this SDK (only Ethereum mainnet is configured)`,
    );
  }
  return addresses;
}

export function isChainSupported(chainId: number): chainId is DeployedChainId {
  return chainId === ChainId.ETHEREUM;
}

export function getSupportedChainIds(): DeployedChainId[] {
  return [ChainId.ETHEREUM];
}

export function isChainDeployed(chainId: number): boolean {
  const addresses = getAddresses(chainId);
  if (!addresses) return false;
  return addresses.factory !== "0x0000000000000000000000000000000000000000";
}
