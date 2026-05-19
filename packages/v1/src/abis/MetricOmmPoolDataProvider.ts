export const MetricOmmPoolDataProviderAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "factory",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "binState",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
      {
        name: "binIdx",
        type: "int8",
        internalType: "int8",
      },
    ],
    outputs: [
      {
        name: "token0BalanceScaled",
        type: "uint104",
        internalType: "uint104",
      },
      {
        name: "token1BalanceScaled",
        type: "uint104",
        internalType: "uint104",
      },
      {
        name: "lengthE6",
        type: "uint16",
        internalType: "uint16",
      },
      {
        name: "addFeeBuyE6",
        type: "uint16",
        internalType: "uint16",
      },
      {
        name: "addFeeSellE6",
        type: "uint16",
        internalType: "uint16",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "binStates",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
      {
        name: "binIdxs",
        type: "int8[]",
        internalType: "int8[]",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes32[]",
        internalType: "bytes32[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "binTotalShares",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
      {
        name: "binIdx",
        type: "int8",
        internalType: "int8",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "binTotalShares",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
      {
        name: "binIdxs",
        type: "int8[]",
        internalType: "int8[]",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes32[]",
        internalType: "bytes32[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "currentPriceX64",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "currentPriceX64Value",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "distanceFromProvidedPriceX64",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "distanceX64",
        type: "int256",
        internalType: "int256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBestBidAndAsk",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "bestBidX64",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "bestAskX64",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLiquidityDepth",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
      {
        name: "maxBinsPerSide",
        type: "uint8",
        internalType: "uint8",
      },
    ],
    outputs: [
      {
        name: "depth",
        type: "tuple",
        internalType: "struct MetricOmmPoolDataProvider.LiquidityDepth",
        components: [
          {
            name: "oracleBidX64",
            type: "uint128",
            internalType: "uint128",
          },
          {
            name: "oracleAskX64",
            type: "uint128",
            internalType: "uint128",
          },
          {
            name: "referenceBestBidX64",
            type: "uint128",
            internalType: "uint128",
          },
          {
            name: "referenceBestAskX64",
            type: "uint128",
            internalType: "uint128",
          },
          {
            name: "asks",
            type: "tuple[]",
            internalType: "struct MetricOmmPoolDataProvider.DepthLevel[]",
            components: [
              {
                name: "binIdx",
                type: "int8",
                internalType: "int8",
              },
              {
                name: "amountInBin",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "amountCumulative",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "binAvgExecPriceX64",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "cumulativeAvgExecPriceX64",
                type: "uint256",
                internalType: "uint256",
              },
            ],
          },
          {
            name: "bids",
            type: "tuple[]",
            internalType: "struct MetricOmmPoolDataProvider.DepthLevel[]",
            components: [
              {
                name: "binIdx",
                type: "int8",
                internalType: "int8",
              },
              {
                name: "amountInBin",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "amountCumulative",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "binAvgExecPriceX64",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "cumulativeAvgExecPriceX64",
                type: "uint256",
                internalType: "uint256",
              },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "positionBinShares",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
      {
        name: "positionBinKey",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint104",
        internalType: "uint104",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "positionBinShares",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "salt",
        type: "uint80",
        internalType: "uint80",
      },
      {
        name: "bin",
        type: "int8",
        internalType: "int8",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint104",
        internalType: "uint104",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "priceProvider",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "quoteSwap",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
      {
        name: "zeroForOne",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "amountSpecified",
        type: "int128",
        internalType: "int128",
      },
      {
        name: "priceLimitX64",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "bidPriceX64",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "askPriceX64",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    outputs: [
      {
        name: "amount0Delta",
        type: "int128",
        internalType: "int128",
      },
      {
        name: "amount1Delta",
        type: "int128",
        internalType: "int128",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "slot0",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "_pauseLevel",
        type: "uint8",
        internalType: "uint8",
      },
      {
        name: "_curBinIdx",
        type: "int8",
        internalType: "int8",
      },
      {
        name: "_curPosInBin",
        type: "uint104",
        internalType: "uint104",
      },
      {
        name: "_curBinDistFromProvidedPrice",
        type: "int24",
        internalType: "int24",
      },
      {
        name: "_spreadFeeE6",
        type: "uint24",
        internalType: "uint24",
      },
      {
        name: "_notionalFeeE8",
        type: "uint24",
        internalType: "uint24",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "slot1",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "totalScaledToken0InBins",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "totalScaledToken1InBins",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "slot2",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "notionalFeeToken0Scaled",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "notionalFeeToken1Scaled",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "error",
    name: "BidDepthBinAvgExecPriceZero",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidDistance",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidFactory",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidNotionalFee",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidOraclePrice",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidPriceProvider",
    inputs: [],
  },
  {
    type: "error",
    name: "MaxBinsPerSideTooLarge",
    inputs: [],
  },
  {
    type: "error",
    name: "SafeCastOverflowedUintDowncast",
    inputs: [
      {
        name: "bits",
        type: "uint8",
        internalType: "uint8",
      },
      {
        name: "value",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "WrappedError",
    inputs: [
      {
        name: "target",
        type: "address",
        internalType: "address",
      },
      {
        name: "selector",
        type: "bytes4",
        internalType: "bytes4",
      },
      {
        name: "reason",
        type: "bytes",
        internalType: "bytes",
      },
      {
        name: "additionalInfo",
        type: "bytes",
        internalType: "bytes",
      },
    ],
  },
] as const;
