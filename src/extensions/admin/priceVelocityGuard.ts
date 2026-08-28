import type { Address, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { PriceVelocityGuardExtensionAbi } from "../../abis/PriceVelocityGuardExtension.js";

export function encodeSetMaxChangePerBlockCalldata(params: {
  extension: Address;
  pool: Address;
  maxChangePerBlockE18: bigint;
}): Hex {
  return encodeFunctionData({
    abi: PriceVelocityGuardExtensionAbi,
    functionName: "setMaxChangePerBlock",
    args: [params.pool, params.maxChangePerBlockE18],
  });
}

export function encodeSetLastMidPriceCalldata(params: {
  extension: Address;
  pool: Address;
  lastMidPriceX64: bigint;
}): Hex {
  return encodeFunctionData({
    abi: PriceVelocityGuardExtensionAbi,
    functionName: "setLastMidPrice",
    args: [params.pool, params.lastMidPriceX64],
  });
}
