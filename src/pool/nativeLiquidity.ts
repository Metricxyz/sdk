import type { Hex } from "viem";
import {
  encodeAddLiquidityExactSharesSelfCalldata,
  encodeAddLiquidityExactSharesWithOwnerCalldata,
} from "./liquidityAddExactShares.js";
import {
  encodeAddLiquidityWeightedSelfCalldata,
  encodeAddLiquidityWeightedWithOwnerCalldata,
} from "./liquidityAddWeighted.js";
import { encodeMulticallCalldata, encodeRefundETHCalldata } from "../peripheryPayments/index.js";

type ExactSharesSelfParams = Parameters<typeof encodeAddLiquidityExactSharesSelfCalldata>[0];
type ExactSharesWithOwnerParams = Parameters<
  typeof encodeAddLiquidityExactSharesWithOwnerCalldata
>[0];
type WeightedSelfParams = Parameters<typeof encodeAddLiquidityWeightedSelfCalldata>[0];
type WeightedWithOwnerParams = Parameters<typeof encodeAddLiquidityWeightedWithOwnerCalldata>[0];

/**
 * Exact-shares add with native ETH for the pool WETH leg.
 * Credits liquidity to `(msg.sender, salt)`. Set `msg.value` on the transaction;
 * unused ETH is refunded to the caller.
 */
export function prepareAddLiquidityExactSharesSelfSupportingNativePaymentCalldata(
  params: ExactSharesSelfParams,
): Hex {
  return encodeMulticallCalldata([
    encodeAddLiquidityExactSharesSelfCalldata(params),
    encodeRefundETHCalldata(),
  ]);
}

/**
 * Exact-shares add with native ETH for the pool WETH leg.
 * Credits liquidity to `(owner, salt)` while `msg.sender` pays. Set `msg.value` on the
 * transaction; unused ETH is refunded to the caller.
 */
export function prepareAddLiquidityExactSharesWithOwnerSupportingNativePaymentCalldata(
  params: ExactSharesWithOwnerParams,
): Hex {
  return encodeMulticallCalldata([
    encodeAddLiquidityExactSharesWithOwnerCalldata(params),
    encodeRefundETHCalldata(),
  ]);
}

/**
 * Weighted add with native ETH for the pool WETH leg.
 * Credits liquidity to `(msg.sender, salt)`. Set `msg.value` on the transaction;
 * unused ETH is refunded to the caller.
 */
export function prepareAddLiquidityWeightedSelfSupportingNativePaymentCalldata(
  params: WeightedSelfParams,
): Hex {
  return encodeMulticallCalldata([
    encodeAddLiquidityWeightedSelfCalldata(params),
    encodeRefundETHCalldata(),
  ]);
}

/**
 * Weighted add with native ETH for the pool WETH leg.
 * Credits liquidity to `(owner, salt)` while `msg.sender` pays. Set `msg.value` on the
 * transaction; unused ETH is refunded to the caller.
 */
export function prepareAddLiquidityWeightedWithOwnerSupportingNativePaymentCalldata(
  params: WeightedWithOwnerParams,
): Hex {
  return encodeMulticallCalldata([
    encodeAddLiquidityWeightedWithOwnerCalldata(params),
    encodeRefundETHCalldata(),
  ]);
}
