export const MetricOmmPoolAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_factory",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_admin",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_token0",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_token1",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_priceProvider",
        "type": "address"
      },
      {
        "internalType": "uint104",
        "name": "initialScaledAmount0PerShareE18",
        "type": "uint104"
      },
      {
        "internalType": "uint104",
        "name": "initialScaledAmount1PerShareE18",
        "type": "uint104"
      },
      {
        "internalType": "uint104",
        "name": "minimalMintableLiquidity",
        "type": "uint104"
      },
      {
        "internalType": "bool",
        "name": "reportSwapToPriceProvider",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "maxDriftE8",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "driftDecayPerSecondE8",
        "type": "uint256"
      },
      {
        "internalType": "uint24",
        "name": "_protocolFee",
        "type": "uint24"
      },
      {
        "internalType": "uint24",
        "name": "_adminFee",
        "type": "uint24"
      },
      {
        "internalType": "address",
        "name": "_adminFeeDestination",
        "type": "address"
      },
      {
        "internalType": "int32",
        "name": "_curBinDistFromProvidedPrice",
        "type": "int32"
      },
      {
        "internalType": "uint256[]",
        "name": "nonNegativeBinDataArray",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "negativeBinDataArray",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "int128",
        "name": "actual",
        "type": "int128"
      },
      {
        "internalType": "int128",
        "name": "specified",
        "type": "int128"
      }
    ],
    "name": "Amount0BelowSpecified",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "int128",
        "name": "actual",
        "type": "int128"
      },
      {
        "internalType": "int128",
        "name": "specified",
        "type": "int128"
      }
    ],
    "name": "Amount1BelowSpecified",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "BidGreaterThanAsk",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "BidIsZero",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "BinArraysEmpty",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "int16",
        "name": "binIdx",
        "type": "int16"
      }
    ],
    "name": "BinLengthZero",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "int16",
        "name": "binIdx",
        "type": "int16"
      },
      {
        "internalType": "int64",
        "name": "cumulativeDistance",
        "type": "int64"
      },
      {
        "internalType": "bool",
        "name": "overflow",
        "type": "bool"
      }
    ],
    "name": "CumulativeDistanceArthmetic",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DistanceTooNegative",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DriftLimitExceeded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "IncorrectDelta",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientAmount",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint104",
        "name": "requested",
        "type": "uint104"
      },
      {
        "internalType": "uint104",
        "name": "available",
        "type": "uint104"
      }
    ],
    "name": "InsufficientLiquidity",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAmount",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "int16",
        "name": "bin",
        "type": "int16"
      }
    ],
    "name": "InvalidBinIndex",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidTickRange",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint104",
        "name": "afterOperation",
        "type": "uint104"
      },
      {
        "internalType": "uint104",
        "name": "minimalRequired",
        "type": "uint104"
      }
    ],
    "name": "MinimalLiquidity",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OnlyAdmin",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OnlyFactory",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PoolLocked",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PositionNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "bits",
        "type": "uint8"
      },
      {
        "internalType": "int256",
        "name": "value",
        "type": "int256"
      }
    ],
    "name": "SafeCastOverflowedIntDowncast",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "bits",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "SafeCastOverflowedUintDowncast",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "SafeCastOverflowedUintToInt",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "int128",
        "name": "amount0Delta",
        "type": "int128"
      },
      {
        "internalType": "int128",
        "name": "amount1Delta",
        "type": "int128"
      }
    ],
    "name": "SimulateSwap",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ToHighNewFee",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TooManyNegativeBins",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TooManyNonNegativeBins",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "internalType": "bytes4",
        "name": "selector",
        "type": "bytes4"
      },
      {
        "internalType": "bytes",
        "name": "reason",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "details",
        "type": "bytes"
      }
    ],
    "name": "WrappedError",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "WrongBinArrays",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "newAdminFeeDestination",
        "type": "address"
      }
    ],
    "name": "AdminFeeDestinationUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint24",
        "name": "newAdminFee",
        "type": "uint24"
      }
    ],
    "name": "AdminFeeUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "factory",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "token0",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "token1",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "priceProvider",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint104",
        "name": "initialToken0DensityPerLiquidityE18",
        "type": "uint104"
      },
      {
        "indexed": false,
        "internalType": "uint104",
        "name": "initialToken1DensityPerLiquidityE18",
        "type": "uint104"
      },
      {
        "indexed": false,
        "internalType": "uint104",
        "name": "minimalMintableLiquidity",
        "type": "uint104"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "maxDriftE8",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "driftDecayPerSecondE8",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint24",
        "name": "protocolFeeE6",
        "type": "uint24"
      },
      {
        "indexed": false,
        "internalType": "uint24",
        "name": "adminFeeE6",
        "type": "uint24"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "adminFeeDestination",
        "type": "address"
      }
    ],
    "name": "Instantiated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "provider",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint80",
        "name": "salt",
        "type": "uint80"
      },
      {
        "indexed": false,
        "internalType": "int128",
        "name": "amount0Delta",
        "type": "int128"
      },
      {
        "indexed": false,
        "internalType": "int128",
        "name": "amount1Delta",
        "type": "int128"
      },
      {
        "indexed": false,
        "internalType": "int16[]",
        "name": "bins",
        "type": "int16[]"
      },
      {
        "indexed": false,
        "internalType": "int104[]",
        "name": "deltaShares",
        "type": "int104[]"
      }
    ],
    "name": "LiquidityModified",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "newPriceProvider",
        "type": "address"
      }
    ],
    "name": "PriceProviderUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint24",
        "name": "newProtocolFee",
        "type": "uint24"
      }
    ],
    "name": "ProtocolFeeUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount0ToProtocol",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount1ToProtocol",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount0ToAdmin",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount1ToAdmin",
        "type": "uint256"
      }
    ],
    "name": "ProtocolFeesCollected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "exactInput",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "int128",
        "name": "amount0Delta",
        "type": "int128"
      },
      {
        "indexed": false,
        "internalType": "int128",
        "name": "amount1Delta",
        "type": "int128"
      },
      {
        "indexed": false,
        "internalType": "int16",
        "name": "newTick",
        "type": "int16"
      },
      {
        "indexed": false,
        "internalType": "uint104",
        "name": "newPositionInBin",
        "type": "uint104"
      }
    ],
    "name": "Swap",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "collectProtocolFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "slot",
        "type": "bytes32"
      }
    ],
    "name": "extsload",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "startSlot",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "nSlots",
        "type": "uint256"
      }
    ],
    "name": "extsload",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32[]",
        "name": "slots",
        "type": "bytes32[]"
      }
    ],
    "name": "extsload",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getImmutables",
    "outputs": [
      {
        "internalType": "address",
        "name": "factory",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "priceProvider",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "token0",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "token1",
        "type": "address"
      },
      {
        "internalType": "uint104",
        "name": "initialToken0PerDistUnitPerShareE18",
        "type": "uint104"
      },
      {
        "internalType": "uint104",
        "name": "initialToken1PerDistUnitPerShareE18",
        "type": "uint104"
      },
      {
        "internalType": "uint104",
        "name": "minimalMintableLiquidity",
        "type": "uint104"
      },
      {
        "internalType": "bool",
        "name": "reportSwapToPriceProvider",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "maxDriftE8",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "maxDriftDecayPerSecondE8",
        "type": "uint256"
      },
      {
        "internalType": "int16",
        "name": "lowestBin",
        "type": "int16"
      },
      {
        "internalType": "int16",
        "name": "highestBin",
        "type": "int16"
      },
      {
        "internalType": "uint256",
        "name": "token0ScaleMultiplier",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "token1ScaleMultiplier",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint80",
        "name": "salt",
        "type": "uint80"
      },
      {
        "components": [
          {
            "internalType": "int16",
            "name": "bin",
            "type": "int16"
          },
          {
            "internalType": "int104",
            "name": "deltaShares",
            "type": "int104"
          }
        ],
        "internalType": "struct IMetricOmmPoolActions.LiquidityDelta[]",
        "name": "deltas",
        "type": "tuple[]"
      },
      {
        "internalType": "int128",
        "name": "specAmount0",
        "type": "int128"
      },
      {
        "internalType": "int128",
        "name": "specAmount1",
        "type": "int128"
      }
    ],
    "name": "modifyLiquidity",
    "outputs": [
      {
        "internalType": "int128",
        "name": "amount0Delta",
        "type": "int128"
      },
      {
        "internalType": "int128",
        "name": "amount1Delta",
        "type": "int128"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint24",
        "name": "newAdminFeeE6",
        "type": "uint24"
      }
    ],
    "name": "setAdminFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newAdminFeeDestination",
        "type": "address"
      }
    ],
    "name": "setAdminFeeDestination",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newPriceProvider",
        "type": "address"
      }
    ],
    "name": "setPriceProvider",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint24",
        "name": "newProtocolFeeE6",
        "type": "uint24"
      }
    ],
    "name": "setProtocolFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bool",
        "name": "zeroForOne",
        "type": "bool"
      },
      {
        "internalType": "int128",
        "name": "amountSpecified",
        "type": "int128"
      },
      {
        "internalType": "uint128",
        "name": "priceLimitX64",
        "type": "uint128"
      },
      {
        "internalType": "uint128",
        "name": "bidPriceX64",
        "type": "uint128"
      },
      {
        "internalType": "uint128",
        "name": "askPriceX64",
        "type": "uint128"
      }
    ],
    "name": "simulateSwapAndRevert",
    "outputs": [
      {
        "internalType": "int128",
        "name": "amount0Delta",
        "type": "int128"
      },
      {
        "internalType": "int128",
        "name": "amount1Delta",
        "type": "int128"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "zeroForOne",
        "type": "bool"
      },
      {
        "internalType": "int128",
        "name": "amountSpecified",
        "type": "int128"
      },
      {
        "internalType": "uint128",
        "name": "priceLimitX64",
        "type": "uint128"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "swap",
    "outputs": [
      {
        "internalType": "int128",
        "name": "amount0Delta",
        "type": "int128"
      },
      {
        "internalType": "int128",
        "name": "amount1Delta",
        "type": "int128"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
