#!/usr/bin/env node
/**
 * Lint, format, typecheck, and test for @nradko/metric-omm-sdk-v1.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const lintGlobs = ["src/**/*.ts", "scripts/**/*.{ts,mjs}", "test/**/*.ts"];
const formatGlobs = ["src/**/*.{ts,mjs}", "scripts/**/*.{ts,mjs}", "test/**/*.ts"];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: pkgRoot, env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\n=== verify:v1 ===\n");

run("npm", ["ci", "--ignore-scripts"]);
run("npx", ["eslint", ...lintGlobs]);
run("npx", ["prettier", "--check", ...formatGlobs]);
run("npm", ["run", "typecheck"]);
run("npm", ["test"]);

console.log("\n=== verify:v1 passed ===\n");
