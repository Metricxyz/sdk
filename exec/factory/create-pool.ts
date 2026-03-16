/**
 * Deploy a pool using configuration from a JSON file.
 *
 * Usage:
 *   npx hardhat run exec/factory/create-pool.ts --network ethereum -- --config scripts/pool-config.json
 *
 * Or with environment variable:
 *   POOL_CONFIG=scripts/pool-config.json npx hardhat run exec/factory/create-pool.ts --network ethereum
 */
// @ts-nocheck - viem version mismatch between hardhat and sdk

import { network } from "hardhat";
import fs from "fs";
import * as sdk from "../../index.js";

// Bin config as [lengthE6, addBuyFeeE6, addSellFeeE6]
type BinTuple = [number, number, number];

interface PoolConfig {
  factory: string;
  token0: string;
  token1: string;
  priceProvider: string;
  admin: string;
  nonNegativeBins: BinTuple[];
  negativeBins: BinTuple[];
  initialToken0PerShare?: string;
  initialToken1PerShare?: string;
  // Support both E8/E6 and percent formats
  maxDriftE8?: number;
  maxDriftPercent?: number;
  driftDecayPerSecondE8?: number;
  driftDecayPerSecondPercent?: number;
  adminFeeE6?: number;
  adminFeePercent?: number;
  minimalMintableLiquidity?: string;
  reportSwapToPriceProvider: boolean;
  salt?: string;
}

function loadConfig(): PoolConfig {
  // Check for config file path
  const configPath =
    process.env.POOL_CONFIG ||
    process.argv.find((arg) => arg.endsWith(".json")) ||
    "scripts/pool-config.json";

  if (!fs.existsSync(configPath)) {
    console.error(`\n❌ Config file not found: ${configPath}`);
    console.error(
      `\nCreate a config file based on scripts/pool-config.example.json`,
    );
    process.exit(1);
  }

  const content = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(content) as PoolConfig;

  // Remove comment fields
  const cleanConfig = JSON.parse(
    JSON.stringify(config, (key, value) =>
      key === "comment" ? undefined : value,
    ),
  );

  return cleanConfig;
}

function validateConfig(config: PoolConfig): void {
  // Validate addresses
  const addressFields = [
    "factory",
    "token0",
    "token1",
    "priceProvider",
    "admin",
  ];
  for (const field of addressFields) {
    const value = config[field as keyof PoolConfig] as string;
    if (!value || !value.startsWith("0x") || value.length !== 42) {
      throw new Error(`Invalid ${field} address: ${value}`);
    }
  }

  // Validate bins
  if (!config.nonNegativeBins || config.nonNegativeBins.length < 1) {
    throw new Error("Must have at least 1 non-negative bin");
  }
  if (!config.negativeBins || config.negativeBins.length < 1) {
    throw new Error("Must have at least 1 negative bin");
  }

  // Validate bin format
  for (const bin of config.nonNegativeBins) {
    if (!Array.isArray(bin) || bin.length !== 3) {
      throw new Error(
        `Invalid bin format: ${JSON.stringify(bin)}. Expected [lengthE6, addBuyFeeE6, addSellFeeE6]`,
      );
    }
  }
  for (const bin of config.negativeBins) {
    if (!Array.isArray(bin) || bin.length !== 3) {
      throw new Error(
        `Invalid bin format: ${JSON.stringify(bin)}. Expected [lengthE6, addBuyFeeE6, addSellFeeE6]`,
      );
    }
  }
}

// Convert bin tuples [lengthE6, addBuyFeeE6, addSellFeeE6] to SDK BinData format
function binTuplesToBinData(bins: BinTuple[]): sdk.BinData[] {
  return bins.map(([lengthE6, addFeeBuyE6, addFeeSellE6]) => ({
    lengthE6,
    addFeeBuyE6,
    addFeeSellE6,
  }));
}

async function main() {
  console.log("\n🚀 MetricOMM Pool Deployment\n");
  console.log("=".repeat(60));

  // Load and validate config
  const config = loadConfig();
  validateConfig(config);

  // Connect to network
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  console.log(`📋 Deployer: ${walletClient.account.address}`);
  console.log(`📋 Factory: ${config.factory}`);
  console.log(`📋 Token0: ${config.token0}`);
  console.log(`📋 Token1: ${config.token1}`);
  console.log(`📋 Price Provider: ${config.priceProvider}`);

  // Convert bin tuples to BinData and pack
  const nonNegativeBinData = binTuplesToBinData(config.nonNegativeBins);
  const negativeBinData = binTuplesToBinData(config.negativeBins);

  // Build pool params
  const poolParams: sdk.CreatePoolParams = {
    token0: config.token0 as `0x${string}`,
    token1: config.token1 as `0x${string}`,
    priceProvider: config.priceProvider as `0x${string}`,
    admin: config.admin as `0x${string}`,

    // Whether swaps should be reported to the price provider
    reportSwapToPriceProvider: config.reportSwapToPriceProvider,

    // Bins (using createBins to pack)
    nonNegativeBins: sdk.createBins(nonNegativeBinData),
    negativeBins: sdk.createBins(negativeBinData),

    // Initial densities (direct E18 values)
    initialToken0PerShare: config.initialToken0PerShare
      ? BigInt(config.initialToken0PerShare)
      : 1000000000000000000n, // 1e18 default
    initialToken1PerShare: config.initialToken1PerShare
      ? BigInt(config.initialToken1PerShare)
      : 1000000000000000000n, // 1e18 default

    // Drift (support both E8 and percent formats)
    maxDriftPercent:
      config.maxDriftPercent ??
      (config.maxDriftE8 ? config.maxDriftE8 / 1e6 : 5.0),
    driftDecayPerSecondPercent:
      config.driftDecayPerSecondPercent ??
      (config.driftDecayPerSecondE8
        ? config.driftDecayPerSecondE8 / 1e6
        : 0.01),

    // Fees (support both E6 and percent formats)
    adminFeePercent:
      config.adminFeePercent ??
      (config.adminFeeE6 ? config.adminFeeE6 / 10000 : 0),
    adminFeeDestination: config.admin as `0x${string}`,

    // Current bin distance from provided price (default 0)
    curBinDistFromProvidedPricePercent: 0,

    // Other
    minimalMintableLiquidity: config.minimalMintableLiquidity
      ? BigInt(config.minimalMintableLiquidity)
      : 1000n,
    salt: config.salt as `0x${string}` | undefined,
  };

  // Calculate total bin coverage
  const nonNegTotalE6 = config.nonNegativeBins.reduce(
    (sum, [len]) => sum + len,
    0,
  );
  const negTotalE6 = config.negativeBins.reduce((sum, [len]) => sum + len, 0);

  // Resolve the percent values for display
  const maxDrift =
    config.maxDriftPercent ?? (config.maxDriftE8 ? config.maxDriftE8 / 1e6 : 5);
  const adminFee =
    config.adminFeePercent ??
    (config.adminFeeE6 ? config.adminFeeE6 / 10000 : 0);

  // Display config summary
  console.log("\n📊 Pool Configuration:");
  console.log("-".repeat(60));
  console.log(
    `   Bins: ${config.nonNegativeBins.length} non-negative, ${config.negativeBins.length} negative`,
  );
  console.log(
    `   Total coverage: +${(nonNegTotalE6 / 10000).toFixed(2)}% / -${(negTotalE6 / 10000).toFixed(2)}%`,
  );
  console.log(`   Max drift: ${maxDrift}%`);
  console.log(`   Admin fee: ${adminFee}%`);
  console.log(
    `   Report swap to price provider: ${config.reportSwapToPriceProvider}`,
  );

  // Confirm before deploying
  console.log("\n⚠️  About to deploy pool on mainnet!");
  console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...\n");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Create pool
  console.log("⏳ Creating pool...\n");

  try {
    const hash = await walletClient.sendTransaction({
      account: walletClient.account.address,
      to: config.factory as `0x${string}`,
      data: sdk.encodeCreatePoolCalldata(poolParams),
    });

    console.log("✅ Transaction sent!");
    console.log(`   Hash: ${hash}`);

    // Wait for confirmation
    console.log("\n⏳ Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("\n🎉 Pool created successfully!");
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);

      // Parse PoolCreated event
      const poolCreatedTopic =
        "0xe1c304acd9cda85cdced26da15edf3fd1a07d96caf4f9cedb068823618b93d4d";
      const poolCreatedLog = receipt.logs.find(
        (log) => log.topics[0] === poolCreatedTopic,
      );
      if (poolCreatedLog && poolCreatedLog.data) {
        // Pool address is in the data field (first 32 bytes after removing 0x)
        const poolAddr = "0x" + poolCreatedLog.data.slice(26, 66);
        console.log(`\n📍 Pool address: ${poolAddr}`);
      }
    } else {
      console.error("\n❌ Transaction reverted!");
    }
  } catch (error) {
    console.error("\n❌ Error creating pool:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
