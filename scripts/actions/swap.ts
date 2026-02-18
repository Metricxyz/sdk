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

const PRICE_PROVIDER_ABI = [
  {
    type: "function",
    name: "getBidAndAskPrice",
    inputs: [],
    outputs: [
      { name: "bid", type: "uint128", internalType: "uint128" },
      { name: "ask", type: "uint128", internalType: "uint128" },
    ],
    stateMutability: "view",
  },
] as const;

// Helper to format Q64 fixed point to human readable
function formatQ64(value: bigint): string {
  const Q64 = 2n ** 64n;
  const integerPart = value / Q64;
  const fractionalPart = value % Q64;
  const fractionalDecimal = Number(fractionalPart) / Number(Q64);
  return (Number(integerPart) + fractionalDecimal).toFixed(6);
}

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

  // Use no price limit (let slippage protection handle it)
  const priceLimitX64 = zeroForOne ? 1n : sdk.MAX_UINT128;

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

  let requiredAmount: bigint;
  if (isExactInput) {
    // For exact input, we need exactly the amount specified
    requiredAmount = amount;
  } else {
    // For exact output, we need to estimate input based on price
    // Query price provider to get a better estimate
    try {
      const priceProviderAddress = await sdk.getPriceProvider(
        publicClient,
        addresses.stateView,
        poolAddress,
      );
      const priceProvider = getContract({
        address: priceProviderAddress,
        abi: PRICE_PROVIDER_ABI,
        client: publicClient,
      });
      const [bidPrice, askPrice] = await priceProvider.read.getBidAndAskPrice();

      // Price is in Q64 format (token1/token0)
      // If zeroForOne (selling token0 for token1): input = output / price
      // If oneForZero (selling token1 for token0): input = output * price
      const Q64 = 2n ** 64n;

      let estimatedInput: bigint;
      if (zeroForOne) {
        // Selling WETH for USDC: need WETH = USDC_amount / price
        // Use bid price (lower) to be conservative
        estimatedInput = (amount * Q64) / bidPrice;
        // Adjust for decimal difference (output is token1 decimals, input is token0 decimals)
        estimatedInput =
          (estimatedInput * BigInt(10 ** decimals0)) / BigInt(10 ** decimals1);
      } else {
        // Selling USDC for WETH: need USDC = WETH_amount * price
        // Use ask price (higher) to be conservative
        estimatedInput = (amount * askPrice) / Q64;
        // Adjust for decimal difference (output is token0 decimals, input is token1 decimals)
        estimatedInput =
          (estimatedInput * BigInt(10 ** decimals1)) / BigInt(10 ** decimals0);
      }

      // Add slippage buffer
      requiredAmount =
        estimatedInput +
        (estimatedInput * BigInt(Math.floor(slippagePercent * 100))) / 10000n;
    } catch (e) {
      // If price provider fails, use a very conservative estimate (can't check properly)
      console.log("⚠️  Could not query price provider for balance estimation");
      requiredAmount = 0n; // Skip balance check
    }
  }

  if (requiredAmount > 0n && inputBalance < requiredAmount) {
    console.error(`\n❌ Insufficient ${inputToken} balance!`);
    console.error(`  Have: ${formatUnits(inputBalance, inputDecimals)}`);
    console.error(`  Need: ${formatUnits(requiredAmount, inputDecimals)}`);

    // Query and display price provider info
    try {
      const priceProviderAddress = await sdk.getPriceProvider(
        publicClient,
        addresses.stateView,
        poolAddress,
      );
      console.log(`\n📊 Price Provider Info:`);
      console.log(`  Address: ${priceProviderAddress}`);

      const priceProvider = getContract({
        address: priceProviderAddress,
        abi: PRICE_PROVIDER_ABI,
        client: publicClient,
      });

      const [bidPrice, askPrice] = await priceProvider.read.getBidAndAskPrice();
      console.log(`  Bid Price: ${formatQ64(bidPrice)} ${symbol1}/${symbol0}`);
      console.log(`  Ask Price: ${formatQ64(askPrice)} ${symbol1}/${symbol0}`);
    } catch (e) {
      // Ignore price provider errors
    }

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
  const requiredAllowance = isExactInput ? amount : amount * 2n; // 2x for exact output safety

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

  // Execute swap
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes

  console.log("\n🚀 Executing swap...\n");

  try {
    let hash: `0x${string}`;

    if (isExactInput) {
      // Calculate min output with slippage (estimate based on 1:1 for simplicity)
      const minAmountOut = 0n; // No minimum - rely on price limit

      hash = await sdk.swapExactInput(
        publicClient,
        walletClient,
        addresses.router,
        {
          pool: poolAddress,
          recipient: account,
          zeroForOne,
          amountIn: amount,
          priceLimitX64,
          minAmountOut,
          deadline,
        },
        account,
      );
    } else {
      // Calculate max input with slippage
      const maxAmountIn = sdk.MAX_UINT128; // No maximum - rely on price limit

      hash = await sdk.swapExactOutput(
        publicClient,
        walletClient,
        addresses.router,
        {
          pool: poolAddress,
          recipient: account,
          zeroForOne,
          amountOut: amount,
          priceLimitX64,
          maxAmountIn,
          deadline,
        },
        account,
      );
    }

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
