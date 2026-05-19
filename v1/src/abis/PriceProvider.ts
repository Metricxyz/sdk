export const PriceProviderAbi = [
  {
    inputs: [],
    name: "getAskPrice",
    outputs: [
      {
        internalType: "uint256",
        name: "askPrice",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAskPriceUi",
    outputs: [
      {
        internalType: "uint256",
        name: "askPrice",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
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
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getBidAndAskPriceUi",
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
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getBidPrice",
    outputs: [
      {
        internalType: "uint256",
        name: "bidPrice",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getBidPriceUi",
    outputs: [
      {
        internalType: "uint256",
        name: "bidPrice",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTokens",
    outputs: [
      {
        internalType: "address",
        name: "baseToken",
        type: "address",
      },
      {
        internalType: "address",
        name: "quoteToken",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
    ],
    name: "removeClOracle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "int256",
        name: "newCexStep",
        type: "int256",
      },
    ],
    name: "setCexStep",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        internalType: "address",
        name: "oracle",
        type: "address",
      },
      {
        internalType: "uint32",
        name: "heartbeat",
        type: "uint32",
      },
    ],
    name: "setClOracle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "newValue",
        type: "uint256",
      },
    ],
    name: "setConfidenceParam",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint16",
        name: "newMaxDeviation",
        type: "uint16",
      },
    ],
    name: "setMaxClDeviation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
