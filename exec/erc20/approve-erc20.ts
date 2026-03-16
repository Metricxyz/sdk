/**
 * Approve ERC20 tokens for MetricOmmPool
 *
 * Usage:
 *   npx hardhat run exec/erc20/approve-erc20.ts --network base
 *
 * The script will prompt for:
 *   - Token address to approve
 *   - Spender address (MetricOmmPool address)
 *   - Amount to approve (or "max" for unlimited)
 */

import { network } from "hardhat";

const { viem } = await network.connect();
import { maxUint256, getContract, formatUnits, erc20Abi } from "viem";
import * as readline from "readline";
import { logErrorDetails } from "../../scripts/utils/decodeError.js";

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

const tokenAddress = await prompt("Enter token address: ");
if (!tokenAddress) {
  console.error("\n❌ Token address is required");
  process.exit(1);
}

const spenderAddress = await prompt("Enter spender address (pool): ");
if (!spenderAddress) {
  console.error("\n❌ Spender address is required");
  process.exit(1);
}

const amountArg = await prompt('Enter amount (or "max" for unlimited): ');
if (!amountArg) {
  console.error("\n❌ Amount is required");
  process.exit(1);
}

console.log("\n🔐 Approving ERC20 tokens...\n");

const publicClient = await viem.getPublicClient();
const [walletClient] = await viem.getWalletClients();

const token = getContract({
  address: tokenAddress as `0x${string}`,
  abi: erc20Abi,
  client: { public: publicClient, wallet: walletClient },
});

const [symbol, decimals] = await Promise.all([
  token.read.symbol(),
  token.read.decimals(),
]);

const amount =
  amountArg.toLowerCase() === "max" ? maxUint256 : BigInt(amountArg);

console.log(`Token:   ${symbol} (${tokenAddress})`);
console.log(`Spender: ${spenderAddress}`);
console.log(
  `Amount:  ${amountArg.toLowerCase() === "max" ? "MAX (unlimited)" : formatUnits(amount, decimals)}`,
);
console.log(`Account: ${walletClient.account.address}`);
console.log();

const currentAllowance = await token.read.allowance([
  walletClient.account.address,
  spenderAddress as `0x${string}`,
]);
console.log(
  `Current allowance: ${formatUnits(currentAllowance, decimals)} ${symbol}`,
);

if (currentAllowance >= amount) {
  console.log(
    "\n✅ Sufficient allowance already exists. No approval needed.\n",
  );
  process.exit(0);
}

// Simulate the transaction first
console.log("\n🔍 Simulating approval transaction...");
try {
  await token.simulate.approve([spenderAddress as `0x${string}`, amount]);
  console.log("✅ Simulation successful\n");
} catch (error: any) {
  logErrorDetails(error, erc20Abi);
  process.exit(1);
}

console.log("📝 Sending approval transaction...");
const hash = await token.write.approve([
  spenderAddress as `0x${string}`,
  amount,
]);
console.log(`Transaction hash: ${hash}`);

console.log("⏳ Waiting for confirmation...");
const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.status === "success") {
  console.log(`\n✅ Approval successful! Block: ${receipt.blockNumber}\n`);
} else {
  console.log("\n❌ Approval failed!\n");
  process.exit(1);
}
