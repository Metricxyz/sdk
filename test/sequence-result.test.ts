import assert from "node:assert/strict";
import { it } from "node:test";
import { network } from "hardhat";
import { decodeFunctionResult } from "viem";
import * as sdk from "../src/index.js";

it("decodes failed, successful, and unexecuted sequence steps", async () => {
  const { viem } = await network.connect();
  const [payer] = await viem.getWalletClients();
  const client = await viem.getPublicClient();
  const weth = await viem.deployContract("MockWETH9", []);
  const router = await viem.deployContract("MetricOmmSimpleRouter", [
    weth.address,
    payer.account.address,
  ]);
  const data = sdk.encodeSequenceCalldata([
    {
      data: sdk.encodeUnwrapWETH9Calldata(1n, payer.account.address),
      onSuccess: sdk.OnStepSuccess.CONTINUE,
      onFailure: sdk.OnStepFailure.CONTINUE,
    },
    {
      data: sdk.encodeRefundETHCalldata(),
      onSuccess: sdk.OnStepSuccess.STOP,
      onFailure: sdk.OnStepFailure.REVERT,
    },
    {
      data: sdk.encodeRefundETHCalldata(),
      onSuccess: sdk.OnStepSuccess.STOP,
      onFailure: sdk.OnStepFailure.REVERT,
    },
  ]);
  const response = await client.call({ account: payer.account.address, to: router.address, data });
  assert.ok(response.data);
  const [results, statuses] = decodeFunctionResult({
    abi: sdk.MetricOmmSimpleRouterAbi,
    functionName: "sequence",
    data: response.data,
  });
  assert.deepEqual(statuses, [
    sdk.StepStatus.FAILURE,
    sdk.StepStatus.SUCCESS,
    sdk.StepStatus.NOT_EXECUTED,
  ]);
  assert.equal(results.length, 3);
  assert.notEqual(results[0], "0x");
  assert.equal(results[1], "0x");
  assert.equal(results[2], "0x");
});
