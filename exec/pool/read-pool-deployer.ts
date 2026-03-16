/**
 * Read the poolDeployer address from a MetricOmmPoolFactory contract.
 *
 * Usage:
 *   npx hardhat run exec/pool/read-pool-deployer.ts --network ethereum
 *   npx hardhat run exec/pool/read-pool-deployer.ts --network arbitrum
 *
 * Environment variables (optional):
 *   FACTORY_ADDRESS - Factory contract address (defaults to SDK addresses for the chain)
 */

import { network } from "hardhat";
import { getContract } from "viem";
import * as sdk from "../../index.js";

const { viem } = await network.connect();

const publicClient = await viem.getPublicClient();
const chainId = await publicClient.getChainId();

// Resolve factory address: env override or SDK addresses
const factoryAddress = "0xe22F9fc0f04486dE25ed6CF1800a4a47aFD82e0C";
//   process.env.FACTORY_ADDRESS ?? sdk.getAddresses(chainId)?.factory;

if (!factoryAddress) {
  console.error(
    `No factory address found for chain ${chainId}. Set FACTORY_ADDRESS env var.`,
  );
  process.exit(1);
}

console.log(`Chain ID:        ${chainId}`);
console.log(`Factory address: ${factoryAddress}`);

const factory = getContract({
  address: factoryAddress as `0x${string}`,
  abi: sdk.MetricOmmPoolFactoryAbi,
  client: publicClient,
});

const poolDeployer = await factory.read.poolDeployer();

console.log(`Pool Deployer:   ${poolDeployer}`);
