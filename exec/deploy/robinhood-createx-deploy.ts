/**
 * One-shot Robinhood deployment via CreateX using frozen init codes from dep-02a-base.
 *
 * Factory, PoolDeployer, and StateView use init bytes extracted from the original
 * dep-02a-base Ignition journal. SwapRouter reuses the same creation bytecode but
 * swaps the WETH constructor argument for Robinhood's wrapped native token.
 *
 * Usage:
 *   DRY_RUN=1 npx hardhat run exec/deploy/robinhood-createx-deploy.ts --network robinhood
 *   npx hardhat run exec/deploy/robinhood-createx-deploy.ts --network robinhood
 *
 * Optional environment variables:
 *   DRY_RUN=1                 Print predicted addresses and exit
 *   ROBINHOOD_WETH=0x...      Robinhood WETH (default: 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73)
 *   DEP_02A_JOURNAL=path      dep-02a-base journal.jsonl path
 */
// @ts-nocheck - viem version mismatch between hardhat and sdk

import { network } from "hardhat";
import path from "path";
import { getAddress } from "viem";
import {
  CREATE2_SALT,
  CREATEX_ADDRESS,
  loadDep02aInitCodes,
  predictCreate2Address,
} from "./dep-02a-init-codes.js";
import { MetricOmmPoolFactoryAbi } from "../../src/abis/MetricOmmPoolFactory.js";

const CREATEX_CONTRACT_CREATION_TOPIC =
  "0xb8fda7e00c6b06a2b54e58521bc5894fee35f1090e5a3bb6390bfe2b98b497f7" as const;

const DEFAULT_ROBINHOOD_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const DEFAULT_JOURNAL_PATH = path.join(
  process.cwd(),
  "ignition/deployments/dep-02a-base/journal.jsonl",
);

const CREATEX_DEPLOY_ABI = [
  {
    type: "function",
    name: "deployCreate2",
    stateMutability: "payable",
    inputs: [
      { name: "salt", type: "bytes32" },
      { name: "initCode", type: "bytes" },
    ],
    outputs: [{ name: "newContract", type: "address" }],
  },
] as const;

async function getCodeSize(publicClient: any, address: string): Promise<number> {
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") {
    return 0;
  }
  return (code.length - 2) / 2;
}

async function waitForCode(
  publicClient: any,
  address: string,
  attempts = 8,
  delayMs = 1500,
): Promise<number> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const codeSize = await getCodeSize(publicClient, address);
    if (codeSize > 0) {
      return codeSize;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return 0;
}

function parseCreateXDeployedAddress(receipt: any): `0x${string}` | undefined {
  for (const log of receipt.logs) {
    if (
      log.address?.toLowerCase() !== CREATEX_ADDRESS.toLowerCase() ||
      log.topics?.[0] !== CREATEX_CONTRACT_CREATION_TOPIC ||
      !log.topics?.[1]
    ) {
      continue;
    }
    const topic = log.topics[1] as string;
    return getAddress(`0x${topic.slice(-40)}` as `0x${string}`);
  }
  return undefined;
}

async function deployViaCreateX(
  walletClient: any,
  publicClient: any,
  label: string,
  initCode: `0x${string}`,
  expectedAddress: `0x${string}`,
): Promise<`0x${string}`> {
  const existingCodeSize = await getCodeSize(publicClient, expectedAddress);
  if (existingCodeSize > 0) {
    console.log(`   ${label}: already deployed at ${expectedAddress}, skipping CreateX deploy`);
    return expectedAddress;
  }

  const predicted = predictCreate2Address(initCode);
  if (predicted.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(`${label} address mismatch: predicted ${predicted}, expected ${expectedAddress}`);
  }

  console.log(`   ${label}: deploying to ${expectedAddress}...`);
  const hash = await walletClient.writeContract({
    address: CREATEX_ADDRESS,
    abi: CREATEX_DEPLOY_ABI,
    functionName: "deployCreate2",
    args: [CREATE2_SALT, initCode],
    value: 0n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${label} CreateX deployment reverted: ${hash}`);
  }

  const deployedAddress = parseCreateXDeployedAddress(receipt) ?? expectedAddress;
  if (deployedAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(
      `${label} CreateX deployed to ${deployedAddress}, expected ${expectedAddress} (tx ${hash})`,
    );
  }

  const deployedCodeSize = await waitForCode(publicClient, deployedAddress);
  if (deployedCodeSize === 0) {
    throw new Error(
      `${label} deployment tx succeeded but RPC returned no code at ${deployedAddress} (tx ${hash})`,
    );
  }

  console.log(`   ${label}: deployed (${hash})`);
  return deployedAddress;
}

async function main() {
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const weth = (process.env.ROBINHOOD_WETH ?? DEFAULT_ROBINHOOD_WETH) as `0x${string}`;
  const journalPath = process.env.DEP_02A_JOURNAL ?? DEFAULT_JOURNAL_PATH;

  console.log("\nRobinhood CreateX deployment (dep-02a-base frozen init codes)\n");
  console.log("=".repeat(72));
  console.log(`Journal: ${journalPath}`);
  console.log(`WETH:    ${weth}`);

  const initCodes = loadDep02aInitCodes(weth, journalPath);

  console.log("\nPredicted addresses:");
  console.log(`  Factory:      ${initCodes.predicted.factory}`);
  console.log(`  PoolDeployer: ${initCodes.predicted.poolDeployer}`);
  console.log(`  Router:       ${initCodes.predicted.router}`);
  console.log(`  StateView:    ${initCodes.predicted.stateView}`);

  if (dryRun) {
    console.log("\nDry run only; no transactions sent.");
    return;
  }

  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  console.log(`\nDeployer: ${walletClient.account.address}`);
  console.log("\nDeploying...\n");

  const factory = await deployViaCreateX(
    walletClient,
    publicClient,
    "Factory",
    initCodes.factory,
    initCodes.predicted.factory,
  );

  const poolDeployer = await deployViaCreateX(
    walletClient,
    publicClient,
    "PoolDeployer",
    initCodes.poolDeployer,
    initCodes.predicted.poolDeployer,
  );

  const currentPoolDeployer = await publicClient.readContract({
    address: factory,
    abi: MetricOmmPoolFactoryAbi,
    functionName: "poolDeployer",
  });

  if (currentPoolDeployer.toLowerCase() === poolDeployer.toLowerCase()) {
    console.log(`   setPoolDeployer: already linked to ${poolDeployer}, skipping`);
  } else {
    console.log(`   setPoolDeployer: linking ${poolDeployer} on factory ${factory}...`);
    const setDeployerHash = await walletClient.writeContract({
      address: factory,
      abi: MetricOmmPoolFactoryAbi,
      functionName: "setPoolDeployer",
      args: [poolDeployer],
    });
    const setDeployerReceipt = await publicClient.waitForTransactionReceipt({ hash: setDeployerHash });
    if (setDeployerReceipt.status !== "success") {
      throw new Error(`setPoolDeployer reverted: ${setDeployerHash}`);
    }
    console.log(`   setPoolDeployer: confirmed (${setDeployerHash})`);
  }

  const router = await deployViaCreateX(
    walletClient,
    publicClient,
    "Router",
    initCodes.router,
    initCodes.predicted.router,
  );

  const stateView = await deployViaCreateX(
    walletClient,
    publicClient,
    "StateView",
    initCodes.stateView,
    initCodes.predicted.stateView,
  );

  console.log("\nDeployment complete:\n");
  console.log(`  factory:      ${factory}`);
  console.log(`  poolDeployer: ${poolDeployer}`);
  console.log(`  router:       ${router}`);
  console.log(`  stateView:    ${stateView}`);
  console.log(`  wrappedNative:${weth}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
