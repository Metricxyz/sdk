#!/usr/bin/env node
/**
 * Lint, format, typecheck, and test for @nradko/metric-omm-sdk-v0.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = path.join(pkgRoot, "node_modules");

const lintGlobs = ["src/**/*.ts", "scripts/**/*.{ts,mjs}", "test/**/*.ts", "exec/**/*.ts"];
const formatGlobs = ["src/**/*.{ts,mjs}", "scripts/**/*.{ts,mjs}", "test/**/*.ts", "exec/**/*.ts"];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: pkgRoot, env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\n=== verify:v0 ===\n");

if (process.env.VERIFY_FRESH_INSTALL === "1" || !existsSync(nodeModules)) {
  run("npm", ["ci", "--ignore-scripts"]);
} else {
  console.log("Using existing node_modules (set VERIFY_FRESH_INSTALL=1 for npm ci)\n");
}

run("node", ["./scripts/init-submodules.mjs"]);
run("npx", ["eslint", ...lintGlobs]);
run("npx", ["prettier", "--check", ...formatGlobs]);
run("npm", ["run", "typecheck"]);
run("npm", ["test"]);

console.log("\n=== verify:v0 passed ===\n");
