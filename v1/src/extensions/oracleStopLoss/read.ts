/**
 * On-chain reads for OracleValueStopLossExtension status.
 * Callers only supply bid/ask; pool data is loaded from chain.
 */

import type { Abi, Address, PublicClient } from "viem";
import { MetricOmmPoolAbi } from "../../abis/MetricOmmPool.js";
import { MetricOmmPoolDataProviderAbi } from "../../abis/MetricOmmPoolDataProvider.js";
import { OracleValueStopLossExtensionAbi } from "../../abis/OracleValueStopLossExtension.js";
import {
  decodeBinStatesBytes32,
  decodeBinTotalSharesBatch,
} from "../../utils/poolState.js";
import { evaluateOracleStopLoss, type OracleStopLossEvaluation } from "./evaluate.js";

export interface OracleStopLossConfig {
  drawdownE6: number;
  decayPerSecondE8: number;
  timelock: number;
  initialized: boolean;
}

export interface GetOracleStopLossAnyBinStatusParams {
  publicClient: PublicClient;
  /** OracleValueStopLossExtension address. */
  extension: Address;
  dataProvider: Address;
  pool: Address;
  /** Current oracle bid (Q64.64). */
  bidPriceX64: bigint;
  /** Current oracle ask (Q64.64). */
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
  minimalMintableLiquidity: bigint;
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
  })) as readonly [number, number, number, boolean];

  return {
    drawdownE6: Number(result[0]),
    decayPerSecondE8: Number(result[1]),
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
    decayPerSecondE8: Number(result[1]),
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
 * 1. Multicall: immutables + config + slot0 (to learn `[lowestBin, highestBin]`)
 * 2. Multicall: bin states/shares + current watermarks for that range only
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

  const multicallOpts = publicClient.chain?.contracts?.multicall3?.address
    ? { multicallAddress: publicClient.chain.contracts.multicall3.address }
    : { deployless: true as const };

  const bootstrap = await publicClient.multicall({
    allowFailure: false,
    ...multicallOpts,
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
    minimalMintableLiquidity: bigint;
    lowestBin: number | bigint;
    highestBin: number | bigint;
  };
  const config = parseConfig(
    bootstrap[1] as unknown as readonly [number | bigint, number | bigint, number | bigint, boolean],
  );
  const slot0 = bootstrap[2] as unknown as readonly [number | bigint, number | bigint, ...unknown[]];

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
        functionName: "currentHighWatermarks",
        args: [pool, binIdx],
      }),
    ),
  ];

  const binResults = await publicClient.multicall({
    allowFailure: false,
    ...multicallOpts,
    contracts: binContracts as Parameters<PublicClient["multicall"]>[0]["contracts"],
  });

  const binStatesPacked = binResults[0] as unknown as readonly `0x${string}`[];
  const binSharesPacked = binResults[1] as unknown as readonly `0x${string}`[];
  const watermarkRows = binResults.slice(2) as unknown as Array<readonly [bigint, bigint]>;

  const decodedStates = decodeBinStatesBytes32(binStatesPacked);
  const totalShares = decodeBinTotalSharesBatch(binSharesPacked);

  const bins = binIndices.map((binIdx, i) => {
    const state = decodedStates[i]!;
    const hwm = watermarkRows[i]!;
    return {
      binIdx,
      token0BalanceScaled: state.token0BalanceScaled,
      token1BalanceScaled: state.token1BalanceScaled,
      totalShares: totalShares[i] ?? 0n,
      highWatermark0: hwm[0],
      highWatermark1: hwm[1],
    };
  });

  const evaluation = evaluateOracleStopLoss({
    bins,
    bidPriceX64,
    askPriceX64,
    drawdownE6: config.drawdownE6,
    decayPerSecondE8: config.decayPerSecondE8,
    minimalMintableLiquidity: immutables.minimalMintableLiquidity,
  });

  return {
    ...evaluation,
    config,
    bidPriceX64,
    askPriceX64,
    curBinIdx: Number(slot0[1]),
    lowestBin,
    highestBin,
    minimalMintableLiquidity: immutables.minimalMintableLiquidity,
  };
}
