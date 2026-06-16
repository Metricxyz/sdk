import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodeAbiParameters } from "viem";
import * as sdk from "../../src/index.js";

describe("extension initialize encoders", () => {
  it("EMPTY_EXTENSION_INIT_DATA is zero-length bytes", () => {
    assert.equal(sdk.EMPTY_EXTENSION_INIT_DATA, "0x");
  });

  it("encodeOracleStopLossInitData matches abi.encode(uint32,uint32,uint32)", () => {
    const encoded = sdk.encodeOracleStopLossInitData({
      drawdownE6: 50_000,
      decayPerSecondE8: 100,
      timelockSeconds: 3600,
    });

    const [drawdownE6, decayPerSecondE8, timelockSeconds] = decodeAbiParameters(
      [{ type: "uint32" }, { type: "uint32" }, { type: "uint32" }],
      encoded,
    );

    assert.equal(drawdownE6, 50_000);
    assert.equal(decayPerSecondE8, 100);
    assert.equal(timelockSeconds, 3600);
  });
});
