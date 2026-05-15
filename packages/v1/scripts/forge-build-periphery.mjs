// Build MetricOmmPoolDataProvider with Foundry (Hardhat cannot compile it: duplicate OZ Math.Rounding).
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const peripheryDir = path.join(packageRoot, "node_modules", "@metric", "periphery");

execSync(
  "forge build --contracts contracts/lens/MetricOmmPoolDataProvider.sol",
  { cwd: peripheryDir, stdio: "inherit" },
);
