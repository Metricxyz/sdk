/**
 * Install pinned @metric/periphery (git clone, not npm git dep) and init its submodules.
 * Core is provided via periphery's lib/metric-core submodule.
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
const peripheryDir = resolve(metricDir, "periphery");
const ozMarker = "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
const PERIPHERY_REPO = "https://github.com/Metric-OMM/metric-periphery.git";

function readPeripheryRef() {
  const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
  const ref = pkg.metricPeripheryRef;
  if (typeof ref !== "string" || ref.length < 7) {
    throw new Error("package.json must define metricPeripheryRef (git commit SHA)");
  }
  return ref;
}

function git(cwd, args) {
  execSync(["git", ...args].join(" "), { cwd, stdio: "inherit" });
}

function peripheryAtRef(ref) {
  if (!existsSync(resolve(peripheryDir, ".git"))) return false;
  try {
    const head = execSync("git rev-parse HEAD", { cwd: peripheryDir, encoding: "utf8" }).trim();
    return head.startsWith(ref) || ref.startsWith(head);
  } catch {
    return false;
  }
}

function ensurePeripheryCheckout(ref) {
  mkdirSync(metricDir, { recursive: true });

  if (peripheryAtRef(ref)) {
    console.log(`@metric/periphery ready at ${ref}: ${peripheryDir}`);
    return;
  }

  // CI links a pre-cloned checkout; don't overwrite that tree via fetch/clone.
  if (process.env.CI === "true" && existsSync(peripheryDir)) {
    throw new Error(
      `@metric/periphery at ${peripheryDir} is not at ${ref}. Re-clone or fix the CI link.`,
    );
  }

  if (existsSync(peripheryDir)) {
    console.log(`Updating @metric/periphery to ${ref}`);
    git(peripheryDir, ["fetch", "origin", ref]);
    git(peripheryDir, ["checkout", "--force", ref]);
    return;
  }

  console.log(`Cloning @metric/periphery at ${ref}`);
  git(metricDir, ["clone", PERIPHERY_REPO, "periphery"]);
  git(peripheryDir, ["fetch", "origin", ref]);
  git(peripheryDir, ["checkout", "--force", ref]);
}

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
  git(packageDir, ["submodule", "update", "--init", "--recursive"]);
}

function fixPeripheryPackageName() {
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

const ref = readPeripheryRef();
ensurePeripheryCheckout(ref);
fixPeripheryPackageName();
ensureSubmodules(peripheryDir, "@metric/periphery");

const coreDir = resolve(peripheryDir, "lib/metric-core");
ensureSubmodules(coreDir, "@metric/core (via periphery)");
linkCoreFromPeriphery(resolve(metricDir, "core"), coreDir);
