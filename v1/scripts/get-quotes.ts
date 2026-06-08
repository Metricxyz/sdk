/**
 * Get quotes for all 4 swap combinations on a fixed pool:
 *   - exact-in  token0 -> token1 (pay 10 token0)
 *   - exact-in  token1 -> token0 (pay 10 token1)
 *   - exact-out token0 -> token1 (receive 10 token1)
 *   - exact-out token1 -> token0 (receive 10 token0)
 *
 * Usage:
 *   npx hardhat run scripts/get-quotes.ts --network base
 */
// @ts-nocheck - viem version mismatch between hardhat and sdk

import { network } from "hardhat";
import { formatUnits, parseUnits, erc20Abi, zeroAddress } from "viem";
import * as sdk from "../index.js";
import { PriceProviderUiAbi } from "../src/abis/PriceProviderUi.js";
import { POOL_ABI, SWAPPER_ABI } from "../src/constants.js";

const POOL_ADDRESS = "0x9C9fd348505A7202Fd819D8cb5003248d920d279" as const;

function x64ToHumanPrice(priceX64: bigint, decimals0: number, decimals1: number): string {
  const scale = 10n ** 18n;
  const adjusted =
    (priceX64 * scale * 10n ** BigInt(decimals0)) / (sdk.Q64 * 10n ** BigInt(decimals1));
  return (Number(adjusted) / Number(scale)).toPrecision(6);
}

const { viem } = await network.connect();
const publicClient = await viem.getPublicClient();
const chainId = await publicClient.getChainId();
const addresses = sdk.getAddressesOrThrow(chainId);

// v1: token pair and oracle come from pool `getImmutables()`.
const imm = await publicClient.readContract({
  address: POOL_ADDRESS,
  abi: POOL_ABI,
  functionName: "getImmutables",
});
const token0 = imm.token0 as `0x${string}`;
const token1 = imm.token1 as `0x${string}`;
const priceProviderAddress = imm.immutablePriceProvider as `0x${string}`;

// Round 2: token metadata + bid/ask prices (depend on round 1)
const [symbol0, decimals0, symbol1, decimals1, [bidPriceX64, askPriceX64]] =
  await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { address: token0, abi: erc20Abi, functionName: "symbol" },
      { address: token0, abi: erc20Abi, functionName: "decimals" },
      { address: token1, abi: erc20Abi, functionName: "symbol" },
      { address: token1, abi: erc20Abi, functionName: "decimals" },
      {
        address: priceProviderAddress,
        abi: PriceProviderUiAbi,
        functionName: "getBidAndAskPriceUi",
      },
    ],
  });

const one0 = parseUnits("1000", decimals0);
const one1 = parseUnits("1000", decimals1);

const cases = [
  {
    label: `exact-in  ${symbol0} -> ${symbol1}`,
    zeroForOne: true,
    amountSpecified: one0,
    inDecimals: decimals0,
    outDecimals: decimals1,
    inSymbol: symbol0,
    outSymbol: symbol1,
  },
  {
    label: `exact-in  ${symbol1} -> ${symbol0}`,
    zeroForOne: false,
    amountSpecified: one1,
    inDecimals: decimals1,
    outDecimals: decimals0,
    inSymbol: symbol1,
    outSymbol: symbol0,
  },
  {
    label: `exact-out ${symbol0} -> ${symbol1}`,
    zeroForOne: true,
    amountSpecified: -one1,
    inDecimals: decimals0,
    outDecimals: decimals1,
    inSymbol: symbol0,
    outSymbol: symbol1,
  },
  {
    label: `exact-out ${symbol1} -> ${symbol0}`,
    zeroForOne: false,
    amountSpecified: -one0,
    inDecimals: decimals1,
    outDecimals: decimals0,
    inSymbol: symbol1,
    outSymbol: symbol0,
  },
];

// Round 3: all 4 quoteSwap calls (depend on round 2)
const quoteResults = await publicClient.multicall({
  allowFailure: true,
  contracts: cases.map((c) => ({
    address: addresses.swapper,
    abi: SWAPPER_ABI,
    functionName: "quoteSwap",
    args: [
      POOL_ADDRESS,
      zeroAddress,
      c.zeroForOne,
      c.amountSpecified,
      c.zeroForOne ? 0n : sdk.MAX_UINT128,
      bidPriceX64,
      askPriceX64,
      "0x",
    ],
  })),
});

console.log(`\nPool:       ${POOL_ADDRESS}`);
console.log(`Token0:     ${symbol0} (${token0})`);
console.log(`Token1:     ${symbol1} (${token1})`);
console.log(`Provider:   ${priceProviderAddress}`);
console.log(
  `Bid price:  ${x64ToHumanPrice(bidPriceX64, decimals0, decimals1)} ${symbol1}/${symbol0}`,
);
console.log(
  `Ask price:  ${x64ToHumanPrice(askPriceX64, decimals0, decimals1)} ${symbol1}/${symbol0}\n`,
);
console.log("=".repeat(70));

for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const result = quoteResults[i];

  console.log(c.label);
  if (result.status === "failure") {
    console.log(`  ERROR: ${result.error?.message ?? "unknown error"}`);
  } else {
    const [amount0Delta, amount1Delta] = result.result as [bigint, bigint];
    const amountIn = c.zeroForOne
      ? amount0Delta < 0n
        ? -amount0Delta
        : amount0Delta
      : amount1Delta < 0n
        ? -amount1Delta
        : amount1Delta;
    const amountOut = c.zeroForOne
      ? amount1Delta < 0n
        ? -amount1Delta
        : amount1Delta
      : amount0Delta < 0n
        ? -amount0Delta
        : amount0Delta;
    console.log(`  pay:     ${formatUnits(amountIn, c.inDecimals)}  ${c.inSymbol}`);
    console.log(`  receive: ${formatUnits(amountOut, c.outDecimals)} ${c.outSymbol}`);
  }
  console.log();
}
