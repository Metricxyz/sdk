import type { Address, Hex } from "viem";

/** Invocation order for a single extension action (packed 3-bit slots). */
export interface ExtensionOrders {
  beforeAddLiquidity: bigint;
  afterAddLiquidity: bigint;
  beforeRemoveLiquidity: bigint;
  afterRemoveLiquidity: bigint;
  beforeSwap: bigint;
  afterSwap: bigint;
}

/** Up to seven extension addresses configured on a pool (index 1–7). */
export interface PoolExtensions {
  extension1: Address;
  extension2: Address;
  extension3: Address;
  extension4: Address;
  extension5: Address;
  extension6: Address;
  extension7: Address;
}

export const EMPTY_EXTENSION_DATA = "0x" as Hex;

export const EMPTY_EXTENSION_ORDERS: ExtensionOrders = {
  beforeAddLiquidity: 0n,
  afterAddLiquidity: 0n,
  beforeRemoveLiquidity: 0n,
  afterRemoveLiquidity: 0n,
  beforeSwap: 0n,
  afterSwap: 0n,
};
