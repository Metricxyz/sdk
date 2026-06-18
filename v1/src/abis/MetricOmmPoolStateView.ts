export const MetricOmmPoolStateViewAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "factory",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "bits",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "SafeCastOverflowedUintDowncast",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        internalType: "int8",
        name: "binIdx",
        type: "int8",
      },
    ],
    name: "binState",
    outputs: [
      {
        internalType: "uint104",
        name: "token0BalanceScaled",
        type: "uint104",
      },
      {
        internalType: "uint104",
        name: "token1BalanceScaled",
        type: "uint104",
      },
      {
        internalType: "uint16",
        name: "lengthE6",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "addFeeBuyE6",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "addFeeSellE6",
        type: "uint16",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        internalType: "int8[]",
        name: "binIdxs",
        type: "int8[]",
      },
    ],
    name: "binStates",
    outputs: [
      {
        internalType: "bytes32[]",
        name: "",
        type: "bytes32[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        internalType: "int8",
        name: "binIdx",
        type: "int8",
      },
    ],
    name: "binTotalShares",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        internalType: "int8[]",
        name: "binIdxs",
        type: "int8[]",
      },
    ],
    name: "binTotalShares",
    outputs: [
      {
        internalType: "bytes32[]",
        name: "",
        type: "bytes32[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "positionBinKey",
        type: "bytes32",
      },
    ],
    name: "positionBinShares",
    outputs: [
      {
        internalType: "uint104",
        name: "",
        type: "uint104",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "uint80",
        name: "salt",
        type: "uint80",
      },
      {
        internalType: "int8",
        name: "bin",
        type: "int8",
      },
    ],
    name: "positionBinShares",
    outputs: [
      {
        internalType: "uint104",
        name: "",
        type: "uint104",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
      },
    ],
    name: "priceProvider",
    outputs: [
      {
        internalType: "address",
        name: "",
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
        name: "pool",
        type: "address",
      },
    ],
    name: "slot0",
    outputs: [
      {
        internalType: "uint8",
        name: "_pauseLevel",
        type: "uint8",
      },
      {
        internalType: "int8",
        name: "_curBinIdx",
        type: "int8",
      },
      {
        internalType: "uint104",
        name: "_curPosInBin",
        type: "uint104",
      },
      {
        internalType: "int24",
        name: "_curBinDistFromProvidedPrice",
        type: "int24",
      },
      {
        internalType: "uint24",
        name: "_spreadFeeE6",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "_notionalFeeE8",
        type: "uint24",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
      },
    ],
    name: "slot1",
    outputs: [
      {
        internalType: "uint128",
        name: "totalScaledToken0InBins",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "totalScaledToken1InBins",
        type: "uint128",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
      },
    ],
    name: "slot2",
    outputs: [
      {
        internalType: "uint128",
        name: "notionalFeeToken0Scaled",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "notionalFeeToken1Scaled",
        type: "uint128",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
