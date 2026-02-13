import { artifacts } from "hardhat";
import { keccak256, type Hex } from "viem";

let cached: { poolCreationCode: Hex; poolCreationCodeHash: Hex } | undefined;

export async function getPoolCreationCode() {
  if (!cached) {
    const artifact = await artifacts.readArtifact("MetricOmmPool");
    const poolCreationCode = artifact.bytecode as Hex;
    const poolCreationCodeHash = keccak256(poolCreationCode);
    cached = { poolCreationCode, poolCreationCodeHash };
  }

  return cached;
}
