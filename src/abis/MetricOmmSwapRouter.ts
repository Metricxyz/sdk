export const MetricOmmSwapRouterAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_weth",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amountIn",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxAmountIn",
        type: "uint256",
      },
    ],
    name: "InputTooHigh",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "required",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "available",
        type: "uint256",
      },
    ],
    name: "InsufficientNativeValue",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amountOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "minAmountOut",
        type: "uint256",
      },
    ],
    name: "InsufficientOutput",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidCallbackCaller",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidSwapDeltas",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidWETH",
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
    name: "NativeInputNotSupported",
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
    name: "NativeOutputNotSupported",
    type: "error",
  },
  {
    inputs: [],
    name: "NativeTransferFailed",
    type: "error",
  },
  {
    inputs: [],
    name: "NativeValueNotExpected",
    type: "error",
  },
  {
    inputs: [],
    name: "SwapInProgress",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "TransactionExpired",
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
        name: "details",
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
        name: "token0",
        type: "address",
      },
      {
        internalType: "address",
        name: "token1",
        type: "address",
      },
      {
        internalType: "int256",
        name: "amount0Delta",
        type: "int256",
      },
      {
        internalType: "int256",
        name: "amount1Delta",
        type: "int256",
      },
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    name: "metricOmmSwapCallback",
    outputs: [],
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
      {
        internalType: "address",
        name: "recipient",
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
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "swap",
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
    stateMutability: "payable",
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
        name: "recipient",
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
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "swap",
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
    stateMutability: "payable",
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
        name: "recipient",
        type: "address",
      },
      {
        internalType: "bool",
        name: "zeroForOne",
        type: "bool",
      },
      {
        internalType: "uint128",
        name: "amountIn",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "priceLimitX64",
        type: "uint128",
      },
      {
        internalType: "uint256",
        name: "minAmountOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "swapExactInput",
    outputs: [
      {
        internalType: "uint256",
        name: "amountOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amountInUsed",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
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
        name: "recipient",
        type: "address",
      },
      {
        internalType: "bool",
        name: "zeroForOne",
        type: "bool",
      },
      {
        internalType: "uint128",
        name: "amountIn",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "priceLimitX64",
        type: "uint128",
      },
      {
        internalType: "uint256",
        name: "minAmountOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "swapExactInputNativeForTokens",
    outputs: [
      {
        internalType: "uint256",
        name: "amountOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amountInUsed",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
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
        name: "recipient",
        type: "address",
      },
      {
        internalType: "bool",
        name: "zeroForOne",
        type: "bool",
      },
      {
        internalType: "uint128",
        name: "amountIn",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "priceLimitX64",
        type: "uint128",
      },
      {
        internalType: "uint256",
        name: "minAmountOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "swapExactInputTokensForNative",
    outputs: [
      {
        internalType: "uint256",
        name: "amountOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amountInUsed",
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
        name: "recipient",
        type: "address",
      },
      {
        internalType: "bool",
        name: "zeroForOne",
        type: "bool",
      },
      {
        internalType: "uint128",
        name: "amountOutDesired",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "priceLimitX64",
        type: "uint128",
      },
      {
        internalType: "uint256",
        name: "maxAmountIn",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "swapExactOutput",
    outputs: [
      {
        internalType: "uint256",
        name: "amountOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amountInUsed",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
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
        name: "recipient",
        type: "address",
      },
      {
        internalType: "bool",
        name: "zeroForOne",
        type: "bool",
      },
      {
        internalType: "uint128",
        name: "amountOutDesired",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "priceLimitX64",
        type: "uint128",
      },
      {
        internalType: "uint256",
        name: "maxAmountIn",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "swapExactOutputNativeForTokens",
    outputs: [
      {
        internalType: "uint256",
        name: "amountOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amountInUsed",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
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
        name: "recipient",
        type: "address",
      },
      {
        internalType: "bool",
        name: "zeroForOne",
        type: "bool",
      },
      {
        internalType: "uint128",
        name: "amountOutDesired",
        type: "uint128",
      },
      {
        internalType: "uint128",
        name: "priceLimitX64",
        type: "uint128",
      },
      {
        internalType: "uint256",
        name: "maxAmountIn",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "swapExactOutputTokensForNative",
    outputs: [
      {
        internalType: "uint256",
        name: "amountOut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amountInUsed",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
] as const;
