/**
 * Collect protocol fees from a MetricOmmPool.
 *
 * Usage:
 *   npx hardhat run exec/pool/collect-protocol-fees.ts --network base
 *
 * Environment variables (optional, will prompt if not set):
 *   POOL_ADDRESS - Pool contract address
 */

import { network } from "hardhat";
import { erc20Abi, formatUnits, getContract } from "viem";
import * as readline from "readline";
import * as sdk from "../../index.js";
import { logErrorDetails } from "../../scripts/utils/decodeError.js";

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

async function getAddressFromEnvOrPrompt(
  envVar: string,
  promptText: string,
): Promise<`0x${string}`> {
  const envValue = process.env[envVar];
  if (envValue) {
    console.log(`Using ${envVar} from environment: ${envValue}`);
    return envValue as `0x${string}`;
  }

  const value = await prompt(promptText);
  if (!value) {
    console.error(`\nERROR: ${promptText.replace(": ", "")} is required`);
    process.exit(1);
  }

  return value as `0x${string}`;
}

async function main() {
  console.log("\nMetricOMM Collect Protocol Fees\n");

  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const account = walletClient.account.address;

  const chainId = await publicClient.getChainId();
  const addresses = sdk.getAddressesOrThrow(chainId);

  const poolAddress = await getAddressFromEnvOrPrompt(
    "POOL_ADDRESS",
    "Enter pool address: ",
  );

  console.log("\nReading pool data...\n");

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

  const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
    token0.read.symbol(),
    token1.read.symbol(),
    token0.read.decimals(),
    token1.read.decimals(),
  ]);

  const [poolBal0Before, poolBal1Before] = await Promise.all([
    token0.read.balanceOf([poolAddress]),
    token1.read.balanceOf([poolAddress]),
  ]);

  console.log("Pool Information:");
  console.log("-".repeat(60));
  console.log(`Chain ID:               ${chainId}`);
  console.log(`Pool:                   ${poolAddress}`);
  console.log(`Token0:                 ${symbol0} (${immutables.token0})`);
  console.log(`Token1:                 ${symbol1} (${immutables.token1})`);
  console.log(`Admin:                  ${feeConfig.adminAddr}`);
  console.log(`Admin Fee Destination:  ${feeConfig.adminFeeDest}`);
  console.log(`Protocol Fee (E6):      ${feeConfig.protocolFee}`);
  console.log(
    `Pool ${symbol0} balance: ${formatUnits(poolBal0Before, decimals0)}`,
  );
  console.log(
    `Pool ${symbol1} balance: ${formatUnits(poolBal1Before, decimals1)}`,
  );
  console.log(`Caller:                 ${account}`);
  console.log();

  console.log("Simulating collectProtocolFees()...");

  let request;
  try {
    const simulated = await publicClient.simulateContract({
      address: poolAddress,
      abi: sdk.MetricOmmPoolAbi,
      functionName: "collectProtocolFees",
      account,
    });
    request = simulated.request;
  } catch (error: any) {
    logErrorDetails(error, sdk.MetricOmmPoolAbi);
    process.exit(1);
  }

  console.log("Simulation successful.");

  const confirm = await prompt("Proceed with transaction? (yes/no): ");
  if (!["yes", "y"].includes(confirm.toLowerCase())) {
    console.log("\nCollection cancelled.\n");
    return;
  }

  console.log("\nSending collectProtocolFees transaction...");
  const hash = await walletClient.writeContract(request);
  console.log(`Transaction hash: ${hash}`);

  console.log("Waiting for confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    console.error("\nERROR: collectProtocolFees transaction failed\n");
    process.exit(1);
  }

  console.log(`Confirmed in block ${receipt.blockNumber}`);

  const [poolBal0After, poolBal1After] = await Promise.all([
    token0.read.balanceOf([poolAddress]),
    token1.read.balanceOf([poolAddress]),
  ]);

  console.log("\nPool Balances After:");
  console.log("-".repeat(60));
  console.log(
    `Pool ${symbol0} balance: ${formatUnits(poolBal0After, decimals0)}`,
  );
  console.log(
    `Pool ${symbol1} balance: ${formatUnits(poolBal1After, decimals1)}`,
  );
  console.log();
}

main().catch((error) => {
  logErrorDetails(error, sdk.MetricOmmPoolAbi);
  process.exit(1);
});
