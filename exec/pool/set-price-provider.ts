/**
 * Set Price Provider for MetricOmmPool
 *
 * Usage:
 *   npx hardhat run exec/pool/set-price-provider.ts --network base
 *
 * The script will prompt for:
 *   - Pool address (MetricOmmPool address)
 *   - New price provider address
 */

import { network } from "hardhat";

const { viem } = await network.connect();
import * as readline from "readline";
import * as sdk from "../../index.js";
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

const poolAddress = await prompt("Enter pool address: ");
if (!poolAddress) {
  console.error("\n❌ Pool address is required");
  process.exit(1);
}

const newPriceProvider = await prompt("Enter new price provider address: ");
if (!newPriceProvider) {
  console.error("\n❌ Price provider address is required");
  process.exit(1);
}

console.log("\n🔧 Setting Price Provider for MetricOmmPool...\n");

const publicClient = await viem.getPublicClient();
const [walletClient] = await viem.getWalletClients();

// Get chain ID and addresses
const chainId = await publicClient.getChainId();
const addresses = sdk.getAddressesOrThrow(chainId);

// Read pool state via StateView/EXTSLOAD
const feeConfig = await sdk.getFeeConfig(
  publicClient,
  addresses.stateView,
  poolAddress as `0x${string}`,
);
const currentPriceProvider = await sdk.getPriceProvider(
  publicClient,
  addresses.stateView,
  poolAddress as `0x${string}`,
);

console.log("Pool Information:");
console.log("-".repeat(50));
console.log(`Pool:                  ${poolAddress}`);
console.log(`Current Price Provider: ${currentPriceProvider}`);
console.log(`Current Admin:         ${feeConfig.adminAddr}`);
console.log();

console.log("Wallet Information:");
console.log("-".repeat(50));
console.log(`Wallet Address:        ${walletClient.account.address}`);
console.log();

if (
  walletClient.account.address.toLowerCase() !==
  feeConfig.adminAddr.toLowerCase()
) {
  console.error("❌ Error: Wallet is not the admin of this pool!");
  console.error(`   Expected admin: ${feeConfig.adminAddr}`);
  console.error(`   Current wallet: ${walletClient.account.address}`);
  process.exit(1);
}

console.log("✅ Wallet is verified as admin\n");

console.log("New Settings:");
console.log("-".repeat(50));
console.log(`New Price Provider:    ${newPriceProvider}`);
console.log();

// Simulate the transaction first
console.log("🔍 Simulating setPriceProvider transaction...");
let request;
try {
  const simulated = await publicClient.simulateContract({
    address: poolAddress as `0x${string}`,
    abi: sdk.MetricOmmPoolAbi,
    functionName: "setPriceProvider",
    args: [newPriceProvider as `0x${string}`],
    account: walletClient.account.address,
  });
  request = simulated.request;
  console.log("✅ Simulation successful\n");
} catch (error: any) {
  logErrorDetails(error, sdk.MetricOmmPoolAbi);
  process.exit(1);
}

// Send setPriceProvider transaction
console.log("📝 Sending setPriceProvider transaction...");
const hash = await walletClient.writeContract(request);
console.log(`Transaction hash: ${hash}`);

// Wait for confirmation
console.log("⏳ Waiting for confirmation...");
const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.status === "success") {
  console.log(
    `\n✅ Price provider updated successfully! Block: ${receipt.blockNumber}`,
  );

  // Verify the change
  const updatedPriceProvider = await sdk.getPriceProvider(
    publicClient,
    addresses.stateView,
    poolAddress as `0x${string}`,
  );
  console.log("\nVerification:");
  console.log("-".repeat(50));
  console.log(`New Price Provider: ${updatedPriceProvider}`);
  console.log();
} else {
  console.log("\n❌ Transaction failed!\n");
  process.exit(1);
}
