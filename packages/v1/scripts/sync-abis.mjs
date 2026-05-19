// Extracts ABIs from Hardhat artifacts and Foundry periphery output into typed SDK exports.
// Usage: node scripts/sync-abis.mjs

import { promises as fs } from "node:fs";
import path from "node:path";
import prettier from "prettier";
import prettierPluginEstree from "prettier/plugins/estree";
import prettierPluginTypescript from "prettier/plugins/typescript";

const packageRoot = process.cwd();
const peripheryOut = path.join(
  packageRoot,
  "node_modules",
  "@metric",
  "periphery",
  "out",
  "MetricOmmPoolDataProvider.sol",
  "MetricOmmPoolDataProvider.json",
);

const contracts = [
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "core",
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
      "core",
      "contracts",
      "MetricOmmPoolFactory.sol",
      "MetricOmmPoolFactory.json",
    ),
    outputPath: path.join("src", "abis", "MetricOmmPoolFactory.ts"),
    exportName: "MetricOmmPoolFactoryAbi",
  },
  {
    artifactPath: peripheryOut,
    outputPath: path.join("src", "abis", "MetricOmmPoolDataProvider.ts"),
    exportName: "MetricOmmPoolDataProviderAbi",
    fromForge: true,
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "contracts",
      "MetricOmmPoolSwapper.sol",
      "MetricOmmPoolSwapper.json",
    ),
    outputPath: path.join("src", "abis", "MetricOmmPoolSwapper.ts"),
    exportName: "MetricOmmPoolSwapperAbi",
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
      "core",
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

    const source = contract.fromForge ? "forge" : "hardhat";
    console.log(`Updated ${contract.outputPath} (${source})`);
  }

  console.log("ABI sync completed.");
}

main().catch((error) => {
  console.error("Failed to sync ABIs.");
  console.error(error);
  process.exit(1);
});
