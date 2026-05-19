/**
 * Prepare @metric/core / @metric/periphery under this package's node_modules.
 * npm git installs often ship without nested submodules; we init or link siblings.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const metricDir = resolve(packageRoot, "node_modules/@metric");
const ozMarker = "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

function ozReady(packageDir) {
  const file = resolve(packageDir, ozMarker);
  return existsSync(file) && statSync(file).size > 0;
}

function ensureCore(coreDir) {
  if (ozReady(coreDir)) {
    console.log(`@metric/core ready: ${coreDir}`);
    return;
  }
  console.log(`init submodules: ${coreDir}`);
  execSync("git submodule update --init --recursive", { cwd: coreDir, stdio: "inherit" });
}

function ensurePeriphery(peripheryDir, coreDir) {
  const remappings = existsSync(resolve(peripheryDir, "remappings.txt"))
    ? readFileSync(resolve(peripheryDir, "remappings.txt"), "utf8")
    : "";

  if (remappings.includes("lib/metric-core/")) {
    const linkPath = resolve(peripheryDir, "lib/metric-core");
    const poolMarker = resolve(linkPath, "contracts/MetricOmmPool.sol");
    if (existsSync(poolMarker)) {
      console.log(`@metric/periphery lib/metric-core ready: ${linkPath}`);
      return;
    }
    rmSync(linkPath, { recursive: true, force: true });
    mkdirSync(resolve(peripheryDir, "lib"), { recursive: true });
    symlinkSync(coreDir, linkPath, "dir");
    console.log(`linked ${linkPath} -> ${coreDir}`);
    return;
  }

  if (ozReady(peripheryDir)) {
    console.log(`@metric/periphery ready: ${peripheryDir}`);
    return;
  }
  console.log(`init submodules: ${peripheryDir}`);
  execSync("git submodule update --init --recursive", { cwd: peripheryDir, stdio: "inherit" });
}

if (!existsSync(resolve(metricDir, "core"))) {
  throw new Error(
    `Could not find @metric/core in ${metricDir}. Run "npm ci" in ${packageRoot} first.`,
  );
}

const coreDir = resolve(metricDir, "core");
ensureCore(coreDir);

const peripheryDir = resolve(metricDir, "periphery");
if (existsSync(peripheryDir)) {
  ensurePeriphery(peripheryDir, coreDir);
}
