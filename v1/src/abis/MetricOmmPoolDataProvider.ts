export const MetricOmmPoolDataProviderAbi = [
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
    inputs: [],
    name: "BidDepthBinAvgExecPriceZero",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidDistance",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidFactory",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidNotionalFee",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidOraclePrice",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidPriceProvider",
    type: "error",
  },
  {
    inputs: [],
    name: "MaxBinsPerSideTooLarge",
    type: "error",
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
        name: "target",
        type: "address",
      },
      {
        internalType: "bytes4",
        name: "selector",
        type: "bytes4",
      },
      {
        internalType: "bytes",
        name: "reason",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "additionalInfo",
        type: "bytes",
      },
    ],
    name: "WrappedError",
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
    ],
    name: "currentPriceX64",
    outputs: [
      {
        internalType: "uint256",
        name: "currentPriceX64Value",
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
    name: "distanceFromProvidedPriceX64",
    outputs: [
      {
        internalType: "int256",
        name: "distanceX64",
        type: "int256",
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
    name: "getBestBidAndAsk",
    outputs: [
      {
        internalType: "uint128",
        name: "bestBidX64",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "bestAskX64",
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
      {
        internalType: "uint8",
        name: "maxBinsPerSide",
        type: "uint8",
      },
    ],
    name: "getLiquidityDepth",
    outputs: [
      {
        components: [
          {
            internalType: "uint128",
            name: "oracleBidX64",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "oracleAskX64",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "referenceBestBidX64",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "referenceBestAskX64",
            type: "uint128",
          },
          {
            components: [
              {
                internalType: "int8",
                name: "binIdx",
                type: "int8",
              },
              {
                internalType: "uint256",
                name: "amountInBin",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "amountCumulative",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "binAvgExecPriceX64",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "cumulativeAvgExecPriceX64",
                type: "uint256",
              },
            ],
            internalType: "struct MetricOmmPoolDataProvider.DepthLevel[]",
            name: "asks",
            type: "tuple[]",
          },
          {
            components: [
              {
                internalType: "int8",
                name: "binIdx",
                type: "int8",
              },
              {
                internalType: "uint256",
                name: "amountInBin",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "amountCumulative",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "binAvgExecPriceX64",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "cumulativeAvgExecPriceX64",
                type: "uint256",
              },
            ],
            internalType: "struct MetricOmmPoolDataProvider.DepthLevel[]",
            name: "bids",
            type: "tuple[]",
          },
        ],
        internalType: "struct MetricOmmPoolDataProvider.LiquidityDepth",
        name: "depth",
        type: "tuple",
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
      {
        internalType: "bool",
        name: "zeroForOne",
        type: "bool",
      },
      {
        internalType: "int128",
        name: "amountSpecified",
        type: "int128",
      },
      {
        internalType: "uint128",
        name: "priceLimitX64",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "bidPriceX64",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "askPriceX64",
        type: "uint128",
      },
    ],
    name: "quoteSwap",
    outputs: [
      {
        internalType: "int128",
        name: "amount0Delta",
        type: "int128",
      },
      {
        internalType: "int128",
        name: "amount1Delta",
        type: "int128",
      },
    ],
    stateMutability: "nonpayable",
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
