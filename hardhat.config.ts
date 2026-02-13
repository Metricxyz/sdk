import type { HardhatUserConfig } from "hardhat/config";

import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";

const config: HardhatUserConfig = {
  plugins: [
    hardhatViem,
    hardhatViemAssertions,
    hardhatNodeTestRunner,
    hardhatNetworkHelpers,
  ],
  solidity: {
    version: "0.8.33",
    settings: {
      viaIR: true,
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
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
  },
  paths: {
    tests: "./test",
  },
};

export default config;
