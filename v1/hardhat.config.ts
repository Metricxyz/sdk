import type { HardhatUserConfig } from "hardhat/config";

import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";

/** Mainnet JSON-RPC for forked tests (Alchemy, Infura, etc.). */
const ethereumForkRpcUrl =
  process.env.ETHEREUM_RPC_URL ?? process.env.MAINNET_RPC_URL ?? "https://eth.merkle.io";

/**
 * When unset, the fork uses the RPC’s current latest block (no `blockNumber` in forking config).
 * When set, pins that block (must exist on the chain and be ≤ the RPC tip for non-archival nodes).
 */
const ethereumForkBlockNumber = process.env.ETHEREUM_FORK_BLOCK_NUMBER
  ? Number(process.env.ETHEREUM_FORK_BLOCK_NUMBER)
  : undefined;

const config: HardhatUserConfig = {
  plugins: [hardhatViem, hardhatNetworkHelpers, hardhatNodeTestRunner],
  solidity: {
    profiles: {
      default: {
        version: "0.8.35",
        settings: {
          viaIR: true,
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
        },
      },
    },
    npmFilesToBuild: [
      // @metric/periphery pin: v1/package.json; core via periphery lib/metric-core (init:submodules)
      "@metric/core/contracts/MetricOmmPool.sol",
      "@metric/core/contracts/MetricOmmPoolFactory.sol",
      "@metric/core/contracts/MetricOmmPoolDeployer.sol",
      "@metric/core/contracts/libraries/LiquidityLib.sol",
      "@metric/core/contracts/Extsload.sol",
      "@metric/core/test/mocks/MockERC20.sol",
      "@metric/core/test/mocks/MockOracle.sol",
      "@metric/core/test/mocks/TestCaller.sol",
      "@metric/core/contracts/interfaces/IPriceProvider/IPriceProvider.sol",
      "@metric/periphery/contracts/lens/MetricOmmPoolDataProvider.sol",
      "@metric/periphery/contracts/MetricOmmPoolSwapper.sol",
      "@metric/periphery/contracts/MetricOmmPoolLiquidityAdder.sol",
      "@metric/periphery/contracts/extensions/DepositAllowlistExtension.sol",
      "@metric/periphery/contracts/extensions/SwapAllowlistExtension.sol",
      "@metric/periphery/contracts/extensions/PriceVelocityGuardExtension.sol",
      "@metric/periphery/contracts/extensions/OracleValueStopLossExtension.sol",
      "@metric/periphery/test/mocks/MockWETH9.sol",
    ],
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
    },
    "ethereum-mainnet-fork": {
      type: "edr-simulated",
      chainType: "l1",
      forking: {
        url: ethereumForkRpcUrl,
        ...(ethereumForkBlockNumber != null && Number.isFinite(ethereumForkBlockNumber)
          ? { blockNumber: ethereumForkBlockNumber }
          : {}),
      },
    },
  },
  paths: {
    tests: "./test",
  },
};

export default config;
