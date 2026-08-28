/**
 * MetricAMM SDK - Providers oracle: pool registration + blacklist.
 *
 * The abuse-protected providers oracle (smart-contracts-poc OracleBase: Pyth/Chainlink) only serves
 * attributed price reads for pools that are registered for a feed and not blacklisted. These helpers
 * read that status and perform the permissionless paid registration.
 */
import type { Address, Hex, PublicClient, TransactionReceipt, WalletClient } from "viem";
import { ORACLE_PROVIDER_ABI } from "../constants.js";

/** Combined registration/blacklist status of a pool for a feed on a given oracle. */
export interface PoolOracleStatus {
  /** Whether `pool` is registered for `feedId` (required for the attributed price read). */
  registered: boolean;
  /** Whether `pool` is blacklisted (reads are rejected regardless of registration). */
  blacklisted: boolean;
  /** Current registration fee (wei) required by `register`. */
  registrationFee: bigint;
}

export interface RegisterPoolParams {
  publicClient: PublicClient;
  walletClient: WalletClient;
  /** Address of the providers oracle (the price provider's `offchainOracle`). */
  oracleAddress: Address;
  feedId: Hex;
  /** Pool to register; must be recognized by `factory.isPool(pool)`. */
  pool: Address;
  /** An oracle-approved pool factory that recognizes `pool`. */
  factory: Address;
  /** Sender account. */
  account: Address;
  /** Fee to pay (wei). Defaults to the oracle's current `registrationFee()`. Overpayment is not refunded. */
  value?: bigint;
  /** Wait for the tx receipt (default true). */
  awaitReceipt?: boolean;
}

export interface RegisterPoolResult {
  hash: Hex;
  receipt?: TransactionReceipt;
}

/** Read the oracle's current registration fee (wei). */
export async function getRegistrationFee(
  publicClient: PublicClient,
  oracleAddress: Address,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: oracleAddress,
    abi: ORACLE_PROVIDER_ABI,
    functionName: "registrationFee",
  })) as bigint;
}

/** Whether `account` (typically a pool) is blacklisted on the oracle. */
export async function isPoolBlacklisted(
  publicClient: PublicClient,
  oracleAddress: Address,
  account: Address,
): Promise<boolean> {
  return (await publicClient.readContract({
    address: oracleAddress,
    abi: ORACLE_PROVIDER_ABI,
    functionName: "blacklisted",
    args: [account],
  })) as boolean;
}

/** Whether `pool` is registered for `feedId` on the oracle. */
export async function isPoolRegistered(
  publicClient: PublicClient,
  oracleAddress: Address,
  feedId: Hex,
  pool: Address,
): Promise<boolean> {
  return (await publicClient.readContract({
    address: oracleAddress,
    abi: ORACLE_PROVIDER_ABI,
    functionName: "registeredPool",
    args: [feedId, pool],
  })) as boolean;
}

/** Read registration + blacklist status and the current fee in a single multicall. */
export async function getPoolOracleStatus(
  publicClient: PublicClient,
  oracleAddress: Address,
  feedId: Hex,
  pool: Address,
): Promise<PoolOracleStatus> {
  const [registered, blacklisted, registrationFee] = (await publicClient.multicall({
    allowFailure: false,
    contracts: [
      {
        address: oracleAddress,
        abi: ORACLE_PROVIDER_ABI,
        functionName: "registeredPool",
        args: [feedId, pool],
      },
      {
        address: oracleAddress,
        abi: ORACLE_PROVIDER_ABI,
        functionName: "blacklisted",
        args: [pool],
      },
      { address: oracleAddress, abi: ORACLE_PROVIDER_ABI, functionName: "registrationFee" },
    ],
  })) as [boolean, boolean, bigint];

  return { registered, blacklisted, registrationFee };
}

/**
 * Permissionless paid registration: whitelist `pool` for `feedId` on the oracle (and clear any
 * blacklist on the pool). Pays `value` (defaults to the current `registrationFee`); the `factory`
 * must be oracle-approved and recognize `pool` via `isPool`.
 */
export async function registerPool(params: RegisterPoolParams): Promise<RegisterPoolResult> {
  const {
    publicClient,
    walletClient,
    oracleAddress,
    feedId,
    pool,
    factory,
    account,
    awaitReceipt = true,
  } = params;

  const value = params.value ?? (await getRegistrationFee(publicClient, oracleAddress));

  const { request } = await publicClient.simulateContract({
    address: oracleAddress,
    abi: ORACLE_PROVIDER_ABI,
    functionName: "register",
    args: [feedId, pool, factory],
    value,
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = awaitReceipt ? await publicClient.waitForTransactionReceipt({ hash }) : undefined;

  return { hash, receipt };
}
