/**
 * Remove liquidity from MetricOmmPool directly
 *
 * Usage:
 *   npx hardhat run scripts/actions/remove-liquidity.ts --network ethereum
 *
 * Environment variables (optional, will prompt if not set):
 *   POOL_ADDRESS - Pool contract address
 *
 * Removes a percentage of liquidity from a salt-based position
 */
// @ts-nocheck - viem version mismatch between hardhat and sdk

import { network } from "hardhat";
import { formatUnits, erc20Abi, getContract } from "viem";
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
    console.error(`\n❌ ${promptText.replace(": ", "")} is required`);
    process.exit(1);
  }
  return value as `0x${string}`;
}

async function main() {
  console.log("\n🔥 MetricOMM Remove Liquidity\n");

  // Get clients
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const account = walletClient.account.address;

  // Get chain-specific addresses from SDK
  const chainId = await publicClient.getChainId();
  const addresses = sdk.getAddressesOrThrow(chainId);
  console.log(`Chain ID: ${chainId}`);
  console.log(`StateView: ${addresses.stateView}`);
  console.log(`Factory: ${addresses.factory}\n`);

  // Get pool address from env or prompt
  const poolAddress = await getAddressFromEnvOrPrompt(
    "POOL_ADDRESS",
    "Enter pool address: ",
  );

  // Read pool info using SDK
  console.log("📊 Reading pool information...\n");

  const immutables = await sdk.getPoolImmutables(publicClient, poolAddress);
  const slot0 = await sdk.getSlot0(
    publicClient,
    addresses.stateView,
    poolAddress,
  );

  // Get token info
  const token0 = getContract({
    address: immutables.token0,
    abi: erc20Abi,
    client: { public: publicClient, wallet: walletClient },
  });

  const token1 = getContract({
    address: immutables.token1,
    abi: erc20Abi,
    client: { public: publicClient, wallet: walletClient },
  });

  const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
    token0.read.symbol(),
    token1.read.symbol(),
    token0.read.decimals(),
    token1.read.decimals(),
  ]);

  console.log("Pool Information:");
  console.log("-".repeat(60));
  console.log(`Pool:            ${poolAddress}`);
  console.log(`Token0:          ${symbol0} (${immutables.token0})`);
  console.log(`Token1:          ${symbol1} (${immutables.token1})`);
  console.log(`Current Bin:     ${slot0.curBinIdx}`);
  console.log(
    `Bin Range:       ${immutables.lowestBin} to ${immutables.highestBin}`,
  );
  console.log();

  // Get salt from user
  const saltStr = await prompt("Enter position salt (default: 0): ");
  const salt = saltStr ? BigInt(saltStr) : 0n;

  // Define scan range based on pool's bin range
  const scanLower = immutables.lowestBin;
  const scanUpper = immutables.highestBin;

  console.log(
    `\n🔍 Scanning position shares for bins ${scanLower} to ${scanUpper}...\n`,
  );

  // Query position shares using SDK
  const positionShares = await sdk.getPositionShares(
    publicClient,
    addresses.stateView,
    poolAddress,
    account,
    salt,
    scanLower,
    scanUpper,
  );

  if (positionShares.length === 0) {
    console.error("❌ No position shares found in the pool's bin range");
    console.log("   The position may be empty or use a different salt.");
    process.exit(1);
  }

  console.log(`Found shares in ${positionShares.length} bins:\n`);
  console.log("Bin".padStart(6) + " | " + "Shares".padStart(25));
  console.log("-".repeat(35));
  for (const { binIdx, shares } of positionShares) {
    console.log(
      binIdx.toString().padStart(6) + " | " + shares.toString().padStart(25),
    );
  }
  console.log();

  // Get percentage to redeem
  const percentToRedeemStr = await prompt(
    "Enter percentage to redeem (100 = 100%, 50 = 50%): ",
  );
  if (!percentToRedeemStr) {
    console.error("\n❌ Percentage is required");
    process.exit(1);
  }
  const percentToRedeem = parseFloat(percentToRedeemStr);
  if (percentToRedeem <= 0 || percentToRedeem > 100) {
    console.error("\n❌ Percentage must be between 0 and 100");
    process.exit(1);
  }

  // Calculate shares to redeem
  console.log(
    `\n📝 Calculating ${percentToRedeem}% of position to redeem...\n`,
  );

  const deltas: sdk.LiquidityDelta[] = [];

  for (const { binIdx, shares } of positionShares) {
    // Calculate shares to remove (negative delta)
    const sharesToRemove =
      (shares * BigInt(Math.floor(percentToRedeem * 10000))) / 1000000n;
    if (sharesToRemove > 0n) {
      deltas.push({
        bin: binIdx,
        deltaShares: -sharesToRemove, // Negative for removal
      });
    }
  }

  if (deltas.length === 0) {
    console.error("❌ No shares to redeem (percentage too small?)");
    process.exit(1);
  }

  console.log("Liquidity Deltas (negative = removal):");
  console.log("-".repeat(50));
  for (const delta of deltas) {
    console.log(`  Bin ${delta.bin}: ${delta.deltaShares.toString()} shares`);
  }
  console.log();

  // Check current balances
  const [balance0Before, balance1Before] = await Promise.all([
    token0.read.balanceOf([account]),
    token1.read.balanceOf([account]),
  ]);

  console.log("Current Balances:");
  console.log("-".repeat(60));
  console.log(`${symbol0}: ${formatUnits(balance0Before, decimals0)}`);
  console.log(`${symbol1}: ${formatUnits(balance1Before, decimals1)}`);
  console.log();

  // Confirm
  const confirm = await prompt("Proceed with liquidity removal? (yes/no): ");
  if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
    console.log("Cancelled.");
    process.exit(0);
  }

  // Execute transaction using SDK's modifyLiquidity directly on pool
  console.log("\n🚀 Executing transaction...\n");

  try {
    // For removal, we use negative specAmounts (minimum tokens to receive)
    // Using 0n means we accept any amount back (no slippage protection)
    const { hash, amount0Delta, amount1Delta } = await sdk.modifyLiquidity(
      publicClient,
      walletClient,
      poolAddress,
      salt,
      deltas,
      account,
      0n, // specAmount0 - no minimum for removal
      0n, // specAmount1 - no minimum for removal
    );

    console.log(`Transaction hash: ${hash}`);
    console.log("⏳ Waiting for confirmation...\n");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("✅ Transaction successful!\n");
      console.log(`Gas used: ${receipt.gasUsed}`);

      // Show updated balances
      const [balance0After, balance1After] = await Promise.all([
        token0.read.balanceOf([account]),
        token1.read.balanceOf([account]),
      ]);

      console.log("\n📊 Results:");
      console.log("-".repeat(60));
      console.log(`Removed ${percentToRedeem}% of position (salt: ${salt})`);

      console.log("\nTokens Received:");
      console.log(
        `  ${symbol0}: ${formatUnits(balance0After - balance0Before, decimals0)}`,
      );
      console.log(
        `  ${symbol1}: ${formatUnits(balance1After - balance1Before, decimals1)}`,
      );

      console.log("\nBalances After:");
      console.log(`  ${symbol0}: ${formatUnits(balance0After, decimals0)}`);
      console.log(`  ${symbol1}: ${formatUnits(balance1After, decimals1)}`);
      console.log();
    } else {
      console.log("❌ Transaction failed");
    }
  } catch (error: any) {
    console.error("\n❌ Transaction failed:");
    console.error(error.message);

    if (error.cause) {
      console.error("\nCause:", error.cause);
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
