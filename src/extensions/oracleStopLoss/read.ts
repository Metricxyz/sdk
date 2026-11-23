/**
 * On-chain reads for OracleValueStopLossExtension status.
 * Callers only supply bid/ask; pool data is loaded from chain.
 */

import type { Abi, Address, PublicClient } from "viem";
import { MetricOmmPoolAbi } from "../../abis/MetricOmmPool.js";
import { MetricOmmPoolDataProviderAbi } from "../../abis/MetricOmmPoolDataProvider.js";
import { OracleValueStopLossExtensionAbi } from "../../abis/OracleValueStopLossExtension.js";
import { decodeBinStatesBytes32, decodeBinTotalSharesBatch } from "../../utils/poolState.js";
import { evaluateOracleStopLoss, type OracleStopLossEvaluation } from "./evaluate.js";
import { decayedHighWatermark } from "./math.js";

/**
 * Calldata budget (bytes) for one `aggregate3`, above viem's 1024-byte default.
 *
 * The bin sweep is two packed array reads plus one `highWatermarks`
 * call per bin. Under the default budget a 40-bin pool splits into five
 * separate `eth_call`s — each repaying the Multicall3 overhead and each
 * counting against the RPC provider's request budget, which is what rate
 * limiters meter. That pool needs ~5.5 KB, so this keeps it in one request
 * while still chunking pools with a much wider bin range.
 */
const STOP_LOSS_MULTICALL_BATCH_SIZE = 8192;

export interface OracleStopLossConfig {
  drawdownE6: number;
  decayPerSecondE18: bigint;
  timelock: number;
  initialized: boolean;
}

export interface GetOracleStopLossAnyBinStatusParams {
  publicClient: PublicClient;
  /** OracleValueStopLossExtension address. */
  extension: Address;
  dataProvider: Address;
  pool: Address;
  /**
   * Current oracle bid (Q64.64). Caller input: it is not read from the chain, so it cannot be
   * guaranteed to describe the same block as the pool-state reads (see `blockNumber` on the result).
   */
  bidPriceX64: bigint;
  /** Current oracle ask (Q64.64). Caller input, same caveat as `bidPriceX64`. */
  askPriceX64: bigint;
}

/**
 * Stop-loss status across every non-empty bin in `[lowestBin, highestBin]`.
 * A swap is blocked only if a bin on its path is breached — use per-bin flags for path-aware checks.
 */
export interface OracleStopLossAnyBinStatus extends OracleStopLossEvaluation {
  config: OracleStopLossConfig;
  bidPriceX64: bigint;
  askPriceX64: bigint;
  curBinIdx: number;
  lowestBin: number;
  highestBin: number;
  minimalOperationalLiquidity: bigint;
  /** Block every on-chain read of this status was taken at. */
  blockNumber: bigint;
  /** That block's timestamp; the `secondsUntil...Resumes` figures count from it. */
  blockTimestamp: bigint;
}

export async function getOracleStopLossConfig(
  publicClient: PublicClient,
  extension: Address,
  pool: Address,
): Promise<OracleStopLossConfig> {
  const result = (await publicClient.readContract({
    address: extension,
    abi: OracleValueStopLossExtensionAbi,
    functionName: "oracleStopLossConfig",
    args: [pool],
  })) as readonly [number, bigint, number, boolean];

  return {
    drawdownE6: Number(result[0]),
    decayPerSecondE18: result[1],
    timelock: Number(result[2]),
    initialized: result[3],
  };
}

export async function getCurrentHighWatermarks(
  publicClient: PublicClient,
  extension: Address,
  pool: Address,
  binIdx: number,
): Promise<{ hwm0: bigint; hwm1: bigint }> {
  const result = (await publicClient.readContract({
    address: extension,
    abi: OracleValueStopLossExtensionAbi,
    functionName: "currentHighWatermarks",
    args: [pool, binIdx],
  })) as readonly [bigint, bigint];

  return { hwm0: result[0], hwm1: result[1] };
}

function parseConfig(
  result: readonly [number | bigint, number | bigint, number | bigint, boolean],
): OracleStopLossConfig {
  return {
    drawdownE6: Number(result[0]),
    decayPerSecondE18: BigInt(result[1]),
    timelock: Number(result[2]),
    initialized: result[3],
  };
}

function binIndexRange(lowestBin: number, highestBin: number): number[] {
  if (highestBin < lowestBin) {
    throw new Error(`invalid bin range: lowestBin=${lowestBin} highestBin=${highestBin}`);
  }
  return Array.from({ length: highestBin - lowestBin + 1 }, (_, i) => lowestBin + i);
}

type MulticallContract = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

/**
 * Load stop-loss status for every non-empty bin in the pool's configured range.
 * Only `bidPriceX64` / `askPriceX64` are supplied by the caller.
 *
 * One block is selected first and every read below is pinned to it; its timestamp dates the
 * watermark decay.
 * The RPC must support state reads at the selected block number; errors are propagated rather
 * than falling back to inconsistent latest-state reads.
 * 1. Multicall: immutables + config + slot0 (to learn `[lowestBin, highestBin]`)
 * 2. Multicall: bin states/shares + stored watermarks and last write time for that range only.
 *    Current watermarks are derived with the contract's own integer rule
 *    (`OracleValueStopLossExtension._decayed`), so no separate `currentHighWatermarks` read is made.
 *
 * `bidPriceX64` / `askPriceX64` are the caller's and are not read at that block.
 *
 * `secondsUntil...Resumes` predicts when the evaluated condition (metric below the drawdown floor
 * of the decayed watermark) clears if the inputs stay fixed. It does not guarantee a swap will
 * execute then: a swap changes the bin it trades, and other bins on its path may be breached.
 *
 * `isAnyBinStopLossBreached` means at least one bin is breached — not that every swap is halted.
 */
export async function getOracleStopLossAnyBinStatus(
  params: GetOracleStopLossAnyBinStatusParams,
): Promise<OracleStopLossAnyBinStatus> {
  const { publicClient, extension, dataProvider, pool, bidPriceX64, askPriceX64 } = params;

  if (bidPriceX64 <= 0n) throw new Error("bidPriceX64 must be > 0");
  if (askPriceX64 <= 0n) throw new Error("askPriceX64 must be > 0");
  if (bidPriceX64 >= askPriceX64) throw new Error("bidPriceX64 must be < askPriceX64");

  // One block for every read, so config, balances, shares and watermarks agree with each other
  // and the timestamp used for decay is the one those reads were taken at.
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const blockNumber = block.number;
  const blockTimestamp = block.timestamp;

  const multicallOpts = {
    batchSize: STOP_LOSS_MULTICALL_BATCH_SIZE,
    ...(publicClient.chain?.contracts?.multicall3?.address
      ? { multicallAddress: publicClient.chain.contracts.multicall3.address }
      : { deployless: true as const }),
  };

  const bootstrap = await publicClient.multicall({
    allowFailure: false,
    ...multicallOpts,
    blockNumber,
    contracts: [
      {
        address: pool,
        abi: MetricOmmPoolAbi as Abi,
        functionName: "getImmutables",
      },
      {
        address: extension,
        abi: OracleValueStopLossExtensionAbi as Abi,
        functionName: "oracleStopLossConfig",
        args: [pool],
      },
      {
        address: dataProvider,
        abi: MetricOmmPoolDataProviderAbi as Abi,
        functionName: "slot0",
        args: [pool],
      },
    ] as Parameters<PublicClient["multicall"]>[0]["contracts"],
  });

  const immutables = bootstrap[0] as unknown as {
    minimalOperationalLiquidity: bigint;
    lowestBin: number | bigint;
    highestBin: number | bigint;
  };
  const config = parseConfig(
    bootstrap[1] as unknown as readonly [
      number | bigint,
      number | bigint,
      number | bigint,
      boolean,
    ],
  );
  const slot0 = bootstrap[2] as unknown as readonly [
    number | bigint,
    number | bigint,
    ...unknown[],
  ];

  const lowestBin = Number(immutables.lowestBin);
  const highestBin = Number(immutables.highestBin);
  const binIndices = binIndexRange(lowestBin, highestBin);

  const binContracts: MulticallContract[] = [
    {
      address: dataProvider,
      abi: MetricOmmPoolDataProviderAbi as Abi,
      functionName: "binStates",
      args: [pool, binIndices],
    },
    {
      address: dataProvider,
      abi: MetricOmmPoolDataProviderAbi as Abi,
      functionName: "binTotalShares",
      args: [pool, binIndices],
    },
    ...binIndices.map(
      (binIdx): MulticallContract => ({
        address: extension,
        abi: OracleValueStopLossExtensionAbi as Abi,
        functionName: "highWatermarks",
        args: [pool, binIdx],
      }),
    ),
  ];

  const binResults = await publicClient.multicall({
    allowFailure: false,
    ...multicallOpts,
    blockNumber,
    contracts: binContracts as Parameters<PublicClient["multicall"]>[0]["contracts"],
  });

  const binStatesPacked = binResults[0] as unknown as readonly `0x${string}`[];
  const binSharesPacked = binResults[1] as unknown as readonly `0x${string}`[];
  const storedRows = binResults.slice(2) as unknown as Array<
    readonly [bigint, bigint, number | bigint]
  >;

  const decodedStates = decodeBinStatesBytes32(binStatesPacked);
  const totalShares = decodeBinTotalSharesBatch(binSharesPacked);

  const bins = binIndices.map((binIdx, i) => {
    const state = decodedStates[i]!;
    const stored = storedRows[i]!;
    const sinceTouch = blockTimestamp - BigInt(stored[2]);
    const elapsed = sinceTouch > 0n ? sinceTouch : 0n;
    return {
      binIdx,
      token0BalanceScaled: state.token0BalanceScaled,
      token1BalanceScaled: state.token1BalanceScaled,
      totalShares: totalShares[i] ?? 0n,
      highWatermark0: decayedHighWatermark(stored[0], config.decayPerSecondE18, elapsed),
      highWatermark1: decayedHighWatermark(stored[1], config.decayPerSecondE18, elapsed),
      storedHighWatermark0: stored[0],
      storedHighWatermark1: stored[1],
      secondsSinceLastTouch: elapsed,
    };
  });

  const evaluation = evaluateOracleStopLoss({
    bins,
    bidPriceX64,
    askPriceX64,
    drawdownE6: config.drawdownE6,
    decayPerSecondE18: config.decayPerSecondE18,
    minimalOperationalLiquidity: immutables.minimalOperationalLiquidity,
  });

  return {
    ...evaluation,
    config,
    bidPriceX64,
    askPriceX64,
    curBinIdx: Number(slot0[1]),
    lowestBin,
    highestBin,
    minimalOperationalLiquidity: immutables.minimalOperationalLiquidity,
    blockNumber,
    blockTimestamp,
  };
}
