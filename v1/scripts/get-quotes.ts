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
import { formatUnits, parseUnits, erc20Abi } from "viem";
import * as sdk from "../src/index.js";
import { POOL_ABI, QUOTER_ABI } from "../src/constants.js";

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

if (addresses.quoter === "0x0000000000000000000000000000000000000000") {
  throw new Error("Configure addresses.quoter in src/addresses.ts before running get-quotes");
}

const imm = await publicClient.readContract({
  address: POOL_ADDRESS,
  abi: POOL_ABI,
  functionName: "getImmutables",
});
const token0 = imm.token0 as `0x${string}`;
const token1 = imm.token1 as `0x${string}`;
const priceProviderAddress = imm.immutablePriceProvider as `0x${string}`;

const [symbol0, decimals0, symbol1, decimals1, [sellPriceX64, buyPriceX64]] =
  await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { address: token0, abi: erc20Abi, functionName: "symbol" },
      { address: token0, abi: erc20Abi, functionName: "decimals" },
      { address: token1, abi: erc20Abi, functionName: "symbol" },
      { address: token1, abi: erc20Abi, functionName: "decimals" },
      {
        address: POOL_ADDRESS,
        abi: POOL_ABI,
        functionName: "getSellAndBuyPrices",
      },
    ],
  });

const one0 = parseUnits("1000", decimals0);
const one1 = parseUnits("1000", decimals1);

const exactInCases = [
  {
    label: `exact-in  ${symbol0} -> ${symbol1}`,
    zeroForOne: true,
    amountIn: one0,
    inDecimals: decimals0,
    outDecimals: decimals1,
    inSymbol: symbol0,
    outSymbol: symbol1,
  },
  {
    label: `exact-in  ${symbol1} -> ${symbol0}`,
    zeroForOne: false,
    amountIn: one1,
    inDecimals: decimals1,
    outDecimals: decimals0,
    inSymbol: symbol1,
    outSymbol: symbol0,
  },
];

const exactOutCases = [
  {
    label: `exact-out ${symbol0} -> ${symbol1}`,
    zeroForOne: true,
    amountOut: one1,
    inDecimals: decimals0,
    outDecimals: decimals1,
    inSymbol: symbol0,
    outSymbol: symbol1,
  },
  {
    label: `exact-out ${symbol1} -> ${symbol0}`,
    zeroForOne: false,
    amountOut: one0,
    inDecimals: decimals1,
    outDecimals: decimals0,
    inSymbol: symbol1,
    outSymbol: symbol0,
  },
];

const quoteResults = await publicClient.multicall({
  allowFailure: true,
  contracts: [
    ...exactInCases.map((c) => ({
      address: addresses.quoter,
      abi: QUOTER_ABI,
      functionName: "quoteLiveExactInSingle" as const,
      args: [
        POOL_ADDRESS,
        "0x0000000000000000000000000000000000000000",
        c.zeroForOne,
        c.amountIn,
        c.zeroForOne ? 0n : sdk.MAX_UINT128,
        "0x",
      ],
    })),
    ...exactOutCases.map((c) => ({
      address: addresses.quoter,
      abi: QUOTER_ABI,
      functionName: "quoteLiveExactOutSingle" as const,
      args: [
        POOL_ADDRESS,
        "0x0000000000000000000000000000000000000000",
        c.zeroForOne,
        c.amountOut,
        c.zeroForOne ? 0n : sdk.MAX_UINT128,
        "0x",
      ],
    })),
  ],
});

console.log(`\nPool:       ${POOL_ADDRESS}`);
console.log(`Token0:     ${symbol0} (${token0})`);
console.log(`Token1:     ${symbol1} (${token1})`);
console.log(`Provider:   ${priceProviderAddress}`);
console.log(
  `Sell price: ${x64ToHumanPrice(sellPriceX64, decimals0, decimals1)} ${symbol1}/${symbol0}`,
);
console.log(
  `Buy price:  ${x64ToHumanPrice(buyPriceX64, decimals0, decimals1)} ${symbol1}/${symbol0}\n`,
);
console.log("=".repeat(70));

const allCases = [...exactInCases, ...exactOutCases];
for (let i = 0; i < allCases.length; i++) {
  const c = allCases[i];
  const result = quoteResults[i];

  console.log(c.label);
  if (result.status === "failure") {
    console.log(`  ERROR: ${result.error?.message ?? "unknown error"}`);
  } else {
    const [amountIn, amountOut] = result.result as [bigint, bigint];
    console.log(`  pay:     ${formatUnits(amountIn, c.inDecimals)}  ${c.inSymbol}`);
    console.log(`  receive: ${formatUnits(amountOut, c.outDecimals)} ${c.outSymbol}`);
  }
  console.log();
}
