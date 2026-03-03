/**
 * Perform a swap on MetricOmmPool using SDK
 *
 * Usage:
 *   npx hardhat run scripts/actions/swap.ts --network ethereum
 *
 * Environment variables (optional, will prompt if not set):
 *   POOL_ADDRESS - Pool contract address
 *
 * Supports both exact input and exact output swaps via the router
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
  console.log("\n🔄 MetricOMM Swap Tool\n");

  // Get clients
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const account = walletClient.account.address;

  // Get chain-specific addresses from SDK
  const chainId = await publicClient.getChainId();
  const addresses = sdk.getAddressesOrThrow(chainId);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Router: ${addresses.router}`);
  console.log(`StateView: ${addresses.stateView}\n`);

  // Get pool address from env or prompt
  const poolAddress = await getAddressFromEnvOrPrompt(
    "POOL_ADDRESS",
    "Enter pool address: ",
  );

  // Read pool info using SDK
  console.log("\n📊 Reading pool information...\n");

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

  // Get swap parameters
  const directionStr = await prompt(
    `Swap direction? (0 for ${symbol0}->${symbol1}, 1 for ${symbol1}->${symbol0}): `,
  );
  const zeroForOne =
    directionStr === "0" || directionStr.toLowerCase().includes("zero");

  const inputToken = zeroForOne ? symbol0 : symbol1;
  const outputToken = zeroForOne ? symbol1 : symbol0;
  const inputDecimals = zeroForOne ? decimals0 : decimals1;
  const outputDecimals = zeroForOne ? decimals1 : decimals0;
  const inputTokenAddress = zeroForOne ? immutables.token0 : immutables.token1;

  const typeStr = await prompt(
    "Swap type? (0 for exact-in, 1 for exact-out, default: exact-in): ",
  );
  const isExactInput = typeStr !== "1";

  const amountStr = await prompt(
    `Enter ${isExactInput ? "input" : "output"} amount (${isExactInput ? inputToken : outputToken}): `,
  );
  if (!amountStr) {
    console.error("\n❌ Amount is required");
    process.exit(1);
  }
  const amount = parseUnits(
    amountStr,
    isExactInput ? inputDecimals : outputDecimals,
  );

  const slippageStr = await prompt("Slippage tolerance % (default: 0.5): ");
  const slippagePercent = slippageStr ? parseFloat(slippageStr) : 0.5;

  // Use no explicit price limit override; SDK handles sensible defaults
  const priceLimitX64 = zeroForOne ? 0n : sdk.MAX_UINT128;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes

  let requiredAmount: bigint;
  let requiredAllowance: bigint;
  let expectedInput: bigint;
  let expectedOutput: bigint;
  let swapCalldata: `0x${string}`;

  if (isExactInput) {
    const built = await sdk.buildArgsAndExpectedAmountsForSwapExactInput({
      publicClient,
      routerAddress: addresses.router,
      pool: poolAddress,
      recipient: account,
      zeroForOne,
      amountIn: amount,
      slippagePercent,
      priceLimitX64,
      deadline,
    });
    requiredAmount = amount;
    requiredAllowance = amount;
    expectedInput = built.expectedInput;
    expectedOutput = built.expectedOutput;
    swapCalldata = sdk.prepareSwapExactInputCalldata(built.args);
  } else {
    const built = await sdk.buildArgsAndExpectedAmountsForSwapExactOutput({
      publicClient,
      routerAddress: addresses.router,
      pool: poolAddress,
      recipient: account,
      zeroForOne,
      amountOut: amount,
      slippagePercent,
      priceLimitX64,
      deadline,
    });
    requiredAmount = built.args[5]; // maxAmountIn
    requiredAllowance = built.args[5];
    expectedInput = built.expectedInput;
    expectedOutput = built.expectedOutput;
    swapCalldata = sdk.prepareSwapExactOutputCalldata(built.args);
  }

  console.log("\n📝 Swap Parameters:");
  console.log("-".repeat(60));
  console.log(`Direction:       ${inputToken} -> ${outputToken}`);
  console.log(
    `Type:            ${isExactInput ? "Exact Input" : "Exact Output"}`,
  );
  console.log(
    `Amount:          ${formatUnits(amount, isExactInput ? inputDecimals : outputDecimals)} ${isExactInput ? inputToken : outputToken}`,
  );
  console.log(`Slippage:        ${slippagePercent}%`);
  console.log(
    `Expected Input:  ${formatUnits(expectedInput, inputDecimals)} ${inputToken}`,
  );
  console.log(
    `Expected Output: ${formatUnits(expectedOutput, outputDecimals)} ${outputToken}`,
  );
  console.log();

  // Check balances
  const [balance0, balance1] = await Promise.all([
    token0.read.balanceOf([account]),
    token1.read.balanceOf([account]),
  ]);

  console.log("Current Balances:");
  console.log("-".repeat(60));
  console.log(`${symbol0}: ${formatUnits(balance0, decimals0)}`);
  console.log(`${symbol1}: ${formatUnits(balance1, decimals1)}`);
  console.log();

  // Check input balance
  const inputBalance = zeroForOne ? balance0 : balance1;

  if (requiredAmount > 0n && inputBalance < requiredAmount) {
    console.error(`\n❌ Insufficient ${inputToken} balance!`);
    console.error(`  Have: ${formatUnits(inputBalance, inputDecimals)}`);
    console.error(`  Need: ${formatUnits(requiredAmount, inputDecimals)}`);

    process.exit(1);
  }

  // Check/request approval for router
  const inputTokenContract = getContract({
    address: inputTokenAddress,
    abi: erc20Abi,
    client: { public: publicClient, wallet: walletClient },
  });

  const allowance = await inputTokenContract.read.allowance([
    account,
    addresses.router,
  ]);

  if (allowance < requiredAllowance) {
    console.log(
      `⚠️  Insufficient allowance. Approving ${inputToken} for router...`,
    );
    const approveHash = await inputTokenContract.write.approve([
      addresses.router,
      sdk.MAX_UINT128,
    ]);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log(`✅ ${inputToken} approved\n`);
  }

  // Confirm
  const confirm = await prompt("Proceed with swap? (yes/no): ");
  if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
    console.log("Cancelled.");
    process.exit(0);
  }

  console.log("\n🚀 Executing swap...\n");

  try {
    const hash = await walletClient.sendTransaction({
      account,
      to: addresses.router,
      data: swapCalldata,
    });

    console.log(`Transaction hash: ${hash}`);
    console.log("⏳ Waiting for confirmation...\n");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("✅ Swap successful!\n");
      console.log(`Gas used: ${receipt.gasUsed}`);

      // Show updated balances
      const [newBalance0, newBalance1] = await Promise.all([
        token0.read.balanceOf([account]),
        token1.read.balanceOf([account]),
      ]);

      console.log("\n📊 Results:");
      console.log("-".repeat(60));

      const delta0 = newBalance0 - balance0;
      const delta1 = newBalance1 - balance1;

      console.log("Token Changes:");
      console.log(
        `  ${symbol0}: ${delta0 >= 0n ? "+" : ""}${formatUnits(delta0, decimals0)}`,
      );
      console.log(
        `  ${symbol1}: ${delta1 >= 0n ? "+" : ""}${formatUnits(delta1, decimals1)}`,
      );

      console.log("\nBalances After:");
      console.log(`  ${symbol0}: ${formatUnits(newBalance0, decimals0)}`);
      console.log(`  ${symbol1}: ${formatUnits(newBalance1, decimals1)}`);

      // Show updated pool state
      const newSlot0 = await sdk.getSlot0(
        publicClient,
        addresses.stateView,
        poolAddress,
      );
      console.log("\nPool State After:");
      console.log(`  Current Bin: ${newSlot0.curBinIdx}`);
      console.log();
    } else {
      console.log("❌ Swap failed");
    }
  } catch (error: any) {
    console.error("\n❌ Swap failed:");
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
