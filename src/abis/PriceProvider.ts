export const PriceProviderAbi = [
  {
    inputs: [],
    name: "getBidAndAskPrice",
    outputs: [
      {
        internalType: "uint128",
        name: "bidPrice",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "askPrice",
        type: "uint128",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "token0",
    outputs: [
      {
        internalType: "address",
        name: "baseToken",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token1",
    outputs: [
      {
        internalType: "address",
        name: "quoteToken",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
