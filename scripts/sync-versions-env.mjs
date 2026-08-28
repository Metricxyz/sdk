// Sync metricPeripheryRef from metric-deploy/versions.env (sibling checkout of this repo).
// Usage: node scripts/sync-versions-env.mjs [--check]

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versionsEnvPath = path.resolve(pkgRoot, "..", "metric-deploy", "versions.env");
const packageJsonPath = path.join(pkgRoot, "package.json");

const checkOnly = process.argv.includes("--check");

function parseVersionsEnv(content) {
  const refs = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    refs[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return refs;
}

async function main() {
  const envRaw = await fs.readFile(versionsEnvPath, "utf8");
  const refs = parseVersionsEnv(envRaw);
  const expected = refs.METRIC_PERIPHERY_REF;
  if (!expected) {
    throw new Error("versions.env must define METRIC_PERIPHERY_REF");
  }

  const pkgRaw = await fs.readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(pkgRaw);

  if (pkg.metricPeripheryRef !== expected) {
    if (checkOnly) {
      console.error("Mismatch: metricPeripheryRef");
      console.error(`  expected: ${expected}`);
      console.error(`  actual:   ${pkg.metricPeripheryRef ?? "(missing)"}`);
      process.exit(1);
    }
    pkg.metricPeripheryRef = expected;
    await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    console.log(`Updated metricPeripheryRef -> ${expected}`);
    return;
  }

  if (pkg.devDependencies?.["@metric/core"]) {
    if (checkOnly) {
      console.error("Unexpected direct @metric/core pin (core comes via @metric/periphery)");
      process.exit(1);
    }
    delete pkg.devDependencies["@metric/core"];
    await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    console.log("Removed @metric/core (core comes via @metric/periphery)");
    return;
  }

  if (pkg.devDependencies?.["@metric/periphery"]) {
    if (checkOnly) {
      console.error(
        "Remove @metric/periphery from devDependencies; use metricPeripheryRef + init:submodules",
      );
      process.exit(1);
    }
    delete pkg.devDependencies["@metric/periphery"];
    await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    console.log("Removed @metric/periphery devDependency (installed via init:submodules)");
    return;
  }

  if (checkOnly) {
    console.log("contract pins match versions.env");
    return;
  }

  console.log("No changes needed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
