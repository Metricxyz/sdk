import type { Hex } from "viem";
import { encodeAbiParameters } from "viem";
import { EMPTY_EXTENSION_DATA } from "../types.js";

/** Default init payload for extensions whose `initialize` is a no-op. */
export const EMPTY_EXTENSION_INIT_DATA = EMPTY_EXTENSION_DATA;

/**
 * Init data for `OracleValueStopLossExtension.initialize`.
 * `abi.encode(uint32 drawdownE6, uint32 decayPerSecondE8, uint32 timelockSeconds)`.
 */
export function encodeOracleStopLossInitData(params: {
  drawdownE6: number;
  decayPerSecondE8: number;
  timelockSeconds: number;
}): Hex {
  return encodeAbiParameters(
    [{ type: "uint32" }, { type: "uint32" }, { type: "uint32" }],
    [params.drawdownE6, params.decayPerSecondE8, params.timelockSeconds],
  );
}
