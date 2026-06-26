// Extracts ABIs from Hardhat artifacts into typed SDK exports.
// Usage: node scripts/sync-abis.mjs

import { promises as fs } from "node:fs";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
import prettierPluginEstree from "prettier/plugins/estree";
import prettierPluginTypescript from "prettier/plugins/typescript";

const contracts = [
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "lib",
      "metric-core",
      "contracts",
      "MetricOmmPool.sol",
      "MetricOmmPool.json",
    ),
    outputPath: path.join("src", "abis", "MetricOmmPool.ts"),
    exportName: "MetricOmmPoolAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "lib",
      "metric-core",
      "contracts",
      "MetricOmmPoolFactory.sol",
      "MetricOmmPoolFactory.json",
    ),
    outputPath: path.join("src", "abis", "MetricOmmPoolFactory.ts"),
    exportName: "MetricOmmPoolFactoryAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "contracts",
      "lens",
      "MetricOmmPoolDataProvider.sol",
      "MetricOmmPoolDataProvider.json",
    ),
    outputPath: path.join("src", "abis", "MetricOmmPoolDataProvider.ts"),
    exportName: "MetricOmmPoolDataProviderAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "contracts",
      "lens",
      "MetricOmmSwapQuoter.sol",
      "MetricOmmSwapQuoter.json",
    ),
    outputPath: path.join("src", "abis", "MetricOmmSwapQuoter.ts"),
    exportName: "MetricOmmSwapQuoterAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "contracts",
      "MetricOmmSimpleRouter.sol",
      "MetricOmmSimpleRouter.json",
    ),
    outputPath: path.join("src", "abis", "MetricOmmSimpleRouter.ts"),
    exportName: "MetricOmmSimpleRouterAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "contracts",
      "MetricOmmPoolLiquidityAdder.sol",
      "MetricOmmPoolLiquidityAdder.json",
    ),
    outputPath: path.join("src", "abis", "MetricOmmPoolLiquidityAdder.ts"),
    exportName: "MetricOmmPoolLiquidityAdderAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "contracts",
      "extensions",
      "DepositAllowlistExtension.sol",
      "DepositAllowlistExtension.json",
    ),
    outputPath: path.join("src", "abis", "DepositAllowlistExtension.ts"),
    exportName: "DepositAllowlistExtensionAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "contracts",
      "extensions",
      "SwapAllowlistExtension.sol",
      "SwapAllowlistExtension.json",
    ),
    outputPath: path.join("src", "abis", "SwapAllowlistExtension.ts"),
    exportName: "SwapAllowlistExtensionAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "contracts",
      "extensions",
      "PriceVelocityGuardExtension.sol",
      "PriceVelocityGuardExtension.json",
    ),
    outputPath: path.join("src", "abis", "PriceVelocityGuardExtension.ts"),
    exportName: "PriceVelocityGuardExtensionAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "contracts",
      "extensions",
      "OracleValueStopLossExtension.sol",
      "OracleValueStopLossExtension.json",
    ),
    outputPath: path.join("src", "abis", "OracleValueStopLossExtension.ts"),
    exportName: "OracleValueStopLossExtensionAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "lib",
      "metric-core",
      "contracts",
      "interfaces",
      "IPriceProvider",
      "IPriceProvider.sol",
      "IPriceProvider.json",
    ),
    outputPath: path.join("src", "abis", "PriceProvider.ts"),
    exportName: "PriceProviderAbi",
  },
];

async function renderAbiFile(outputPath, exportName, abi) {
  const fileContent = `export const ${exportName} = ${JSON.stringify(abi, null, 2)} as const;\n`;

  return prettier.format(fileContent, {
    filepath: outputPath,
    parser: "typescript",
    plugins: [prettierPluginEstree, prettierPluginTypescript],
  });
}

async function main() {
  for (const contract of contracts) {
    const artifactAbsolutePath = path.isAbsolute(contract.artifactPath)
      ? contract.artifactPath
      : path.resolve(packageRoot, contract.artifactPath);
    const outputAbsolutePath = path.resolve(packageRoot, contract.outputPath);

    const artifactRaw = await fs.readFile(artifactAbsolutePath, "utf8");
    const artifact = JSON.parse(artifactRaw);

    if (!Array.isArray(artifact.abi)) {
      throw new Error(`Missing abi array in artifact: ${contract.artifactPath}`);
    }

    const fileContent = await renderAbiFile(contract.outputPath, contract.exportName, artifact.abi);

    await fs.mkdir(path.dirname(outputAbsolutePath), { recursive: true });
    await fs.writeFile(outputAbsolutePath, fileContent, "utf8");

    console.log(`Updated ${contract.outputPath} (hardhat)`);
  }

  console.log("ABI sync completed.");
}

main().catch((error) => {
  console.error("Failed to sync ABIs.");
  console.error(error);
  process.exit(1);
});
