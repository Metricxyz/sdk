import { promises as fs } from "node:fs";
import path from "node:path";

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
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "core",
      "contracts",
      "MetricOmmPoolStateView.sol",
      "MetricOmmPoolStateView.json",
    ),
    outputPath: path.join("src", "abis", "MetricOmmPoolStateView.ts"),
    exportName: "MetricOmmPoolStateViewAbi",
  },
  {
    artifactPath: path.join(
      "artifacts",
      "@metric",
      "periphery",
      "contracts",
      "MetricOmmSwapRouter.sol",
      "MetricOmmSwapRouter.json",
    ),
    outputPath: path.join("src", "abis", "MetricOmmSwapRouter.ts"),
    exportName: "MetricOmmSwapRouterAbi",
  },
];

function renderAbiFile(artifactPath, exportName, abi) {
  return `export const ${exportName} = ${JSON.stringify(abi, null, 2)} as const;\n`;
}

async function main() {
  for (const contract of contracts) {
    const artifactAbsolutePath = path.resolve(process.cwd(), contract.artifactPath);
    const outputAbsolutePath = path.resolve(process.cwd(), contract.outputPath);

    const artifactRaw = await fs.readFile(artifactAbsolutePath, "utf8");
    const artifact = JSON.parse(artifactRaw);

    if (!Array.isArray(artifact.abi)) {
      throw new Error(`Missing abi array in artifact: ${contract.artifactPath}`);
    }

    const fileContent = renderAbiFile(
      contract.artifactPath,
      contract.exportName,
      artifact.abi,
    );

    await fs.mkdir(path.dirname(outputAbsolutePath), { recursive: true });
    await fs.writeFile(outputAbsolutePath, fileContent, "utf8");

    console.log(`Updated ${contract.outputPath}`);
  }

  console.log("ABI sync completed.");
}

main().catch((error) => {
  console.error("Failed to sync ABIs.");
  console.error(error);
  process.exit(1);
});
