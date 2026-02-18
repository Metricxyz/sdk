export const MetricOmmPoolStateViewAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "admin",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "adminFeeDestination",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "adminFeeE6",
    "outputs": [
      {
        "internalType": "uint24",
        "name": "",
        "type": "uint24"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      },
      {
        "internalType": "int16",
        "name": "binIdx",
        "type": "int16"
      }
    ],
    "name": "binState",
    "outputs": [
      {
        "internalType": "uint104",
        "name": "token0Balance",
        "type": "uint104"
      },
      {
        "internalType": "uint104",
        "name": "token1Balance",
        "type": "uint104"
      },
      {
        "internalType": "uint16",
        "name": "lengthE6",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "addFeeBuyE6",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "addFeeSellE6",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      },
      {
        "internalType": "int16",
        "name": "binIdx",
        "type": "int16"
      }
    ],
    "name": "binStateScaled",
    "outputs": [
      {
        "internalType": "uint104",
        "name": "token0BalanceScaled",
        "type": "uint104"
      },
      {
        "internalType": "uint104",
        "name": "token1BalanceScaled",
        "type": "uint104"
      },
      {
        "internalType": "uint16",
        "name": "lengthE6",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "addFeeBuyE6",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "addFeeSellE6",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      },
      {
        "internalType": "int16[]",
        "name": "binIdxs",
        "type": "int16[]"
      }
    ],
    "name": "binStates",
    "outputs": [
      {
        "internalType": "uint104[]",
        "name": "token0Balances",
        "type": "uint104[]"
      },
      {
        "internalType": "uint104[]",
        "name": "token1Balances",
        "type": "uint104[]"
      },
      {
        "internalType": "uint16[]",
        "name": "lengthsInUnits",
        "type": "uint16[]"
      },
      {
        "internalType": "uint16[]",
        "name": "addFeeBuysE6",
        "type": "uint16[]"
      },
      {
        "internalType": "uint16[]",
        "name": "addFeeSellsE6",
        "type": "uint16[]"
      },
      {
        "internalType": "uint104[]",
        "name": "totalShares",
        "type": "uint104[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      },
      {
        "internalType": "int16[]",
        "name": "binIdxs",
        "type": "int16[]"
      }
    ],
    "name": "binStatesScaled",
    "outputs": [
      {
        "internalType": "uint104[]",
        "name": "token0BalancesScaled",
        "type": "uint104[]"
      },
      {
        "internalType": "uint104[]",
        "name": "token1BalancesScaled",
        "type": "uint104[]"
      },
      {
        "internalType": "uint16[]",
        "name": "lengthsInUnits",
        "type": "uint16[]"
      },
      {
        "internalType": "uint16[]",
        "name": "addFeeBuysE6",
        "type": "uint16[]"
      },
      {
        "internalType": "uint16[]",
        "name": "addFeeSellsE6",
        "type": "uint16[]"
      },
      {
        "internalType": "uint104[]",
        "name": "totalShares",
        "type": "uint104[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      },
      {
        "internalType": "int16",
        "name": "binIdx",
        "type": "int16"
      }
    ],
    "name": "binTotalShares",
    "outputs": [
      {
        "internalType": "uint104",
        "name": "",
        "type": "uint104"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "curBinDistFromProvidedPriceE6",
    "outputs": [
      {
        "internalType": "int32",
        "name": "",
        "type": "int32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "curBinIdx",
    "outputs": [
      {
        "internalType": "int16",
        "name": "",
        "type": "int16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "curPosInBin",
    "outputs": [
      {
        "internalType": "uint104",
        "name": "",
        "type": "uint104"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "driftE8",
    "outputs": [
      {
        "internalType": "int32",
        "name": "",
        "type": "int32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "feeConfig",
    "outputs": [
      {
        "internalType": "address",
        "name": "adminAddr",
        "type": "address"
      },
      {
        "internalType": "uint24",
        "name": "protocolFee",
        "type": "uint24"
      },
      {
        "internalType": "uint24",
        "name": "adminFee",
        "type": "uint24"
      },
      {
        "internalType": "address",
        "name": "adminFeeDest",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "getScaleMultipliers",
    "outputs": [
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
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "lastTradeTimestamp",
    "outputs": [
      {
        "internalType": "uint48",
        "name": "",
        "type": "uint48"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "performanceFeeE6",
    "outputs": [
      {
        "internalType": "uint24",
        "name": "",
        "type": "uint24"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "positionBinKey",
        "type": "bytes32"
      }
    ],
    "name": "positionBinShares",
    "outputs": [
      {
        "internalType": "uint104",
        "name": "",
        "type": "uint104"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "uint80",
        "name": "salt",
        "type": "uint80"
      },
      {
        "internalType": "int16",
        "name": "bin",
        "type": "int16"
      }
    ],
    "name": "positionBinShares",
    "outputs": [
      {
        "internalType": "uint104",
        "name": "",
        "type": "uint104"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      },
      {
        "internalType": "bytes32[]",
        "name": "positionBinKeys",
        "type": "bytes32[]"
      }
    ],
    "name": "positionBinSharesBatch",
    "outputs": [
      {
        "internalType": "uint104[]",
        "name": "shares",
        "type": "uint104[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "priceProvider",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "protocolFeeE6",
    "outputs": [
      {
        "internalType": "uint24",
        "name": "",
        "type": "uint24"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "slot0",
    "outputs": [
      {
        "internalType": "int16",
        "name": "_curBinIdx",
        "type": "int16"
      },
      {
        "internalType": "uint104",
        "name": "_curPosInBin",
        "type": "uint104"
      },
      {
        "internalType": "int32",
        "name": "_curBinDistFromProvidedPrice",
        "type": "int32"
      },
      {
        "internalType": "int32",
        "name": "_driftE8",
        "type": "int32"
      },
      {
        "internalType": "uint24",
        "name": "_performanceFeeE6",
        "type": "uint24"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "slot1",
    "outputs": [
      {
        "internalType": "uint128",
        "name": "_totalScaledToken0InBins",
        "type": "uint128"
      },
      {
        "internalType": "uint128",
        "name": "_totalScaledToken1InBins",
        "type": "uint128"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "totalToken0InBins",
    "outputs": [
      {
        "internalType": "uint128",
        "name": "",
        "type": "uint128"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "totalToken1InBins",
    "outputs": [
      {
        "internalType": "uint128",
        "name": "",
        "type": "uint128"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
