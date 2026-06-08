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
  /** MetricOmmPoolStateView (raw pool storage reads). */
  stateView: Address;
  /** MetricOmmSimpleRouter (single- and multi-hop swaps; not wrapped by SDK yet). */
  simpleRouter: Address;
  /** MetricOmmPoolSwapper */
  swapper: Address;
  /** Wrapped native (WETH on Ethereum) */
  wrappedNative: Address;
}

// ============ Deployed addresses ============

/** hooks-era deployment — Ethereum mainnet (Jun 2026). */
export const ADDRESSES: Record<DeployedChainId, ChainAddresses> = {
  [ChainId.ETHEREUM]: {
    factory: "0xDd41F182630A395E2ED8b9c1D5f1E22F1f9b133a",
    poolDeployer: "0xb9bb9364FEA5170713709Ba67Aec649eF043e885",
    liquidityAdder: "0x9de47a0C84c7F9486Af77C8135CE7f480d121B44",
    dataProvider: "0xf06454dB7E9b8BCa2FC77bF6e88f9B98dF0b52e8",
    stateView: "0x124C2853E316d1585621560E35D4dcC8318F97FF",
    simpleRouter: "0x94DD3A9308A1060f4BD9A95dE65F27f0F048f863",
    swapper: "0xc73407A1d240e08EB34654e706cc3B19E356b8C4",
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
