/**
 * Wrap ETH to WETH
 *
 * Usage:
 *   npx hardhat run exec/erc20/wrap-eth.ts --network base
 *
 * The script will prompt for:
 *   - Amount of ETH to wrap (in ETH, e.g., "0.1")
 */

import { network } from "hardhat";

const { viem } = await network.connect();
import { getContract, parseEther, formatEther } from "viem";
import * as readline from "readline";
import { logErrorDetails } from "../../scripts/utils/decodeError.js";

const WETH_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "src", type: "address" },
      { indexed: true, internalType: "address", name: "guy", type: "address" },
      { indexed: false, internalType: "uint256", name: "wad", type: "uint256" },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "dst", type: "address" },
      { indexed: false, internalType: "uint256", name: "wad", type: "uint256" },
    ],
    name: "Deposit",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "src", type: "address" },
      { indexed: true, internalType: "address", name: "dst", type: "address" },
      { indexed: false, internalType: "uint256", name: "wad", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "src", type: "address" },
      { indexed: false, internalType: "uint256", name: "wad", type: "uint256" },
    ],
    name: "Withdrawal",
    type: "event",
  },
  {
    payable: true,
    stateMutability: "payable",
    type: "fallback",
  },
  {
    constant: true,
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { internalType: "address", name: "guy", type: "address" },
      { internalType: "uint256", name: "wad", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [],
    name: "deposit",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { internalType: "address", name: "dst", type: "address" },
      { internalType: "uint256", name: "wad", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { internalType: "address", name: "src", type: "address" },
      { internalType: "address", name: "dst", type: "address" },
      { internalType: "uint256", name: "wad", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [{ internalType: "uint256", name: "wad", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

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

const amountStr = await prompt("Enter amount of ETH to wrap: ");
if (!amountStr) {
  console.error("\n❌ Amount is required");
  process.exit(1);
}

const amount = parseEther(amountStr);

console.log("\n🔄 Wrapping ETH to WETH...\n");

const publicClient = await viem.getPublicClient();
const [walletClient] = await viem.getWalletClients();

const wethAddress = await prompt("Enter WETH address: ");
if (!wethAddress) {
  console.error("\n❌ WETH address is required");
  process.exit(1);
}

const weth = getContract({
  address: wethAddress as `0x${string}`,
  abi: WETH_ABI,
  client: { public: publicClient, wallet: walletClient },
});

// Get current balances
const [ethBalance, wethBalance] = await Promise.all([
  publicClient.getBalance({ address: walletClient.account.address }),
  weth.read.balanceOf([walletClient.account.address]),
]);

console.log("Account Information:");
console.log("-".repeat(50));
console.log(`Account:      ${walletClient.account.address}`);
console.log(`ETH Balance:  ${formatEther(ethBalance)} ETH`);
console.log(`WETH Balance: ${formatEther(wethBalance)} WETH`);
console.log();

console.log("Wrap Parameters:");
console.log("-".repeat(50));
console.log(`Amount:       ${formatEther(amount)} ETH`);
console.log(`WETH Address: ${wethAddress}`);
console.log();

if (ethBalance < amount) {
  console.error(
    `\n❌ Insufficient ETH balance. Have ${formatEther(ethBalance)}, need ${formatEther(amount)}\n`,
  );
  process.exit(1);
}

// Simulate the transaction first
console.log("🔍 Simulating deposit transaction...");
try {
  await weth.simulate.deposit({ value: amount });
  console.log("✅ Simulation successful\n");
} catch (error: any) {
  logErrorDetails(error, WETH_ABI);
  process.exit(1);
}

console.log("📝 Sending deposit transaction...");
const hash = await weth.write.deposit({ value: amount });
console.log(`Transaction hash: ${hash}`);

console.log("⏳ Waiting for confirmation...");
const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.status === "success") {
  console.log(`\n✅ ETH wrapped successfully! Block: ${receipt.blockNumber}`);

  // Get new balances
  const [newEthBalance, newWethBalance] = await Promise.all([
    publicClient.getBalance({ address: walletClient.account.address }),
    weth.read.balanceOf([walletClient.account.address]),
  ]);

  console.log("\nBalances After:");
  console.log("-".repeat(50));
  console.log(
    `ETH:  ${formatEther(newEthBalance)} (${formatEther(newEthBalance - ethBalance)})`,
  );
  console.log(
    `WETH: ${formatEther(newWethBalance)} (+${formatEther(newWethBalance - wethBalance)})`,
  );
  console.log();
} else {
  console.log("\n❌ Transaction failed!\n");
  process.exit(1);
}
