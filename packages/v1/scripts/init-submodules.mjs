/**
 * Initialize git submodules in @metric/core and @metric/periphery (workspace-hoisted or local).
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function resolveMetricModulesDir() {
  const hoisted = resolve(packageRoot, "../../node_modules/@metric");
  if (existsSync(resolve(hoisted, "core"))) {
    return hoisted;
  }
  const local = resolve(packageRoot, "node_modules/@metric");
  if (existsSync(resolve(local, "core"))) {
    return local;
  }
  throw new Error(
    "Could not find @metric/core in node_modules. Run npm install from dev_sdk (workspace root) first.",
  );
}

const metricDir = resolveMetricModulesDir();

for (const name of ["core", "periphery"]) {
  const dir = resolve(metricDir, name);
  if (!existsSync(dir)) {
    throw new Error(`Missing ${dir}`);
  }
  console.log(`init submodules: ${dir}`);
  execSync("git submodule update --init --recursive", { cwd: dir, stdio: "inherit" });
}
