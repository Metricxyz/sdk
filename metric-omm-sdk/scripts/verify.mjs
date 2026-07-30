#!/usr/bin/env node
/**
 * Lint, format, typecheck, and build for @metric.xyz/metric-omm-sdk (published v0/v1 deps only).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(pkgRoot, "package.json");
const nodeModules = path.join(pkgRoot, "node_modules");

const lintGlobs = ["src/**/*.ts"];
const formatGlobs = ["src/**/*.ts"];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: pkgRoot, env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertPublishedDependencies() {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  for (const name of ["@metric.xyz/metric-omm-sdk-v0", "@metric.xyz/metric-omm-sdk-v1"]) {
    const spec = pkg.dependencies?.[name];
    if (typeof spec === "string" && spec.startsWith("file:")) {
      throw new Error(
        `${name} is "${spec}". Use exact published versions in package.json (e.g. "0.1.1").`,
      );
    }
    if (spec == null || spec === "") {
      throw new Error(`${name} must be set to a published version in package.json.`);
    }
  }
}

console.log("\n=== verify:metric-omm-sdk ===\n");

assertPublishedDependencies();

if (process.env.VERIFY_FRESH_INSTALL === "1" || !existsSync(nodeModules)) {
  run("npm", ["ci", "--ignore-scripts"]);
} else {
  console.log("Using existing node_modules (set VERIFY_FRESH_INSTALL=1 for npm ci)\n");
}

run("npx", ["eslint", ...lintGlobs]);
run("npx", ["prettier", "--check", ...formatGlobs]);
run("npm", ["run", "typecheck"]);
run("npm", ["run", "build"]);

console.log("\n=== verify:metric-omm-sdk passed ===\n");
