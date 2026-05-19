// Sync v1 package.json @metric/* git pins from dev_metric-deploy/versions.env.
// Usage: node scripts/sync-versions-env.mjs [--check]

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versionsEnvPath = path.resolve(repoRoot, "..", "dev_metric-deploy", "versions.env");
const v1PackageJsonPath = path.join(repoRoot, "packages", "v1", "package.json");

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

function expectedPins(refs) {
  const core = refs.METRIC_CORE_REF;
  const periphery = refs.METRIC_PERIPHERY_REF;
  if (!core || !periphery) {
    throw new Error("versions.env must define METRIC_CORE_REF and METRIC_PERIPHERY_REF");
  }
  return {
    "@metric/core": `github:Metric-OMM/metric-core#${core}`,
    "@metric/periphery": `github:Metric-OMM/metric-periphery#${periphery}`,
  };
}

async function main() {
  const envRaw = await fs.readFile(versionsEnvPath, "utf8");
  const pins = expectedPins(parseVersionsEnv(envRaw));
  const pkgRaw = await fs.readFile(v1PackageJsonPath, "utf8");
  const pkg = JSON.parse(pkgRaw);
  const devDeps = pkg.devDependencies ?? {};

  let changed = false;
  for (const [name, expected] of Object.entries(pins)) {
    if (devDeps[name] !== expected) {
      if (checkOnly) {
        console.error(`Mismatch: ${name}`);
        console.error(`  expected: ${expected}`);
        console.error(`  actual:   ${devDeps[name] ?? "(missing)"}`);
        process.exit(1);
      }
      devDeps[name] = expected;
      changed = true;
      console.log(`Updated ${name} -> ${expected}`);
    }
  }

  if (checkOnly) {
    console.log("v1 contract pins match versions.env");
    return;
  }

  if (changed) {
    pkg.devDependencies = devDeps;
    await fs.writeFile(v1PackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    console.log("Updated packages/v1/package.json");
  } else {
    console.log("No changes needed");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
