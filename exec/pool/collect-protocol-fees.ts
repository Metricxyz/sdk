/**
 * Collect protocol fees from one or more MetricOmmPools via Multicall3.
 *
 * Usage (single pool):
 *   POOL_ADDRESS=0x... npx hardhat run exec/pool/collect-protocol-fees.ts --network ethereum
 *
 * Usage (multiple pools):
 *   POOL_ADDRESSES=0x...,0x...,0x... npx hardhat run exec/pool/collect-protocol-fees.ts --network ethereum
 *
 * Environment variables:
 *   POOL_ADDRESS   - Single pool address (will prompt if neither var is set)
 *   POOL_ADDRESSES - Comma-separated list of pool addresses
 */

import { network } from "hardhat";
import { erc20Abi, encodeFunctionData, formatUnits } from "viem";
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

async function getPoolAddresses(): Promise<`0x${string}`[]> {
  if (process.env.POOL_ADDRESSES) {
    const addresses = process.env.POOL_ADDRESSES.split(",")
      .map((a) => a.trim())
      .filter(Boolean) as `0x${string}`[];
    console.log(`Using POOL_ADDRESSES from environment (${addresses.length} pools)`);
    return addresses;
  }

  if (process.env.POOL_ADDRESS) {
    console.log(`Using POOL_ADDRESS from environment: ${process.env.POOL_ADDRESS}`);
    return [process.env.POOL_ADDRESS as `0x${string}`];
  }

  const value = await prompt("Enter pool address (or comma-separated list): ");
  if (!value) {
    console.error("\nERROR: Pool address is required");
    process.exit(1);
  }

  return value
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean) as `0x${string}`[];
}

async function inspectPool(
  publicClient: Awaited<ReturnType<typeof viem.getPublicClient>>,
  poolAddress: `0x${string}`,
  addresses: ReturnType<typeof sdk.getAddressesOrThrow>,
  account: `0x${string}`,
  index: number,
  total: number,
) {
  console.log(`\n[${index + 1}/${total}] Pool: ${poolAddress}`);
  console.log("-".repeat(60));

  const [immutables, feeConfig, slot1] = await Promise.all([
    sdk.getPoolImmutables(publicClient, poolAddress),
    sdk.getFeeConfig(publicClient, addresses.stateView, poolAddress),
    sdk.getSlot1(publicClient, addresses.stateView, poolAddress),
  ]);

  const readToken = (address: `0x${string}`, fn: string, args?: readonly [`0x${string}`]) =>
    publicClient.readContract({ address, abi: erc20Abi, functionName: fn as any, args });

  const [symbol0, symbol1, decimals0, decimals1, bal0, bal1] = await Promise.all([
    readToken(immutables.token0, "symbol") as Promise<string>,
    readToken(immutables.token1, "symbol") as Promise<string>,
    readToken(immutables.token0, "decimals") as Promise<number>,
    readToken(immutables.token1, "decimals") as Promise<number>,
    readToken(immutables.token0, "balanceOf", [poolAddress]) as Promise<bigint>,
    readToken(immutables.token1, "balanceOf", [poolAddress]) as Promise<bigint>,
  ]);

  const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
  const total0InBins = ceilDiv(slot1.totalScaledToken0InBins, immutables.token0ScaleMultiplier);
  const total1InBins = ceilDiv(slot1.totalScaledToken1InBins, immutables.token1ScaleMultiplier);
  const fees0 = bal0 - total0InBins;
  const fees1 = bal1 - total1InBins;
  const totalFee = feeConfig.protocolFee + feeConfig.adminFee;

  console.log(`Token0:                 ${symbol0} (${immutables.token0})`);
  console.log(`Token1:                 ${symbol1} (${immutables.token1})`);
  console.log(`Factory:                ${immutables.factory}`);
  console.log(`Admin Fee Destination:  ${feeConfig.adminFeeDest}`);
  console.log(`Total Fee (E6):         ${totalFee}`);
  console.log(`  Protocol Fee (E6):    ${feeConfig.protocolFee}`);
  console.log(`  Admin Fee (E6):       ${feeConfig.adminFee}`);
  console.log(`Accrued ${symbol0} fees: ${formatUnits(fees0, decimals0)} (${fees0} raw)`);
  console.log(`Accrued ${symbol1} fees: ${formatUnits(fees1, decimals1)} (${fees1} raw)`);

  // Simulate pool-level call first so we can safely skip problematic pools.
  const callData = encodeFunctionData({
    abi: sdk.MetricOmmPoolAbi,
    functionName: "collectProtocolFees",
  });

  try {
    await publicClient.simulateContract({
      address: poolAddress,
      abi: sdk.MetricOmmPoolAbi,
      functionName: "collectProtocolFees",
      account,
    });
    console.log("Simulation: OK");
  } catch (error: any) {
    console.error(`Simulation FAILED for pool ${poolAddress}:`);
    logErrorDetails(error, sdk.MetricOmmPoolAbi);
    return false;
  }

  return {
    poolAddress,
    callData,
    symbol0,
    symbol1,
    decimals0,
    decimals1,
    token0Addr: immutables.token0,
    token1Addr: immutables.token1,
  };
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

  const poolAddresses = await getPoolAddresses();

  console.log("\nReading pool data...");

  const results = await Promise.all(
    poolAddresses.map((poolAddress, i) =>
      inspectPool(publicClient, poolAddress, addresses, account, i, poolAddresses.length),
    ),
  );

  const valid = results.filter(Boolean).filter((r) => r !== false) as Exclude<
    Awaited<ReturnType<typeof collectFromPool>>,
    boolean
  >[];

  const failed = results.filter((r) => r === false).length;
  if (failed > 0) {
    console.log(`\nWARNING: ${failed} pool(s) failed simulation and will be skipped.`);
  }

  if (valid.length === 0) {
    console.error("\nNo pools to collect from. Exiting.\n");
    process.exit(1);
  }

  const calls = valid.map((pool) => ({
    target: pool.poolAddress,
    allowFailure: false,
    callData: pool.callData,
  }));

  console.log(`\nBatching ${calls.length} collectProtocolFees call(s) via Multicall3...`);
  try {
    await publicClient.simulateContract({
      address: MULTICALL3_ADDRESS,
      abi: Mutlicall3Abi,
      functionName: "aggregate3",
      args: [calls],
      account,
    });
    console.log("Batch simulation: OK");
  } catch (error: any) {
    console.error("\nBatch simulation failed:");
    logErrorDetails(error, Mutlicall3Abi);
    process.exit(1);
  }

  console.log(`\nReady to collect from ${valid.length} pool(s).`);
  const confirm = await prompt("Proceed with batched transaction? (yes/no): ");
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

  for (const pool of valid) {
    const [bal0After, bal1After] = await Promise.all([
      publicClient.readContract({
        address: pool.token0Addr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [pool.poolAddress],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: pool.token1Addr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [pool.poolAddress],
      }) as Promise<bigint>,
    ]);

    console.log(
      `Pool ${pool.poolAddress} ${pool.symbol0} balance after: ${formatUnits(bal0After, pool.decimals0)}`,
    );
    console.log(
      `Pool ${pool.poolAddress} ${pool.symbol1} balance after: ${formatUnits(bal1After, pool.decimals1)}`,
    );
  }

  console.log(
    `\nCollected protocol fees from ${valid.length} pool(s) in a single transaction.\n`,
  );
}

main().catch((error) => {
  logErrorDetails(error, sdk.MetricOmmPoolAbi);
  process.exit(1);
});
