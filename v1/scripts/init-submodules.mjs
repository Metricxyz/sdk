/**
 * Prepare @metric/periphery under this package's node_modules.
 * Core is not a direct dependency; it is provided via periphery's lib/metric-core submodule.
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const metricDir = resolve(packageRoot, "node_modules/@metric");
const ozMarker = "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

function ozReady(packageDir) {
  const file = resolve(packageDir, ozMarker);
  return existsSync(file) && statSync(file).size > 0;
}

function ensureSubmodules(packageDir, label) {
  if (ozReady(packageDir)) {
    console.log(`${label} ready: ${packageDir}`);
    return;
  }
  console.log(`init submodules: ${packageDir}`);
  execSync("git submodule update --init --recursive", { cwd: packageDir, stdio: "inherit" });
}

function fixPeripheryPackageName(peripheryDir) {
  const pkgPath = resolve(peripheryDir, "package.json");
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.name === "@metric/periphery") return;
  pkg.name = "@metric/periphery";
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`patched ${pkgPath} name -> @metric/periphery`);
}

function linkCoreFromPeriphery(coreLink, coreDir) {
  const poolMarker = resolve(coreDir, "contracts/MetricOmmPool.sol");
  if (!existsSync(poolMarker)) {
    throw new Error(
      `Expected core contracts at ${coreDir}. Run "git submodule update --init --recursive" in @metric/periphery.`,
    );
  }

  if (existsSync(coreLink)) {
    try {
      if (
        statSync(coreLink).isSymbolicLink() &&
        resolve(readlinkSync(coreLink)) === resolve(coreDir)
      ) {
        console.log(`@metric/core ready: ${coreLink} -> ${coreDir}`);
        return;
      }
    } catch {
      // fall through and recreate the link
    }
    rmSync(coreLink, { recursive: true, force: true });
  }

  mkdirSync(metricDir, { recursive: true });
  symlinkSync(coreDir, coreLink, "dir");
  console.log(`linked ${coreLink} -> ${coreDir}`);
}

const peripheryDir = resolve(metricDir, "periphery");
if (!existsSync(peripheryDir)) {
  throw new Error(
    `Could not find @metric/periphery in ${metricDir}. Run "npm ci" in ${packageRoot} first.`,
  );
}

fixPeripheryPackageName(peripheryDir);
ensureSubmodules(peripheryDir, "@metric/periphery");

const coreDir = resolve(peripheryDir, "lib/metric-core");
ensureSubmodules(coreDir, "@metric/core (via periphery)");
linkCoreFromPeriphery(resolve(metricDir, "core"), coreDir);
