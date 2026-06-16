import type { Address, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { SwapAllowlistExtensionAbi } from "../../abis/SwapAllowlistExtension.js";

export function encodeSetAllowedToSwapCalldata(params: {
  extension: Address;
  pool: Address;
  swapper: Address;
  allowed: boolean;
}): Hex {
  return encodeFunctionData({
    abi: SwapAllowlistExtensionAbi,
    functionName: "setAllowedToSwap",
    args: [params.pool, params.swapper, params.allowed],
  });
}
