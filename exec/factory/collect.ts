/**
 * Collect accumulated factory fees for selected assets.
 *
 * Usage:
 *   npx hardhat run exec/factory/collect.ts --network base
 *
 * Environment variables (optional):
 *   FACTORY_ADDRESS - Factory contract address (defaults to SDK chain address)
 *   TARGET_ADDRESS  - Address to receive collected fees (defaults to signer)
 *   ASSETS          - Comma-separated asset addresses. Use zero address for native ETH
 *                     Example: ASSETS=0x0000000000000000000000000000000000000000,0xA0b8...
 */
// @ts-nocheck - viem version mismatch between hardhat and sdk

import { network } from "hardhat";
import {
  erc20Abi,
  formatEther,
  formatUnits,
  getContract,
  zeroAddress,
} from "viem";
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
  fallback?: string,
): Promise<`0x${string}`> {
  const envValue = process.env[envVar];
  const candidate = envValue ?? fallback;

  if (candidate) {
    console.log(`Using ${envVar}: ${candidate}`);
    return candidate as `0x${string}`;
  }

  const value = await prompt(promptText);
  if (!value) {
    console.error(`\nERROR: ${promptText.replace(": ", "")} is required`);
    process.exit(1);
  }

  return value as `0x${string}`;
}

function parseAssetList(input: string): `0x${string}`[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as `0x${string}`[];
}

async function describeAssetBalance(
  publicClient: any,
  asset: `0x${string}`,
  amount: bigint,
): Promise<string> {
  if (asset.toLowerCase() === zeroAddress.toLowerCase()) {
    return `${formatEther(amount)} ETH`;
  }

  try {
    const token = getContract({
      address: asset,
      abi: erc20Abi,
      client: publicClient,
    });

    const [symbol, decimals] = await Promise.all([
      token.read.symbol(),
      token.read.decimals(),
    ]);

    return `${formatUnits(amount, decimals)} ${symbol}`;
  } catch {
    return `${amount.toString()} (raw units)`;
  }
}

async function main() {
  console.log("\nMetricOMM Factory Fee Collector\n");

  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();

  const defaultFactory = sdk.getAddresses(chainId)?.factory;

  const factoryAddress = await getAddressFromEnvOrPrompt(
    "FACTORY_ADDRESS",
    "Enter factory address: ",
    defaultFactory,
  );

  const target = await getAddressFromEnvOrPrompt(
    "TARGET_ADDRESS",
    `Enter target address (default ${walletClient.account.address}): `,
    walletClient.account.address,
  );

  const assetsInput =
    process.env.ASSETS ??
    (await prompt(
      `Enter comma-separated asset addresses (use ${zeroAddress} for native ETH): `,
    ));

  if (!assetsInput) {
    console.error("\nERROR: ASSETS list is required");
    process.exit(1);
  }

  const assets = parseAssetList(assetsInput);
  if (assets.length === 0) {
    console.error("\nERROR: No assets provided");
    process.exit(1);
  }

  console.log(`\nChain ID: ${chainId}`);
  console.log(`Factory:  ${factoryAddress}`);
  console.log(`Target:   ${target}`);
  console.log(`Signer:   ${walletClient.account.address}`);
  console.log(`Assets:   ${assets.join(", ")}`);

  console.log("\nReading factory balances...\n");

  const balances = await sdk.getFactoryAssetBalances(
    publicClient,
    factoryAddress,
    assets,
  );

  for (const item of balances) {
    const label = await describeAssetBalance(
      publicClient,
      item.asset,
      item.amount,
    );
    console.log(`${item.asset} -> ${label}`);
  }

  const collectable = balances.filter((item) => item.amount > 0n);
  if (collectable.length === 0) {
    console.log("\nNo non-zero balances to collect.\n");
    return;
  }

  console.log(`\n${collectable.length} assets have non-zero balances.`);
  const confirmation = await prompt("Proceed with collection? (yes/no): ");

  if (!["yes", "y"].includes(confirmation.toLowerCase())) {
    console.log("\nCollection cancelled.\n");
    return;
  }

  console.log("\nCollecting fees (one transaction per asset)...\n");

  const result = await sdk.collectFactoryFees({
    publicClient,
    walletClient,
    factoryAddress,
    target,
    assets,
    account: walletClient.account.address,
    awaitReceipts: true,
  });

  if (result.collected.length === 0) {
    console.log("Nothing collected (all listed balances are zero).\n");
    return;
  }

  for (const tx of result.collected) {
    console.log(
      `Collected ${tx.amount.toString()} from ${tx.asset} | tx: ${tx.hash}`,
    );

    if (tx.receipt) {
      console.log(
        `  status: ${tx.receipt.status} | block: ${tx.receipt.blockNumber}`,
      );
    }
  }

  console.log("\nFee collection finished.\n");
}

main().catch((error) => {
  logErrorDetails(error, sdk.MetricOmmPoolFactoryAbi);
  process.exit(1);
});
