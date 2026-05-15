import { deployContract, waitForTransactionReceipt } from "viem/actions";
import type { Address, Hex, PublicClient, WalletClient } from "viem";
import DataProviderArtifact from "../../node_modules/@metric/periphery/out/MetricOmmPoolDataProvider.sol/MetricOmmPoolDataProvider.json" with { type: "json" };

/** Deploy MetricOmmPoolDataProvider (Foundry artifact; not compiled by Hardhat). */
export async function deployDataProvider(
  walletClient: WalletClient,
  publicClient: PublicClient,
  factoryAddress: Address,
): Promise<Address> {
  const hash = await deployContract(walletClient, {
    abi: DataProviderArtifact.abi,
    bytecode: DataProviderArtifact.bytecode.object as Hex,
    args: [factoryAddress],
  });
  const receipt = await waitForTransactionReceipt(publicClient, { hash });
  if (!receipt.contractAddress) {
    throw new Error(`MetricOmmPoolDataProvider deployment failed (tx ${hash})`);
  }
  return receipt.contractAddress;
}
