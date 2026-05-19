export const MetricOmmPoolLiquidityAdderAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "poolFactory",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "CallbackContextNotActive",
    type: "error",
  },
  {
    inputs: [],
    name: "EmptyLiquidityDelta",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        internalType: "address",
        name: "expectedPool",
        type: "address",
      },
    ],
    name: "InvalidCallbackCaller",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidCallbackKind",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidPoolFactory",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidPositionOwner",
    type: "error",
  },
  {
    inputs: [],
    name: "LiquidityDeltaLengthMismatch",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount0Due",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount1Due",
        type: "uint256",
      },
    ],
    name: "LiquidityProbe",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount0Due",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount1Due",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxAmount0",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxAmount1",
        type: "uint256",
      },
    ],
    name: "MaxAmountExceeded",
    type: "error",
  },
  {
    inputs: [],
    name: "PayContextAlreadyActive",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
    ],
    name: "SafeERC20FailedOperation",
    type: "error",
  },
  {
    inputs: [],
    name: "SharesRoundedToZero",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "length",
        type: "uint256",
      },
    ],
    name: "UnexpectedRevertLength",
    type: "error",
  },
  {
    inputs: [],
    name: "WeightedProbeInconclusive",
    type: "error",
  },
  {
    inputs: [],
    name: "ZeroWeight",
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
        internalType: "uint80",
        name: "salt",
        type: "uint80",
      },
      {
        components: [
          {
            internalType: "int256[]",
            name: "binIdxs",
            type: "int256[]",
          },
          {
            internalType: "uint256[]",
            name: "shares",
            type: "uint256[]",
          },
        ],
        internalType: "struct LiquidityDelta",
        name: "deltas",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "maxAmountToken0",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxAmountToken1",
        type: "uint256",
      },
    ],
    name: "addLiquidityExactShares",
    outputs: [
      {
        internalType: "uint256",
        name: "amount0Added",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount1Added",
        type: "uint256",
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
        components: [
          {
            internalType: "int256[]",
            name: "binIdxs",
            type: "int256[]",
          },
          {
            internalType: "uint256[]",
            name: "shares",
            type: "uint256[]",
          },
        ],
        internalType: "struct LiquidityDelta",
        name: "deltas",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "maxAmountToken0",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxAmountToken1",
        type: "uint256",
      },
    ],
    name: "addLiquidityExactShares",
    outputs: [
      {
        internalType: "uint256",
        name: "amount0Added",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount1Added",
        type: "uint256",
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
        components: [
          {
            internalType: "int256[]",
            name: "binIdxs",
            type: "int256[]",
          },
          {
            internalType: "uint256[]",
            name: "shares",
            type: "uint256[]",
          },
        ],
        internalType: "struct LiquidityDelta",
        name: "weightDeltas",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "maxAmountToken0",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxAmountToken1",
        type: "uint256",
      },
    ],
    name: "addLiquidityWeighted",
    outputs: [
      {
        internalType: "uint256",
        name: "amount0Added",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount1Added",
        type: "uint256",
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
      {
        internalType: "uint80",
        name: "salt",
        type: "uint80",
      },
      {
        components: [
          {
            internalType: "int256[]",
            name: "binIdxs",
            type: "int256[]",
          },
          {
            internalType: "uint256[]",
            name: "shares",
            type: "uint256[]",
          },
        ],
        internalType: "struct LiquidityDelta",
        name: "weightDeltas",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "maxAmountToken0",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxAmountToken1",
        type: "uint256",
      },
    ],
    name: "addLiquidityWeighted",
    outputs: [
      {
        internalType: "uint256",
        name: "amount0Added",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount1Added",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount0Delta",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount1Delta",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "metricOmmModifyLiquidityCallback",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
