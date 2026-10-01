import type { PublicClient, ReadContractParameters } from "viem";

/** Keep calibration and final share calculations on the same pool snapshot. */
export async function createSnapshotClient(publicClient: PublicClient): Promise<PublicClient> {
  const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });
  const reads = new Map<string, Promise<unknown>>();
  const readContract = (args: ReadContractParameters): Promise<unknown> => {
    const key = JSON.stringify([args.address, args.functionName, args.args], (_, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    let read = reads.get(key);
    if (!read) {
      read = publicClient.readContract({ ...args, blockNumber });
      reads.set(key, read);
    }
    return read;
  };

  // The cache preserves the decoded result for each identical contract read;
  // restore viem's ABI-dependent return type at this boundary.
  return { ...publicClient, readContract: readContract as PublicClient["readContract"] };
}
