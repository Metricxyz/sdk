/**
 * Collect protocol fees from one or more MetricOmmPools via Multicall3.
 *
 * Usage:
 *   npx hardhat run exec/pool/collect-protocol-fees.ts --network base
 *
 * Environment variables (optional, will prompt if not set):
 *   POOL_ADDRESSES - Comma-separated pool contract addresses
 */

import { network } from "hardhat";
import { erc20Abi, encodeFunctionData, formatUnits, getContract } from "viem";
import * as readline from "readline";
import * as sdk from "../../index.js";
import { Mutlicall3Abi } from "../../src/abis/Multicall3.js";
import { logErrorDetails } from "../../scripts/utils/decodeError.js";

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const { viem } = await network.connect();

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function parseAddressList(input: string): `0x${string}`[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as `0x${string}`[];
}

async function main() {
  console.log("\nMetricOMM Collect Protocol Fees (Multicall3)\n");

  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const account = walletClient.account.address;

  const chainId = await publicClient.getChainId();
  const addresses = sdk.getAddressesOrThrow(chainId);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Caller:   ${account}\n`);

  // Get pool addresses
  const rawInput =
    process.env.POOL_ADDRESSES ??
    (await prompt("Enter comma-separated pool addresses: "));

  const poolAddresses = parseAddressList(rawInput);
  if (poolAddresses.length === 0) {
    console.error("ERROR: No pool addresses provided");
    process.exit(1);
  }

  console.log(`\nReading data for ${poolAddresses.length} pool(s)...\n`);

  // Read pool info for each pool
  for (const poolAddress of poolAddresses) {
    const [immutables, feeConfig] = await Promise.all([
      sdk.getPoolImmutables(publicClient, poolAddress),
      sdk.getFeeConfig(publicClient, addresses.stateView, poolAddress),
    ]);

    const token0 = getContract({
      address: immutables.token0,
      abi: erc20Abi,
      client: publicClient,
    });
    const token1 = getContract({
      address: immutables.token1,
      abi: erc20Abi,
      client: publicClient,
    });

    const [symbol0, symbol1, decimals0, decimals1, bal0, bal1] =
      await Promise.all([
        token0.read.symbol(),
        token1.read.symbol(),
        token0.read.decimals(),
        token1.read.decimals(),
        token0.read.balanceOf([poolAddress]),
        token1.read.balanceOf([poolAddress]),
      ]);

    console.log(`Pool: ${poolAddress}`);
    console.log(`  ${symbol0}/${symbol1}`);
    console.log(
      `  Pool balances: ${formatUnits(bal0, decimals0)} ${symbol0} / ${formatUnits(bal1, decimals1)} ${symbol1}`,
    );
    console.log(`  Protocol fee (E6): ${feeConfig.protocolFee}`);
    console.log(`  Admin: ${feeConfig.adminAddr}`);
  }

  // Encode collectProtocolFees calldata (no args)
  const callData = encodeFunctionData({
    abi: sdk.MetricOmmPoolAbi,
    functionName: "collectProtocolFees",
  });

  // Build aggregate3 calls
  const calls = poolAddresses.map((poolAddress) => ({
    target: poolAddress,
    allowFailure: false,
    callData,
  }));

  console.log(`\nBatching ${calls.length} collectProtocolFees call(s) via Multicall3...`);

  // Simulate
  try {
    await publicClient.simulateContract({
      address: MULTICALL3_ADDRESS,
      abi: Mutlicall3Abi,
      functionName: "aggregate3",
      args: [calls],
      account,
    });
  } catch (error: any) {
    console.error("\nSimulation failed:");
    logErrorDetails(error, sdk.MetricOmmPoolAbi);
    process.exit(1);
  }

  console.log("Simulation successful.");

  const confirm = await prompt("Proceed with transaction? (yes/no): ");
  if (!["yes", "y"].includes(confirm.toLowerCase())) {
    console.log("\nCollection cancelled.\n");
    return;
  }

  console.log("\nSending aggregate3 transaction...");
  const hash = await walletClient.writeContract({
    address: MULTICALL3_ADDRESS,
    abi: Mutlicall3Abi,
    functionName: "aggregate3",
    args: [calls],
    account,
  });

  console.log(`Transaction hash: ${hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    console.error("\nERROR: Transaction failed\n");
    process.exit(1);
  }

  console.log(`Confirmed in block ${receipt.blockNumber}`);
  console.log(
    `\nCollected protocol fees from ${poolAddresses.length} pool(s) in a single transaction.\n`,
  );
}

main().catch((error) => {
  logErrorDetails(error, sdk.MetricOmmPoolAbi);
  process.exit(1);
});
