import type { HardhatUserConfig } from "hardhat/config";
import { configVariable } from "hardhat/config";

import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatIgnitionViem from "@nomicfoundation/hardhat-ignition-viem";
import hardhatKeystore from "@nomicfoundation/hardhat-keystore";

const config: HardhatUserConfig = {
  plugins: [
    hardhatViem,
    hardhatViemAssertions,
    hardhatNodeTestRunner,
    hardhatNetworkHelpers,
    hardhatIgnitionViem,
    hardhatKeystore,
  ],
  solidity: {
    profiles: {
      default: {
        version: "0.8.33",
        settings: {
          viaIR: true,
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
        },
      },
      production: {
        version: "0.8.33",
        settings: {
          viaIR: true,
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
        },
      },
    },
    npmFilesToBuild: [
      // @metric/core contracts
      "@metric/core/contracts/MetricOmmPool.sol",
      "@metric/core/contracts/MetricOmmPoolFactory.sol",
      "@metric/core/contracts/MetricOmmPoolDeployer.sol",
      "@metric/core/contracts/MetricOmmPoolStateView.sol",
      "@metric/core/contracts/Extsload.sol",
      "@metric/core/contracts/mocks/MockERC20.sol",
      "@metric/core/contracts/mocks/MockOracle.sol",
      "@metric/core/contracts/mocks/TestCaller.sol",
      "@metric/core/contracts/interfaces/IPriceProvider.sol",
      // @metric/periphery contracts
      "@metric/periphery/contracts/MetricOmmSwapRouter.sol",
      "@metric/periphery/contracts/MetricOmmPoolQuoter.sol",
      "@metric/periphery/contracts/mocks/MockWETH9.sol",
    ],
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    base: {
      type: "http",
      chainType: "op",
      url: configVariable("BASE_RPC_URL"),
      accounts: [configVariable("ADMIN_KEY")],
    },
    ethereum: {
      type: "http",
      chainType: "l1",
      url: configVariable("ETHEREUM_RPC_URL"),
      accounts: [configVariable("ADMIN_KEY")],
    },
    arbitrum: {
      type: "http",
      chainType: "generic",
      url: configVariable("ARBITRUM_RPC_URL"),
      accounts: [configVariable("ADMIN_KEY")],
    },
    avalanche: {
      type: "http",
      chainType: "generic",
      url: configVariable("AVALANCHE_RPC_URL"),
      accounts: [configVariable("ADMIN_KEY")],
    },
    bnb: {
      type: "http",
      chainType: "generic",
      url: configVariable("BNB_RPC_URL"),
      accounts: [configVariable("ADMIN_KEY")],
    },
    polygon: {
      type: "http",
      chainType: "generic",
      url: configVariable("POLYGON_RPC_URL"),
      accounts: [configVariable("ADMIN_KEY")],
    },
    megaeth: {
      type: "http",
      chainType: "generic",
      url: configVariable("MEGAETH_RPC_URL"),
      accounts: [configVariable("ADMIN_KEY")],
    },
  },
  ignition: {
    strategyConfig: {
      create2: {
        salt: "0x000000000000000000000000000000000000000000000000000000000000002a",
      },
    },
  },
  paths: {
    tests: "./test",
  },
};

export default config;
