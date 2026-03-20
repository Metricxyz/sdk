/**
 * Inspect a pool: print immutables and bin states from curBinIdx-10 to curBinIdx+10.
 *
 * Usage:
 *   npx hardhat run exec/pool/inspect-pool.ts --network base
 *   npx hardhat run exec/pool/inspect-pool.ts --network arbitrum
 *
 * Environment variables:
 *   POOL_ADDRESS - Pool contract address (required, or will prompt)
 */

import { network } from "hardhat";
import { erc20Abi, formatUnits } from "viem";
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

async function main() {
  console.log("\nMetricOMM Pool Inspector\n");

  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  const addresses = sdk.getAddressesOrThrow(chainId);

  let poolAddress = process.env.POOL_ADDRESS as `0x${string}` | undefined;
  if (!poolAddress) {
    const input = await prompt("Enter pool address: ");
    if (!input) {
      console.error("ERROR: Pool address is required");
      process.exit(1);
    }
    poolAddress = input as `0x${string}`;
  }

  console.log("\nFetching pool data...\n");

  const [immutables, state] = await Promise.all([
    sdk.getPoolImmutables(publicClient, poolAddress),
    sdk.getPoolState(publicClient, addresses.stateView, poolAddress),
  ]);

  const [symbol0, decimals0, symbol1, decimals1] = await Promise.all([
    publicClient.readContract({ address: immutables.token0, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: immutables.token0, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: immutables.token1, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: immutables.token1, abi: erc20Abi, functionName: "decimals" }),
  ]);

  // ── Immutables ──────────────────────────────────────────────────────────────
  console.log("Pool Immutables");
  console.log("=".repeat(60));
  console.log(`Chain ID:                          ${chainId}`);
  console.log(`Pool:                              ${poolAddress}`);
  console.log(`Factory:                           ${immutables.factory}`);
  console.log(`Token0:                            ${symbol0} (${immutables.token0})`);
  console.log(`Token1:                            ${symbol1} (${immutables.token1})`);
  console.log(`Token0 Scale Multiplier:           ${immutables.token0ScaleMultiplier}`);
  console.log(`Token1 Scale Multiplier:           ${immutables.token1ScaleMultiplier}`);
  console.log(`Initial Scaled Token0/Share (E18): ${immutables.initialScaledToken0PerShareE18}`);
  console.log(`Initial Scaled Token1/Share (E18): ${immutables.initialScaledToken1PerShareE18}`);
  console.log(`Minimal Mintable Liquidity:        ${immutables.minimalMintableLiquidity}`);
  console.log(`Max Drift (E8):                    ${immutables.maxDriftE8}`);
  console.log(`Max Drift Decay/s (E8):            ${immutables.maxDriftDecayPerSecondE8}`);
  console.log(`Lowest Bin:                        ${immutables.lowestBin}`);
  console.log(`Highest Bin:                       ${immutables.highestBin}`);

  // ── Pool State ───────────────────────────────────────────────────────────────
  console.log("\nPool State");
  console.log("=".repeat(60));
  console.log(`Current Bin Index:                 ${state.curBinIdx}`);
  console.log(`Current Pos In Bin:                ${state.curPosInBin}`);
  console.log(`Bin Dist From Provided Price (E6): ${state.curBinDistFromProvidedPriceE6}`);
  console.log(`Drift (E8):                        ${state.driftE8}`);
  console.log(`Performance Fee (E6):              ${state.performanceFeeE6}`);
  console.log(`Total Scaled Token0 In Bins:       ${state.totalScaledToken0InBins}`);
  console.log(`Total Scaled Token1 In Bins:       ${state.totalScaledToken1InBins}`);

  // ── Bin States ───────────────────────────────────────────────────────────────
  const BIN_RANGE = 10;
  const curBin = state.curBinIdx;
  const binIndices: number[] = [];
  for (let i = curBin - BIN_RANGE; i <= curBin + BIN_RANGE; i++) {
    binIndices.push(i);
  }

  const binStates = await sdk.getBinStatesExternal(
    publicClient,
    addresses.stateView,
    poolAddress,
    binIndices,
  );

  console.log(`\nBin States (${curBin - BIN_RANGE} to ${curBin + BIN_RANGE})`);

  const header = [
    "Bin".padStart(5),
    symbol0.padStart(14),
    symbol1.padStart(14),
    "Len".padStart(10),
    "BuyFee".padStart(8),
    "SellFee".padStart(8),
    "Shares".padStart(14),
  ].join(" ");
  console.log(header);
  console.log("-".repeat(header.length));

  for (let i = 0; i < binIndices.length; i++) {
    const binIdx = binIndices[i];
    const marker = binIdx === curBin ? " <" : "";
    const row = [
      String(binIdx).padStart(5),
      formatUnits(binStates.token0Balances[i], decimals0 as number).padStart(14),
      formatUnits(binStates.token1Balances[i], decimals1 as number).padStart(14),
      String(binStates.lengthsInUnits[i]).padStart(10),
      String(binStates.addFeeBuysE6[i]).padStart(8),
      String(binStates.addFeeSellsE6[i]).padStart(8),
      String(binStates.totalShares[i]).padStart(14),
    ].join(" ");
    console.log(row + marker);
  }

  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
