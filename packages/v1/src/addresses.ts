/**
 * MetricAMM SDK — v1 deployed addresses.
 *
 * Only Ethereum mainnet is configured (no other chain deployments for this release).
 * State view (`test/MetricOmmPoolStateView.sol` in core) is not part of the periphery bundle;
 * set `stateView` on the returned object when you deploy it, or pass its address into read helpers directly.
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
  /** MetricOmmPoolSwapDataProvider */
  swapDataProvider: Address;
  /** DepositAllowlist */
  depositAllowlist: Address;
  /** SwapAllowlist */
  swapAllowlist: Address;
  /** MetricOmmPoolSwapper */
  swapper: Address;
  /** Wrapped native (WETH on Ethereum) */
  wrappedNative: Address;
  /**
   * Optional `MetricOmmPoolStateView` used by batch read helpers.
   * Not included in the v1 Ethereum deploy manifest; wire when you deploy the state view.
   */
  stateView?: Address;
}

// ============ Deployed addresses ============

export const ADDRESSES: Record<DeployedChainId, ChainAddresses> = {
  [ChainId.ETHEREUM]: {
    factory: "0x93e314a9a65a15f3c3bc039bb4261dbbbc343fba",
    poolDeployer: "0xe56e89c4faeec39364b5a2cbde13c572a876afb6",
    liquidityAdder: "0x1f2a03dc43947c6bdebb2e6136222997e49fa3e9",
    swapDataProvider: "0x404bdb6d2b9ed34a5637211a8d52177c38c39d02",
    depositAllowlist: "0xea700fcd860533474e1ff920b76914113ae56681",
    swapAllowlist: "0x5269d78af4a288e1649be6bf169a51bb94b6eb78",
    swapper: "0x85e4ff47427f1a62ed19a3abf97b80c333da266c",
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
