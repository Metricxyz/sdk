/**
 * MetricAMM SDK - Factory Fee Collection
 */

import {
  erc20Abi,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { POOL_FACTORY_ABI } from "../constants.js";

export interface FactoryAssetBalance {
  asset: Address;
  amount: bigint;
  isNative: boolean;
}

export interface CollectFactoryFeesParams {
  publicClient: PublicClient;
  walletClient: WalletClient;
  factoryAddress: Address;
  target: Address;
  assets: Address[];
  account: Address;
  awaitReceipts?: boolean;
}

export interface CollectedFactoryFeeTx {
  asset: Address;
  amount: bigint;
  isNative: boolean;
  hash: Hex;
  receipt?: TransactionReceipt;
}

export interface CollectFactoryFeesResult {
  balances: FactoryAssetBalance[];
  collected: CollectedFactoryFeeTx[];
}

/**
 * Read balances for the provided asset list on the factory.
 * For ERC20 assets this uses multicall(balanceOf(factory)).
 * For native ETH (zero address), this uses getBalance(factory).
 */
export async function getFactoryAssetBalances(
  publicClient: PublicClient,
  factoryAddress: Address,
  assets: Address[],
): Promise<FactoryAssetBalance[]> {
  const uniqueAssets = dedupeAssets(assets);
  const nativeAsset = zeroAddress.toLowerCase();

  const erc20Assets = uniqueAssets.filter((asset) => asset.toLowerCase() !== nativeAsset);

  const erc20Balances = new Map<string, bigint>();

  if (erc20Assets.length > 0) {
    const results = await publicClient.multicall({
      contracts: erc20Assets.map((asset) => ({
        address: asset,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [factoryAddress],
      })),
      allowFailure: true,
    });

    const failedAssets: Address[] = [];

    results.forEach((result, index) => {
      const asset = erc20Assets[index];
      if (result.status === "success") {
        erc20Balances.set(asset.toLowerCase(), result.result as bigint);
        return;
      }
      failedAssets.push(asset);
    });

    if (failedAssets.length > 0) {
      throw new Error(`Failed to read ERC20 balances for: ${failedAssets.join(", ")}`);
    }
  }

  const nativeIncluded = uniqueAssets.some((asset) => asset.toLowerCase() === nativeAsset);

  const nativeBalance = nativeIncluded
    ? await publicClient.getBalance({ address: factoryAddress })
    : undefined;

  return uniqueAssets.map((asset) => {
    const isNative = asset.toLowerCase() === nativeAsset;

    return {
      asset,
      isNative,
      amount: isNative ? (nativeBalance ?? 0n) : (erc20Balances.get(asset.toLowerCase()) ?? 0n),
    };
  });
}

/**
 * Collect all non-zero balances for the provided assets from the factory,
 * sending each asset in a separate transaction.
 */
export async function collectFactoryFees(
  params: CollectFactoryFeesParams,
): Promise<CollectFactoryFeesResult> {
  const {
    publicClient,
    walletClient,
    factoryAddress,
    target,
    assets,
    account,
    awaitReceipts = true,
  } = params;

  const balances = await getFactoryAssetBalances(publicClient, factoryAddress, assets);

  const toCollect = balances.filter((item) => item.amount > 0n);
  const collected: CollectedFactoryFeeTx[] = [];

  for (const item of toCollect) {
    if (item.isNative) {
      const { request } = await publicClient.simulateContract({
        address: factoryAddress,
        abi: POOL_FACTORY_ABI,
        functionName: "collectETH",
        args: [target, item.amount],
        account,
      });

      const hash = await walletClient.writeContract(request);
      const tx: CollectedFactoryFeeTx = {
        asset: item.asset,
        amount: item.amount,
        isNative: true,
        hash,
      };

      if (awaitReceipts) {
        tx.receipt = await publicClient.waitForTransactionReceipt({ hash });
      }

      collected.push(tx);
      continue;
    }

    const { request } = await publicClient.simulateContract({
      address: factoryAddress,
      abi: POOL_FACTORY_ABI,
      functionName: "collectTokens",
      args: [item.asset, target, item.amount],
      account,
    });

    const hash = await walletClient.writeContract(request);
    const tx: CollectedFactoryFeeTx = {
      asset: item.asset,
      amount: item.amount,
      isNative: false,
      hash,
    };

    if (awaitReceipts) {
      tx.receipt = await publicClient.waitForTransactionReceipt({ hash });
    }

    collected.push(tx);
  }

  return {
    balances,
    collected,
  };
}

function dedupeAssets(assets: Address[]): Address[] {
  const deduped: Address[] = [];
  const seen = new Set<string>();

  for (const asset of assets) {
    const key = asset.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(asset);
  }

  return deduped;
}
