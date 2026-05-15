import { network } from "hardhat";

/**
 * Verifies that each configured RPC endpoint returns the expected chain ID.
 * Iterates through all 7 target chains using network.connect().
 *
 * Usage:
 *   npx hardhat run scripts/verify-rpcs.ts
 */

const CHAINS: { name: string; expectedChainId: number }[] = [
  { name: "ethereum", expectedChainId: 1 },
  { name: "arbitrum", expectedChainId: 42161 },
  { name: "base", expectedChainId: 8453 },
  { name: "megaeth", expectedChainId: 4326 },
  { name: "bnb", expectedChainId: 56 },
  { name: "avalanche", expectedChainId: 43114 },
  { name: "polygon", expectedChainId: 137 },
];

console.log("Verifying RPC endpoints...\n");

let allPassed = true;

for (const chain of CHAINS) {
  try {
    const { viem } = await network.connect(chain.name);
    const publicClient = await viem.getPublicClient();
    const chainId = await publicClient.getChainId();

    if (chainId === chain.expectedChainId) {
      console.log(`✅ ${chain.name.padEnd(12)} — chain ID ${chainId} (correct)`);
    } else {
      console.log(
        `❌ ${chain.name.padEnd(12)} — expected ${chain.expectedChainId}, got ${chainId}`,
      );
      allPassed = false;
    }
  } catch (error: any) {
    console.log(`❌ ${chain.name.padEnd(12)} — ${error.message ?? error}`);
    allPassed = false;
  }
}

console.log(allPassed ? "\nAll RPCs verified ✅" : "\nSome checks failed ❌");
process.exit(allPassed ? 0 : 1);
