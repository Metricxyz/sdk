/**
 * Quote a swap on MetricOmmPool without executing it.
 *
 * Usage:
 *   npx hardhat run exec/router/quote-swap.ts --network base
 *   npx hardhat run exec/router/quote-swap.ts --network arbitrum
 *
 * Environment variables:
 *   POOL_ADDRESS - Pool contract address (optional, will prompt)
 */
// @ts-nocheck - viem version mismatch between hardhat and sdk

import { network } from "hardhat";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import * as readline from "readline";
import * as sdk from "../../index.js";

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

async function main() {
  console.log("\nMetricOMM Swap Quoter\n");

  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  const addresses = sdk.getAddressesOrThrow(chainId);

  let poolAddress = process.env.POOL_ADDRESS as `0x${string}` | undefined;
  if (!poolAddress) {
    const input = await prompt("Enter pool address: ");
    if (!input) {
      console.error("ERROR: Pool address is required");
      process.exit(1);
    }
    poolAddress = input as `0x${string}`;
  }

  const immutables = await sdk.getPoolImmutables(publicClient, poolAddress);

  const [symbol0, decimals0, symbol1, decimals1] = await Promise.all([
    publicClient.readContract({ address: immutables.token0, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: immutables.token0, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: immutables.token1, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: immutables.token1, abi: erc20Abi, functionName: "decimals" }),
  ]);

  console.log(`Token0: ${symbol0} (${immutables.token0})`);
  console.log(`Token1: ${symbol1} (${immutables.token1})\n`);

  const directionStr = await prompt(`Direction? (0 = ${symbol0}->${symbol1}, 1 = ${symbol1}->${symbol0}): `);
  const zeroForOne = directionStr === "0" || directionStr.toLowerCase().startsWith("0");

  const inputToken = zeroForOne ? symbol0 : symbol1;
  const outputToken = zeroForOne ? symbol1 : symbol0;
  const inputDecimals = zeroForOne ? decimals0 : decimals1;
  const outputDecimals = zeroForOne ? decimals1 : decimals0;

  const typeStr = await prompt("Type? (0 = exact-in, 1 = exact-out, default: exact-in): ");
  const isExactInput = typeStr !== "1";

  const amountStr = await prompt(`Amount (${isExactInput ? inputToken : outputToken}): `);
  if (!amountStr) {
    console.error("ERROR: Amount is required");
    process.exit(1);
  }

  const amount = parseUnits(amountStr, isExactInput ? inputDecimals : outputDecimals);
  const amountSpecified = isExactInput ? amount : -amount;

  const quote = await sdk.quoteSwap({
    publicClient,
    routerAddress: addresses.router,
    pool: poolAddress,
    zeroForOne,
    amountSpecified,
  });

  console.log("\nQuote");
  console.log("=".repeat(40));
  console.log(`Direction:  ${inputToken} -> ${outputToken}`);
  console.log(`Type:       ${isExactInput ? "Exact input" : "Exact output"}`);
  console.log(`Amount in:  ${formatUnits(quote.amountIn, inputDecimals)} ${inputToken}`);
  console.log(`Amount out: ${formatUnits(quote.amountOut, outputDecimals)} ${outputToken}`);
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
