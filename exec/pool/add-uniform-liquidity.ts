/**
 * Add uniform liquidity to MetricOmmPool directly
 *
 * Usage:
 *   npx hardhat run exec/pool/add-uniform-liquidity.ts --network ethereum
 *
 * Environment variables (optional, will prompt if not set):
 *   POOL_ADDRESS - Pool contract address
 *
 * Distributes liquidity uniformly (by value) across a range of bins
 */
// @ts-nocheck - viem version mismatch between hardhat and sdk

import { network } from "hardhat";
import { formatUnits, parseUnits, erc20Abi, getContract } from "viem";
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
  console.log("\n💧 MetricOMM Uniform Liquidity Distribution\n");

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
  const poolAddress = await getAddressFromEnvOrPrompt("POOL_ADDRESS", "Enter pool address: ");

  // Read pool info using SDK
  console.log("\n📊 Reading pool information...\n");

  const immutables = await sdk.getPoolImmutables(publicClient, poolAddress);
  const slot0 = await sdk.getSlot0(publicClient, addresses.stateView, poolAddress);

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
  console.log(`Bin Range:       ${immutables.lowestBin} to ${immutables.highestBin}`);
  console.log();

  // Get salt for position
  const saltStr = await prompt(
    "Enter position salt (default: 0, use different salts for separate positions): ",
  );
  const salt = saltStr ? BigInt(saltStr) : 0n;

  // Get uniform liquidity parameters
  console.log("\n💧 Configure Uniform Liquidity Distribution:\n");

  const lowerBinStr = await prompt(
    `Enter lower bin index (pool range: ${immutables.lowestBin} to ${immutables.highestBin}, current: ${slot0.curBinIdx}): `,
  );
  const lowerBin = parseInt(lowerBinStr);

  const upperBinStr = await prompt(`Enter upper bin index: `);
  const upperBin = parseInt(upperBinStr);

  if (lowerBin > upperBin) {
    console.error("\n❌ Lower bin must be <= upper bin");
    process.exit(1);
  }

  const numBins = upperBin - lowerBin + 1;
  console.log(`\nDistributing across ${numBins} bins (${lowerBin} to ${upperBin})`);

  const amountTokenStr = await prompt(
    `Which token to specify amount in? (0 for ${symbol0}, 1 for ${symbol1}): `,
  );
  const amountIsInToken0 = amountTokenStr !== "1";
  const amountToken = amountIsInToken0 ? symbol0 : symbol1;
  const amountDecimals = amountIsInToken0 ? decimals0 : decimals1;

  const amountPerBinStr = await prompt(
    `Enter amount of ${amountToken} PER BIN (will be distributed to each of ${numBins} bins): `,
  );
  const amountPerBin = parseUnits(amountPerBinStr, amountDecimals);

  const priceStr = await prompt(
    `Enter current price (${symbol0}/${symbol1}, e.g., 3300 means 1 ${symbol0} = 3300 ${symbol1}): `,
  );
  const currentPrice = parseFloat(priceStr);

  // Calculate uniform distribution using SDK
  console.log("\n⏳ Calculating uniform liquidity distribution...\n");

  const [preparedSalt, deltas, specAmount0, specAmount1] =
    await sdk.buildModifyLiquidityArgsForUniformAddition({
      publicClient,
      stateViewAddress: addresses.stateView,
      poolAddress,
      salt,
      amountInTokensPerBin: amountPerBin,
      amountIsInToken0,
      currentPrice,
      lowerBin,
      upperBin,
    });

  console.log("📝 Liquidity Configuration:");
  console.log("-".repeat(60));
  console.log(`Salt:            ${preparedSalt}`);
  console.log(`Bin Range:       ${lowerBin} to ${upperBin} (${numBins} bins)`);
  console.log(`Amount per bin:  ${amountPerBinStr} ${amountToken}`);
  console.log(`\nEstimated Total Tokens Required:`);
  console.log(`  ${symbol0}: ${formatUnits(specAmount0, decimals0)}`);
  console.log(`  ${symbol1}: ${formatUnits(specAmount1, decimals1)}`);
  console.log();

  // Optional: specify custom approve amounts
  const approveToken0Str = await prompt(
    `Approve amount for ${symbol0} (leave empty to use max, or enter amount): `,
  );
  const approveToken1Str = await prompt(
    `Approve amount for ${symbol1} (leave empty to use max, or enter amount): `,
  );

  const approveAmount0 = approveToken0Str
    ? parseUnits(approveToken0Str, decimals0)
    : sdk.MAX_UINT128;
  const approveAmount1 = approveToken1Str
    ? parseUnits(approveToken1Str, decimals1)
    : sdk.MAX_UINT128;

  // Check balances
  const [balance0, balance1] = await Promise.all([
    token0.read.balanceOf([account]),
    token1.read.balanceOf([account]),
  ]);

  console.log("Current Balances:");
  console.log("-".repeat(60));
  console.log(`${symbol0}: ${formatUnits(balance0, decimals0)}`);
  console.log(`${symbol1}: ${formatUnits(balance1, decimals1)}`);

  if (balance0 < specAmount0 || balance1 < specAmount1) {
    console.error("\n❌ Insufficient balance!");
    if (balance0 < specAmount0) {
      console.error(`  Need ${formatUnits(specAmount0 - balance0, decimals0)} more ${symbol0}`);
    }
    if (balance1 < specAmount1) {
      console.error(`  Need ${formatUnits(specAmount1 - balance1, decimals1)} more ${symbol1}`);
    }
    process.exit(1);
  }
  console.log();

  // Check/request approvals for the pool directly
  const [allowance0, allowance1] = await Promise.all([
    token0.read.allowance([account, poolAddress]),
    token1.read.allowance([account, poolAddress]),
  ]);

  if (allowance0 < (specAmount0 * 11n) / 10n) {
    const approveDisplay =
      approveAmount0 === sdk.MAX_UINT128 ? "max" : formatUnits(approveAmount0, decimals0);
    console.log(`⚠️  Approving ${symbol0} (${approveDisplay}) for pool...`);
    const hash = await token0.write.approve([poolAddress, approveAmount0]);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ ${symbol0} approved\n`);
  }

  if (allowance1 < (specAmount1 * 11n) / 10n) {
    const approveDisplay =
      approveAmount1 === sdk.MAX_UINT128 ? "max" : formatUnits(approveAmount1, decimals1);
    console.log(`⚠️  Approving ${symbol1} (${approveDisplay}) for pool...`);
    const hash = await token1.write.approve([poolAddress, approveAmount1]);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ ${symbol1} approved\n`);
  }

  // Confirm
  const confirm = await prompt("Proceed with transaction? (yes/no): ");
  if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
    console.log("Cancelled.");
    process.exit(0);
  }

  // Execute transaction using SDK's modifyLiquidity
  console.log("\n🚀 Executing transaction...\n");

  try {
    const specAmount0WithBuffer = (specAmount0 * 101n) / 100n;
    const specAmount1WithBuffer = (specAmount1 * 101n) / 100n;
    const hash = await walletClient.sendTransaction({
      account,
      to: poolAddress,
      data: sdk.encodeModifyLiquidityCalldata([
        preparedSalt,
        deltas,
        specAmount0WithBuffer,
        specAmount1WithBuffer,
      ]),
    });

    console.log(`Adding liquidity with ${deltas.length} bin deltas...`);
    console.log(`Transaction hash: ${hash}`);
    console.log("⏳ Waiting for confirmation...\n");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("✅ Transaction successful!\n");
      console.log(`Gas used: ${receipt.gasUsed}`);

      // Show updated balances
      const [newBalance0, newBalance1] = await Promise.all([
        token0.read.balanceOf([account]),
        token1.read.balanceOf([account]),
      ]);

      console.log("\n📊 Results:");
      console.log("-".repeat(60));
      console.log(`Position salt: ${salt}`);
      console.log(`Position owner: ${account}`);

      console.log("\nTokens Used:");
      console.log(`  ${symbol0}: ${formatUnits(balance0 - newBalance0, decimals0)}`);
      console.log(`  ${symbol1}: ${formatUnits(balance1 - newBalance1, decimals1)}`);

      console.log("\nBalances After:");
      console.log(`  ${symbol0}: ${formatUnits(newBalance0, decimals0)}`);
      console.log(`  ${symbol1}: ${formatUnits(newBalance1, decimals1)}`);
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
