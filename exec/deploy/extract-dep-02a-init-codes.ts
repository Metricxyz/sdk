/**
 * Extract frozen init codes from dep-02a-base Ignition journal JSONL.
 *
 * Factory, PoolDeployer, and StateView init codes are copied verbatim.
 * SwapRouter init code is copied from the reference journal and only the
 * trailing WETH constructor argument is replaced.
 *
 * Usage:
 *   npx hardhat run exec/deploy/extract-dep-02a-init-codes.ts
 *
 * Optional environment variables:
 *   ROBINHOOD_WETH=0x...
 *   DEP_02A_JOURNAL=path
 *   DEP_02A_INIT_OUT=path
 */
import fs from "fs";
import path from "path";
import { loadDep02aInitCodes } from "./dep-02a-init-codes.js";

const weth = (process.env.ROBINHOOD_WETH ?? "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73") as `0x${string}`;
const journalPath =
  process.env.DEP_02A_JOURNAL ??
  path.join(process.cwd(), "ignition/deployments/dep-02a-base/journal.jsonl");
const outPath =
  process.env.DEP_02A_INIT_OUT ??
  path.join(process.cwd(), "ignition/frozen/dep-02a-base-init-codes.robinhood.json");

const initCodes = loadDep02aInitCodes(weth as `0x${string}`, journalPath);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(initCodes, null, 2)}\n`);

console.log(`Wrote init codes to ${outPath}`);
console.log(JSON.stringify(initCodes.predicted, null, 2));
