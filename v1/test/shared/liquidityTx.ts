import type { Address, Hex } from "viem";
import * as sdk from "../../src/index.js";

/** v1: add liquidity via MetricOmmPoolLiquidityAdder (replaces v0 pool.modifyLiquidity for adds). */
export function encodeAddLiquidityCalldata(pool: Address, args: sdk.ModifyLiquidityArgs): Hex {
  const [salt, deltas, maxAmountToken0, maxAmountToken1] = args;
  return sdk.encodeAddLiquidityExactSharesSelfCalldata({
    pool,
    salt,
    deltas: sdk.additionPlanToPoolLiquidityDelta(deltas),
    maxAmountToken0,
    maxAmountToken1,
  });
}

/** v1: remove liquidity via pool.removeLiquidity. */
export function encodeRemoveLiquidityCalldataFromArgs(
  owner: Address,
  args: sdk.ModifyLiquidityArgs,
): Hex {
  const [salt, deltas] = args;
  return sdk.encodeRemoveLiquidityCalldata({
    owner,
    salt,
    deltas: sdk.removalPlanToPoolLiquidityDelta(deltas),
  });
}

export function encodeRemoveLiquidityCalldataFromDeltas(
  owner: Address,
  salt: bigint,
  deltas: sdk.LiquidityDelta[],
): Hex {
  return sdk.encodeRemoveLiquidityCalldata({
    owner,
    salt,
    deltas: sdk.removalPlanToPoolLiquidityDelta(deltas),
  });
}
