/**
 * MetricAMM SDK Constants
 */

import type { Abi } from "viem";
import { MetricOmmPoolAbi } from "./abis/MetricOmmPool.js";
import { MetricOmmPoolStateViewAbi } from "./abis/MetricOmmPoolStateView.js";
import { MetricOmmSwapRouterAbi } from "./abis/MetricOmmSwapRouter.js";
import { MetricOmmPoolFactoryAbi } from "./abis/MetricOmmPoolFactory.js";

// ============ Numeric Constants ============

/** Q64 format multiplier (2^64) */
export const Q64 = 2n ** 64n;

/** Max uint128 value for no price limit */
export const MAX_UINT128 = 2n ** 128n - 1n;

/** Max int128 value for no slippage limit */
export const MAX_INT128 = 2n ** 127n - 1n;

/** Max position in bin */
export const MAX_UINT104 = 2n ** 104n - 1n;

/** Max int104 value */
export const MAX_INT104 = 2n ** 103n - 1n;

// ============ Internal ABI References ============
// Cast to Abi for flexibility with viem

export const POOL_ABI = MetricOmmPoolAbi as Abi;
export const STATE_VIEW_ABI = MetricOmmPoolStateViewAbi as Abi;
export const SWAP_ROUTER_ABI = MetricOmmSwapRouterAbi as Abi;
export const POOL_FACTORY_ABI = MetricOmmPoolFactoryAbi as Abi;
