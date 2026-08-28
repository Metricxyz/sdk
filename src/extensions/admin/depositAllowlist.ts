import type { Address, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { DepositAllowlistExtensionAbi } from "../../abis/DepositAllowlistExtension.js";

export function encodeSetAllowedToDepositCalldata(params: {
  extension: Address;
  pool: Address;
  depositor: Address;
  allowed: boolean;
}): Hex {
  return encodeFunctionData({
    abi: DepositAllowlistExtensionAbi,
    functionName: "setAllowedToDeposit",
    args: [params.pool, params.depositor, params.allowed],
  });
}

/** Pool-wide switch: when `allowAll` is true, every depositor is allowed regardless of the allowlist. */
export function encodeSetAllowAllDepositorsCalldata(params: {
  extension: Address;
  pool: Address;
  allowAll: boolean;
}): Hex {
  return encodeFunctionData({
    abi: DepositAllowlistExtensionAbi,
    functionName: "setAllowAllDepositors",
    args: [params.pool, params.allowAll],
  });
}
