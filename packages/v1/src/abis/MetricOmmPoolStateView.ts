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
    ],
    name: "admin",
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
    name: "adminFeeDestination",
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
    name: "adminSpreadFeeE6",
    outputs: [
      {
        internalType: "uint24",
        name: "",
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
        name: "token0Balance",
        type: "uint104",
      },
      {
        internalType: "uint104",
        name: "token1Balance",
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
        internalType: "int8",
        name: "binIdx",
        type: "int8",
      },
    ],
    name: "binStateScaled",
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
        internalType: "uint104[]",
        name: "token0Balances",
        type: "uint104[]",
      },
      {
        internalType: "uint104[]",
        name: "token1Balances",
        type: "uint104[]",
      },
      {
        internalType: "uint16[]",
        name: "lengthsInUnits",
        type: "uint16[]",
      },
      {
        internalType: "uint16[]",
        name: "addFeeBuysE6",
        type: "uint16[]",
      },
      {
        internalType: "uint16[]",
        name: "addFeeSellsE6",
        type: "uint16[]",
      },
      {
        internalType: "uint104[]",
        name: "totalShares",
        type: "uint104[]",
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
    name: "curBinDistFromProvidedPriceE6",
    outputs: [
      {
        internalType: "int24",
        name: "",
        type: "int24",
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
    name: "curBinIdx",
    outputs: [
      {
        internalType: "int8",
        name: "",
        type: "int8",
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
    name: "curPosInBin",
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
    name: "feeConfig",
    outputs: [
      {
        internalType: "address",
        name: "adminAddr",
        type: "address",
      },
      {
        internalType: "uint24",
        name: "protocolSpreadFee",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "adminSpreadFee",
        type: "uint24",
      },
      {
        internalType: "address",
        name: "adminFeeDest",
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
    name: "getScaleMultipliers",
    outputs: [
      {
        internalType: "uint256",
        name: "token0ScaleMultiplier",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "token1ScaleMultiplier",
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
    ],
    name: "notionalFeeE8",
    outputs: [
      {
        internalType: "uint24",
        name: "",
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
    name: "notionalFeeToken0Scaled",
    outputs: [
      {
        internalType: "uint128",
        name: "",
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
    name: "notionalFeeToken1Scaled",
    outputs: [
      {
        internalType: "uint128",
        name: "",
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
    name: "pauseLevel",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
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
    name: "paused",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
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
    name: "pendingPriceProvider",
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
    name: "pendingPriceProviderExecuteAfter",
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
    name: "protocolSpreadFeeE6",
    outputs: [
      {
        internalType: "uint24",
        name: "",
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
        name: "_totalScaledToken0InBins",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "_totalScaledToken1InBins",
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
    name: "spreadFeeE6",
    outputs: [
      {
        internalType: "uint24",
        name: "",
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
    name: "totalToken0InBins",
    outputs: [
      {
        internalType: "uint128",
        name: "",
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
    name: "totalToken1InBins",
    outputs: [
      {
        internalType: "uint128",
        name: "",
        type: "uint128",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
