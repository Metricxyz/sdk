export const MetricOmmPoolFactoryAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "initialOwner",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "AdminFeeTooHigh",
    type: "error",
  },
  {
    inputs: [],
    name: "BinArraysEmpty",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "int256",
        name: "binIdx",
        type: "int256",
      },
      {
        internalType: "int256",
        name: "cumulativeDistanceE6",
        type: "int256",
      },
    ],
    name: "BinDistanceOutOfRange",
    type: "error",
  },
  {
    inputs: [],
    name: "BinIndexRangeExceedsInt8",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "int256",
        name: "binIdx",
        type: "int256",
      },
    ],
    name: "BinLengthZero",
    type: "error",
  },
  {
    inputs: [],
    name: "FeeCapsExceedHardLimit",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidAdmin",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidAdminFeeDestination",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidHooksConfig",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidHooksConfig",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidInitialAmount",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidMinimalMintableLiquidity",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "currentLevel",
        type: "uint8",
      },
      {
        internalType: "uint8",
        name: "requestedLevel",
        type: "uint8",
      },
    ],
    name: "InvalidPauseTransition",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidPriceProvider",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidTokenConfig",
    type: "error",
  },
  {
    inputs: [],
    name: "NoPendingPoolAdminTransfer",
    type: "error",
  },
  {
    inputs: [],
    name: "NoPriceProviderChangeProposed",
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
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        internalType: "address",
        name: "pendingAdmin",
        type: "address",
      },
    ],
    name: "NotPendingPoolAdmin",
    type: "error",
  },
  {
    inputs: [],
    name: "NotPoolAdmin",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    inputs: [],
    name: "PoolDeployerAlreadySet",
    type: "error",
  },
  {
    inputs: [],
    name: "PoolDeployerNotSet",
    type: "error",
  },
  {
    inputs: [],
    name: "PriceProviderImmutable",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "executeAfter",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "currentTimestamp",
        type: "uint256",
      },
    ],
    name: "PriceProviderTimelockNotElapsed",
    type: "error",
  },
  {
    inputs: [],
    name: "PriceProviderTokenMismatch",
    type: "error",
  },
  {
    inputs: [],
    name: "ProtocolFeeTooHigh",
    type: "error",
  },
  {
    inputs: [],
    name: "ReentrancyGuardReentrantCall",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "int256",
        name: "value",
        type: "int256",
      },
    ],
    name: "SafeCastOverflowedIntToUint",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "SafeCastOverflowedUintToInt",
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
    name: "WrongBinArrays",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint24",
        name: "maxProtocolSpreadFeeE6",
        type: "uint24",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "maxAdminSpreadFeeE6",
        type: "uint24",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "maxProtocolNotionalFeeE8",
        type: "uint24",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "maxAdminNotionalFeeE8",
        type: "uint24",
      },
    ],
    name: "FeeCapsUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferStarted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "newAdminFeeDestination",
        type: "address",
      },
    ],
    name: "PoolAdminFeeDestinationUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "newAdminNotionalFeeE8",
        type: "uint24",
      },
    ],
    name: "PoolAdminNotionalFeeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "newAdminSpreadFeeE6",
        type: "uint24",
      },
    ],
    name: "PoolAdminSpreadFeeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "cancelledPendingAdmin",
        type: "address",
      },
    ],
    name: "PoolAdminTransferCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "currentAdmin",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newAdmin",
        type: "address",
      },
    ],
    name: "PoolAdminTransferProposed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "previousAdmin",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newAdmin",
        type: "address",
      },
    ],
    name: "PoolAdminTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "poolAddress",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "token0",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "token1",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "poolIdx",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "factory",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "admin",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "priceProvider",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "hooks",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint16",
        name: "hooksPermissions",
        type: "uint16",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "priceProviderTimelock",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "initialAmount0PerShareE18",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "initialAmount1PerShareE18",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "minimalMintableLiquidity",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "spreadProtocolFeeE6",
        type: "uint24",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "protocolNotionalFeeE8",
        type: "uint24",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "adminSpreadFeeE6",
        type: "uint24",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "adminNotionalFeeE8",
        type: "uint24",
      },
      {
        indexed: false,
        internalType: "address",
        name: "adminFeeDestination",
        type: "address",
      },
      {
        indexed: false,
        internalType: "int24",
        name: "curBinDistFromProvidedPriceE6",
        type: "int24",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "nonNegativeBinDataArray",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "negativeBinDataArray",
        type: "uint256[]",
      },
    ],
    name: "PoolCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "poolDeployer",
        type: "address",
      },
    ],
    name: "PoolDeployerSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "currentPriceProvider",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newPriceProvider",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "executeAfter",
        type: "uint256",
      },
    ],
    name: "PoolPriceProviderChangeProposed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newPriceProvider",
        type: "address",
      },
    ],
    name: "PoolPriceProviderUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "newProtocolNotionalFeeE8",
        type: "uint24",
      },
    ],
    name: "PoolProtocolNotionalFeeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "pool",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "newProtocolSpreadFeeE6",
        type: "uint24",
      },
    ],
    name: "PoolProtocolSpreadFeeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint24",
        name: "oldFeeE8",
        type: "uint24",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "newFeeE8",
        type: "uint24",
      },
    ],
    name: "ProtocolNotionalFeeDefaultUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint24",
        name: "oldFeeE6",
        type: "uint24",
      },
      {
        indexed: false,
        internalType: "uint24",
        name: "newFeeE6",
        type: "uint24",
      },
    ],
    name: "SpreadProtocolFeeDefaultUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "TokensCollected",
    type: "event",
  },
  {
    inputs: [],
    name: "acceptOwnership",
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
    ],
    name: "acceptPoolAdmin",
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
    ],
    name: "cancelPoolAdminTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address payable",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "collectEth",
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
    ],
    name: "collectPoolFees",
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
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "collectTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
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
            internalType: "address",
            name: "priceProvider",
            type: "address",
          },
          {
            internalType: "address",
            name: "hooks",
            type: "address",
          },
          {
            internalType: "uint16",
            name: "hooksPermissions",
            type: "uint16",
          },
          {
            internalType: "uint256",
            name: "priceProviderTimelock",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "admin",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "initialAmount0PerShareE18",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "initialAmount1PerShareE18",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "minimalMintableLiquidity",
            type: "uint256",
          },
          {
            internalType: "uint24",
            name: "adminSpreadFeeE6",
            type: "uint24",
          },
          {
            internalType: "uint24",
            name: "adminNotionalFeeE8",
            type: "uint24",
          },
          {
            internalType: "address",
            name: "adminFeeDestination",
            type: "address",
          },
          {
            internalType: "int24",
            name: "curBinDistFromProvidedPriceE6",
            type: "int24",
          },
          {
            internalType: "uint256[]",
            name: "nonNegativeBinDataArray",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "negativeBinDataArray",
            type: "uint256[]",
          },
          {
            internalType: "bytes32",
            name: "salt",
            type: "bytes32",
          },
        ],
        internalType: "struct PoolParameters",
        name: "params",
        type: "tuple",
      },
    ],
    name: "createPool",
    outputs: [
      {
        internalType: "address",
        name: "pool",
        type: "address",
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
    name: "executePoolPriceProviderUpdate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getFeeCaps",
    outputs: [
      {
        internalType: "uint24",
        name: "",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "",
        type: "uint24",
      },
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
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "idxToPool",
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
    name: "isPool",
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
    inputs: [],
    name: "maxAdminNotionalFeeE8",
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
    inputs: [],
    name: "maxAdminSpreadFeeE6",
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
    inputs: [],
    name: "maxOwnerNotionalCapE8",
    outputs: [
      {
        internalType: "uint24",
        name: "",
        type: "uint24",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "maxOwnerSpreadCapE6",
    outputs: [
      {
        internalType: "uint24",
        name: "",
        type: "uint24",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "maxProtocolNotionalFeeE8",
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
    inputs: [],
    name: "maxProtocolSpreadFeeE6",
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
    inputs: [],
    name: "nextPoolIdx",
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
    inputs: [],
    name: "owner",
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
    name: "pausePool",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pendingOwner",
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
        name: "",
        type: "address",
      },
    ],
    name: "pendingPoolAdmin",
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
        name: "",
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
        name: "",
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
        name: "",
        type: "address",
      },
    ],
    name: "poolAdmin",
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
        name: "",
        type: "address",
      },
    ],
    name: "poolAdminFeeDestination",
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
    inputs: [],
    name: "poolDeployer",
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
        name: "",
        type: "address",
      },
    ],
    name: "poolFeeConfig",
    outputs: [
      {
        internalType: "uint24",
        name: "protocolSpreadFeeE6",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "adminSpreadFeeE6",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "protocolNotionalFeeE8",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "adminNotionalFeeE8",
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
        name: "",
        type: "address",
      },
    ],
    name: "poolToIdx",
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
        name: "",
        type: "address",
      },
    ],
    name: "priceProviderTimelock",
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
        internalType: "address",
        name: "newAdmin",
        type: "address",
      },
    ],
    name: "proposePoolAdminTransfer",
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
        internalType: "address",
        name: "newPriceProvider",
        type: "address",
      },
    ],
    name: "proposePoolPriceProvider",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "protocolNotionalFeeE8",
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
    name: "protocolPausePool",
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
    ],
    name: "protocolUnpausePool",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint24",
        name: "newFeeE8",
        type: "uint24",
      },
    ],
    name: "setDefaultProtocolNotionalFeeE8",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint24",
        name: "newFeeE6",
        type: "uint24",
      },
    ],
    name: "setDefaultSpreadProtocolFeeE6",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint24",
        name: "newMaxProtocolSpreadFeeE6",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "newMaxAdminSpreadFeeE6",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "newMaxProtocolNotionalFeeE8",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "newMaxAdminNotionalFeeE8",
        type: "uint24",
      },
    ],
    name: "setFeeCaps",
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
        internalType: "address",
        name: "newAdminFeeDestination",
        type: "address",
      },
    ],
    name: "setPoolAdminFeeDestination",
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
        internalType: "uint24",
        name: "newAdminSpreadFeeE6",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "newAdminNotionalFeeE8",
        type: "uint24",
      },
    ],
    name: "setPoolAdminFees",
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
        internalType: "int8",
        name: "bin",
        type: "int8",
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
    name: "setPoolBinAdditionalFees",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_poolDeployer",
        type: "address",
      },
    ],
    name: "setPoolDeployer",
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
        internalType: "uint24",
        name: "newProtocolSpreadFeeE6",
        type: "uint24",
      },
      {
        internalType: "uint24",
        name: "newProtocolNotionalFeeE8",
        type: "uint24",
      },
    ],
    name: "setPoolProtocolFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "spreadProtocolFeeE6",
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
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
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
    ],
    name: "unpausePool",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
] as const;
