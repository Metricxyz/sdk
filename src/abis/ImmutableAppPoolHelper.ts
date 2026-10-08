export const ImmutableAppPoolHelperAbi = [
  {
    type: "function",
    name: "APP_FACTORY",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract AnchoredProviderFactory",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "POOL_FACTORY",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IMetricOmmPoolFactory",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createPool",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct PoolParameters",
        components: [
          {
            name: "token0",
            type: "address",
            internalType: "address",
          },
          {
            name: "token1",
            type: "address",
            internalType: "address",
          },
          {
            name: "priceProvider",
            type: "address",
            internalType: "address",
          },
          {
            name: "extensions",
            type: "address[]",
            internalType: "address[]",
          },
          {
            name: "extensionOrders",
            type: "tuple",
            internalType: "struct ExtensionOrders",
            components: [
              {
                name: "beforeAddLiquidity",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "afterAddLiquidity",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "beforeRemoveLiquidity",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "afterRemoveLiquidity",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "beforeSwap",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "afterSwap",
                type: "uint256",
                internalType: "uint256",
              },
            ],
          },
          {
            name: "extensionInitData",
            type: "bytes[]",
            internalType: "bytes[]",
          },
          {
            name: "priceProviderTimelock",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "admin",
            type: "address",
            internalType: "address",
          },
          {
            name: "initialScaledAmount0PerE18Shares",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "initialScaledAmount1PerE18Shares",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "minimalOperationalLiquidity",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "protocolSpreadFeeE6",
            type: "uint24",
            internalType: "uint24",
          },
          {
            name: "adminSpreadFeeE6",
            type: "uint24",
            internalType: "uint24",
          },
          {
            name: "protocolNotionalFeeE8",
            type: "uint24",
            internalType: "uint24",
          },
          {
            name: "adminNotionalFeeE8",
            type: "uint24",
            internalType: "uint24",
          },
          {
            name: "adminFeeDestination",
            type: "address",
            internalType: "address",
          },
          {
            name: "curBinDistFromProvidedPriceE6",
            type: "int24",
            internalType: "int24",
          },
          {
            name: "nonNegativeBinDataArray",
            type: "uint256[]",
            internalType: "uint256[]",
          },
          {
            name: "negativeBinDataArray",
            type: "uint256[]",
            internalType: "uint256[]",
          },
          {
            name: "salt",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "bidAskRefAsymmetryX8",
            type: "uint16",
            internalType: "uint16",
          },
        ],
      },
      {
        name: "bidAskRefAsymmetryX8",
        type: "uint16",
        internalType: "uint16",
      },
    ],
    outputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPoolBidAskRefAsymmetryX8",
    inputs: [
      {
        name: "pool",
        type: "address",
        internalType: "address",
      },
      {
        name: "bidAskRefAsymmetryX8",
        type: "uint16",
        internalType: "uint16",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "error",
    name: "MutablePoolPriceProvider",
    inputs: [],
  },
  {
    type: "error",
    name: "NotPoolAdmin",
    inputs: [],
  },
  {
    type: "error",
    name: "UnknownPool",
    inputs: [],
  },
  {
    type: "error",
    name: "UnrecognizedPriceProvider",
    inputs: [],
  },
] as const;
