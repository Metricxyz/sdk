import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData, type Address } from "viem";
import {
  DepositAllowlistExtensionAbi,
  OracleValueStopLossExtensionAbi,
  PriceVelocityGuardExtensionAbi,
  SwapAllowlistExtensionAbi,
} from "../../src/abis/index.js";
import * as sdk from "../../src/index.js";

const extension = "0x1111111111111111111111111111111111111111" as Address;
const pool = "0x2222222222222222222222222222222222222222" as Address;
const account = "0x3333333333333333333333333333333333333333" as Address;

describe("extension admin calldata encoders", () => {
  it("deposit allowlist admin encoder matches viem", () => {
    const viaSdk = sdk.encodeSetAllowedToDepositCalldata({
      extension,
      pool,
      depositor: account,
      allowed: true,
    });
    const direct = encodeFunctionData({
      abi: DepositAllowlistExtensionAbi,
      functionName: "setAllowedToDeposit",
      args: [pool, account, true],
    });
    assert.equal(viaSdk, direct);

    const allowAllViaSdk = sdk.encodeSetAllowAllDepositorsCalldata({
      extension,
      pool,
      allowAll: true,
    });
    assert.equal(
      allowAllViaSdk,
      encodeFunctionData({
        abi: DepositAllowlistExtensionAbi,
        functionName: "setAllowAllDepositors",
        args: [pool, true],
      }),
    );
  });

  it("swap allowlist admin encoder matches viem", () => {
    const viaSdk = sdk.encodeSetAllowedToSwapCalldata({
      extension,
      pool,
      swapper: account,
      allowed: false,
    });
    const direct = encodeFunctionData({
      abi: SwapAllowlistExtensionAbi,
      functionName: "setAllowedToSwap",
      args: [pool, account, false],
    });
    assert.equal(viaSdk, direct);

    const allowAllViaSdk = sdk.encodeSetAllowAllSwappersCalldata({
      extension,
      pool,
      allowAll: true,
    });
    assert.equal(
      allowAllViaSdk,
      encodeFunctionData({
        abi: SwapAllowlistExtensionAbi,
        functionName: "setAllowAllSwappers",
        args: [pool, true],
      }),
    );
  });

  it("price velocity guard admin encoders match viem", () => {
    const maxChange = 1_000_000_000_000_000_000n;
    const midPrice = 1n << 64n;

    const maxChangeViaSdk = sdk.encodeSetMaxChangePerBlockCalldata({
      extension,
      pool,
      maxChangePerBlockE18: maxChange,
    });
    assert.equal(
      maxChangeViaSdk,
      encodeFunctionData({
        abi: PriceVelocityGuardExtensionAbi,
        functionName: "setMaxChangePerBlock",
        args: [pool, maxChange],
      }),
    );

    const midPriceViaSdk = sdk.encodeSetAnchorMidPriceCalldata({
      extension,
      pool,
      anchorMidPriceX64: midPrice,
    });
    assert.equal(
      midPriceViaSdk,
      encodeFunctionData({
        abi: PriceVelocityGuardExtensionAbi,
        functionName: "setAnchorMidPrice",
        args: [pool, midPrice],
      }),
    );
  });

  it("oracle stop-loss admin encoders match viem", () => {
    const cases: Array<{ viaSdk: `0x${string}`; direct: `0x${string}` }> = [
      {
        viaSdk: sdk.encodeProposeOracleStopLossTimelockCalldata({
          extension,
          pool,
          newTimelock: 7200,
        }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "proposeOracleStopLossTimelock",
          args: [pool, 7200],
        }),
      },
      {
        viaSdk: sdk.encodeExecuteOracleStopLossTimelockCalldata({ extension, pool }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "executeOracleStopLossTimelock",
          args: [pool],
        }),
      },
      {
        viaSdk: sdk.encodeCancelOracleStopLossTimelockCalldata({ extension, pool }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "cancelOracleStopLossTimelock",
          args: [pool],
        }),
      },
      {
        viaSdk: sdk.encodeProposeOracleStopLossDrawdownCalldata({
          extension,
          pool,
          newMaxDrawdownE6: 100_000n,
        }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "proposeOracleStopLossDrawdown",
          args: [pool, 100_000n],
        }),
      },
      {
        viaSdk: sdk.encodeExecuteOracleStopLossDrawdownCalldata({ extension, pool }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "executeOracleStopLossDrawdown",
          args: [pool],
        }),
      },
      {
        viaSdk: sdk.encodeCancelOracleStopLossDrawdownCalldata({ extension, pool }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "cancelOracleStopLossDrawdown",
          args: [pool],
        }),
      },
      {
        viaSdk: sdk.encodeProposeOracleStopLossDecayCalldata({
          extension,
          pool,
          newDecayPerSecondE18: 50n,
        }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "proposeOracleStopLossDecay",
          args: [pool, 50n],
        }),
      },
      {
        viaSdk: sdk.encodeExecuteOracleStopLossDecayCalldata({ extension, pool }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "executeOracleStopLossDecay",
          args: [pool],
        }),
      },
      {
        viaSdk: sdk.encodeCancelOracleStopLossDecayCalldata({ extension, pool }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "cancelOracleStopLossDecay",
          args: [pool],
        }),
      },
      {
        viaSdk: sdk.encodeProposeOracleStopLossHighWatermarksCalldata({
          extension,
          pool,
          binIdx: -3,
          newHwmToken0: 123n,
          newHwmToken1: 456n,
        }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "proposeOracleStopLossHighWatermarks",
          args: [pool, -3, 123n, 456n],
        }),
      },
      {
        viaSdk: sdk.encodeExecuteOracleStopLossHighWatermarksCalldata({ extension, pool }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "executeOracleStopLossHighWatermarks",
          args: [pool],
        }),
      },
      {
        viaSdk: sdk.encodeCancelOracleStopLossHighWatermarksCalldata({ extension, pool }),
        direct: encodeFunctionData({
          abi: OracleValueStopLossExtensionAbi,
          functionName: "cancelOracleStopLossHighWatermarks",
          args: [pool],
        }),
      },
    ];

    for (const { viaSdk, direct } of cases) {
      assert.equal(viaSdk, direct);
    }
  });
});
