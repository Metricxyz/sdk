/**
 * Collect protocol fees from one or more MetricOmmPools (minimal, no pre-flight reads).
 *
 * Usage:
 *   POOL_ADDRESSES=0x...,0x... npx hardhat run exec/pool/collect-protocol-fees-minimal.ts --network ethereum
 *
 * Environment variables:
 *   POOL_ADDRESS   - Single pool address
 *   POOL_ADDRESSES - Comma-separated list of pool addresses
 */

import { network } from "hardhat";
import * as sdk from "../../index.js";
import { logErrorDetails } from "../../scripts/utils/decodeError.js";

const { viem } = await network.connect();

async function main() {
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const account = walletClient.account.address;

  const raw = process.env.POOL_ADDRESSES ?? process.env.POOL_ADDRESS;
  if (!raw) {
    console.error("ERROR: set POOL_ADDRESS or POOL_ADDRESSES");
    process.exit(1);
  }

  const pools = raw.split(",").map((a) => a.trim()).filter(Boolean) as `0x${string}`[];

  console.log(`Collecting from ${pools.length} pool(s) on chain ${await publicClient.getChainId()}`);

  for (const pool of pools) {
    console.log(`\nPool: ${pool}`);
    try {
      const { request } = await publicClient.simulateContract({
        address: pool,
        abi: sdk.MetricOmmPoolAbi,
        functionName: "collectProtocolFees",
        account,
      });
      const hash = await walletClient.writeContract(request);
      console.log(`  tx: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  status: ${receipt.status} | block: ${receipt.blockNumber}`);
    } catch (error: any) {
      console.error(`  FAILED:`);
      logErrorDetails(error, sdk.MetricOmmPoolAbi);
    }
  }

  console.log("\nDone.");
}

main().catch((error) => {
  logErrorDetails(error, sdk.MetricOmmPoolAbi);
  process.exit(1);
});
